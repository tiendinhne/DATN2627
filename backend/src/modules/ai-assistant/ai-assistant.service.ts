import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AiRequest } from './schemas/ai-request.schema.js';
import { AI_PROVIDER_PORT, AiProviderError } from './ports/ai-provider.port.js';
import type { AiFailureStatus, AiProviderPort } from './ports/ai-provider.port.js';
import { parseDiagramDsl } from './domain/diagram-dsl.js';
import type { DiagramDsl } from './domain/diagram-dsl.js';
import { layoutDiagram } from './adapters/elk-layout.js';
import { RedisService } from '../../common/services/redis.service.js';
import { AiRequestStatus } from '../../shared/enums.js';
import type { AiRequestKind } from '../../shared/enums.js';
import type { AiDiagram } from '../../shared/ai.js';

// Một yêu cầu tạo sơ đồ — gateway đã validate payload + kiểm socket đang ở kênh meeting
export interface GenerateInput {
  userId: string;
  roomId: string;
  meetingId: string;
  requestId: string;
  prompt: string;
  kind: AiRequestKind;
}

export type GenerateOutcome = { ok: true; diagram: AiDiagram } | { ok: false; code: AiFailureStatus; message: string };

// Giới hạn lượt (spec §7.1): người + meeting đếm mỗi yêu cầu; trần hệ thống đếm mỗi lần gọi Gemini (quota tính theo project)
const USER_LIMIT = { limit: 5, windowSec: 60 };
const MEETING_LIMIT = { limit: 20, windowSec: 3600 };
const GLOBAL_MINUTE_LIMIT = { limit: 12, windowSec: 60 };
const GLOBAL_DAY_LIMIT = { limit: 450, windowSec: 86_400 };
// Gọi tối đa 2 lần: lần đầu + thử lại đúng 1 lần (spec §1 câu 11)
const MAX_ATTEMPTS = 2;

// Câu báo người dùng (spec §3.2)
const PERSONAL_LIMIT_MESSAGE = 'Bạn đã dùng hết lượt AI, thử lại sau ít phút.';
const MESSAGES: Record<AiFailureStatus, string> = {
  [AiRequestStatus.RATE_LIMITED]: 'AI đang quá tải, thử lại sau 1 phút.',
  [AiRequestStatus.TIMEOUT]: 'AI phản hồi quá lâu, hãy thử lại.',
  [AiRequestStatus.INVALID_OUTPUT]: 'AI trả kết quả không dùng được, hãy diễn đạt lại yêu cầu.',
  [AiRequestStatus.PROVIDER_ERROR]: 'Dịch vụ AI đang lỗi, thử lại sau.',
};

// Cộng số token qua các lần gọi; chưa lần nào có số → null
const addTokens = (total: number | null, value: number | null) => (value === null ? total : (total ?? 0) + value);

@Injectable()
export class AiAssistantService {
  private readonly logger = new Logger(AiAssistantService.name);

  constructor(
    // Model<AiRequest> (không phải Model<AiRequestDocument>): field `model` trùng tên hàm Document.model() của Mongoose
    // → kiểu AiRequestDocument không nhận chuỗi cho `model` (tsc TS2769)
    @InjectModel(AiRequest.name) private aiRequestModel: Model<AiRequest>,
    @Inject(AI_PROVIDER_PORT) private provider: AiProviderPort,
    private redis: RedisService,
  ) {}

  // LLM → DSL (Zod) → elkjs (ADR-011). KHÔNG ghi gì vào whiteboard: client chèn rồi đồng bộ qua wb:ops (spec §1 câu 3, 4).
  // Không giữ gì trong RAM giữa các request (ràng buộc 5): bộ đếm ở Redis, kết quả trả trên chính socket đã gửi
  async generate(input: GenerateInput): Promise<GenerateOutcome> {
    const startedAt = Date.now();
    const usage = { inputTokens: null as number | null, outputTokens: null as number | null };

    // Ghi đúng 1 dòng ai_requests rồi trả kết quả. Ghi lỗi (vd trùng requestId) chỉ log — không đổi kết quả (spec §7 bước 5)
    const finish = async (
      status: AiRequestStatus,
      errorCode: string | null,
      outcome: GenerateOutcome,
      elementCount = 0,
    ): Promise<GenerateOutcome> => {
      try {
        await this.aiRequestModel.create({
          requestId: input.requestId,
          userId: input.userId,
          roomId: input.roomId,
          meetingId: input.meetingId,
          kind: input.kind,
          prompt: input.prompt.slice(0, 1000),
          status,
          errorCode,
          latencyMs: Date.now() - startedAt,
          model: this.provider.model,
          inputTokens: usage.inputTokens,
          outputTokens: usage.outputTokens,
          elementCount,
        });
      } catch (err) {
        this.logger.error(`Không ghi được ai_requests, request ${input.requestId}: ${err}`);
      }
      return outcome;
    };
    const fail = (status: AiFailureStatus, errorCode: string, message = MESSAGES[status]) =>
      finish(status, errorCode, { ok: false, code: status, message });

    // 1. Giới hạn người, meeting — vượt thì không gọi Gemini
    if (!(await this.withinLimit(`ratelimit:ai:user:${input.userId}`, USER_LIMIT))) {
      return fail(AiRequestStatus.RATE_LIMITED, 'USER_LIMIT', PERSONAL_LIMIT_MESSAGE);
    }
    if (!(await this.withinLimit(`ratelimit:ai:meeting:${input.meetingId}`, MEETING_LIMIT))) {
      return fail(AiRequestStatus.RATE_LIMITED, 'MEETING_LIMIT', PERSONAL_LIMIT_MESSAGE);
    }

    // 2. Một hạn cho CẢ request, gồm cả lần thử lại
    const signal = AbortSignal.timeout(this.provider.timeoutMs);

    // 3. Gọi Gemini + kiểm DSL; thử lại đúng 1 lần khi output hỏng hoặc lỗi tạm thời (5xx, mạng)
    let dsl: DiagramDsl | null = null;
    let failure: { status: AiFailureStatus; errorCode: string } = {
      status: AiRequestStatus.INVALID_OUTPUT,
      errorCode: 'BAD_JSON',
    };
    for (let attempt = 1; attempt <= MAX_ATTEMPTS && !dsl; attempt++) {
      if (!(await this.withinGlobalLimit())) return fail(AiRequestStatus.RATE_LIMITED, 'GLOBAL_LIMIT');
      try {
        const reply = await this.provider.generateDiagram({ kind: input.kind, prompt: input.prompt, signal });
        usage.inputTokens = addTokens(usage.inputTokens, reply.inputTokens);
        usage.outputTokens = addTokens(usage.outputTokens, reply.outputTokens);
        const parsed = parseDiagramDsl(reply.text);
        if (parsed.ok) dsl = parsed.dsl;
        else failure = { status: AiRequestStatus.INVALID_OUTPUT, errorCode: parsed.errorCode };
      } catch (err) {
        if (!(err instanceof AiProviderError)) throw err; // lỗi lạ = bug → không nuốt
        failure = { status: err.status, errorCode: err.errorCode };
        if (!err.retryable) break;
      }
    }
    if (!dsl) return fail(failure.status, failure.errorCode);

    // 4. Bố cục (elkjs)
    let diagram: AiDiagram;
    try {
      diagram = await layoutDiagram(dsl, input.kind);
    } catch (err) {
      this.logger.error(`elkjs lỗi, request ${input.requestId}: ${err}`);
      return fail(AiRequestStatus.INVALID_OUTPUT, 'LAYOUT_FAILED');
    }

    // elementCount = node + cạnh của DSL (spec §1 câu 13)
    return finish(AiRequestStatus.SUCCESS, null, { ok: true, diagram }, dsl.nodes.length + dsl.edges.length);
  }

  // INCR; lần đầu thì đặt hạn (cùng cách rooms.service.checkRateLimit). true = còn trong trần
  private async withinLimit(key: string, { limit, windowSec }: { limit: number; windowSec: number }): Promise<boolean> {
    const count = await this.redis.incr(key);
    if (count === 1) await this.redis.expire(key, windowSec);
    return count <= limit;
  }

  // Trần toàn hệ thống: phút trước, ngày sau (vượt phút thì không đếm ngày)
  private async withinGlobalLimit(): Promise<boolean> {
    return (
      (await this.withinLimit('ratelimit:ai:global:minute', GLOBAL_MINUTE_LIMIT)) &&
      (await this.withinLimit('ratelimit:ai:global:day', GLOBAL_DAY_LIMIT))
    );
  }
}
