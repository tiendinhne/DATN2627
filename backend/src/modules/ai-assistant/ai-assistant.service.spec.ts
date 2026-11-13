import { describe, expect, it, vi } from 'vitest';
import { Types } from 'mongoose';
import { AiAssistantService } from './ai-assistant.service.js';
import type { GenerateInput } from './ai-assistant.service.js';
import { AiProviderError } from './ports/ai-provider.port.js';
import { layoutDiagram } from './adapters/elk-layout.js';
import { AiRequestKind, AiRequestStatus } from '../../shared/enums.js';

// Bố cục thật (elkjs) — chỉ bọc vi.fn để 1 test giả lập elkjs lỗi
vi.mock('./adapters/elk-layout.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./adapters/elk-layout.js')>();
  return { ...actual, layoutDiagram: vi.fn(actual.layoutDiagram) };
});

const userId = new Types.ObjectId().toString();
const roomId = new Types.ObjectId().toString();
const meetingId = new Types.ObjectId().toString();
const requestId = '4bf92f30-7f38-4d71-9e7c-8f3b18d4f1b3';
const input: GenerateInput = {
  userId,
  roomId,
  meetingId,
  requestId,
  prompt: 'Quy trình đăng nhập',
  kind: AiRequestKind.FLOWCHART,
};

const USER_KEY = `ratelimit:ai:user:${userId}`;
const MEETING_KEY = `ratelimit:ai:meeting:${meetingId}`;
const MINUTE_KEY = 'ratelimit:ai:global:minute';
const DAY_KEY = 'ratelimit:ai:global:day';

// DSL hợp lệ: 2 node + 1 cạnh → elementCount 3
const VALID = JSON.stringify({
  nodes: [
    { id: 'n1', label: 'Bắt đầu', shape: 'ellipse' },
    { id: 'n2', label: 'Nhập email', shape: 'rectangle' },
  ],
  edges: [{ from: 'n1', to: 'n2' }],
});
// JSON đúng cú pháp nhưng sai luật (n3 mồ côi)
const ORPHAN = JSON.stringify({
  nodes: [
    { id: 'n1', label: 'A', shape: 'rectangle' },
    { id: 'n2', label: 'B', shape: 'rectangle' },
    { id: 'n3', label: 'C', shape: 'rectangle' },
  ],
  edges: [{ from: 'n1', to: 'n2' }],
});

const PERSONAL = 'Bạn đã dùng hết lượt AI, thử lại sau ít phút.';
const BUSY = 'AI đang quá tải, thử lại sau 1 phút.';
const INVALID = 'AI trả kết quả không dùng được, hãy diễn đạt lại yêu cầu.';

// replies: lần lượt từng lần gọi Gemini — chuỗi = text trả về; Error = ném. counts: bộ đếm Redis có sẵn
function build(replies: Array<string | Error>, counts: Record<string, number> = {}) {
  const store = new Map(Object.entries(counts));
  const redis = {
    incr: vi.fn(async (key: string) => {
      const next = (store.get(key) ?? 0) + 1;
      store.set(key, next);
      return next;
    }),
    expire: vi.fn().mockResolvedValue(true),
  };
  const generateDiagram = vi.fn();
  for (const reply of replies) {
    if (typeof reply === 'string') generateDiagram.mockResolvedValueOnce({ text: reply, inputTokens: 10, outputTokens: 20 });
    else generateDiagram.mockRejectedValueOnce(reply);
  }
  const provider = { model: 'test-model', timeoutMs: 30_000, generateDiagram };
  const aiRequestModel = { create: vi.fn().mockResolvedValue({}) };
  const service = new AiAssistantService(aiRequestModel as any, provider as any, redis as any);
  return { service, redis, provider, aiRequestModel };
}
// Dòng ai_requests đã ghi (lần ghi đầu tiên)
const logged = (model: { create: ReturnType<typeof vi.fn> }) => model.create.mock.calls[0][0];

describe('AiAssistantService.generate', () => {
  it('thành công: trả sơ đồ đã bố cục, ghi đúng 1 dòng SUCCESS đủ trường', async () => {
    const { service, provider, aiRequestModel } = build([VALID]);

    const outcome = await service.generate(input);

    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.diagram.nodes.map((n) => n.id)).toEqual(['n1', 'n2']);
      expect(outcome.diagram.edges).toHaveLength(1);
    }
    expect(provider.generateDiagram).toHaveBeenCalledTimes(1);
    expect(provider.generateDiagram).toHaveBeenCalledWith({
      kind: AiRequestKind.FLOWCHART,
      prompt: input.prompt,
      signal: expect.any(AbortSignal),
    });
    expect(aiRequestModel.create).toHaveBeenCalledTimes(1);
    expect(logged(aiRequestModel)).toMatchObject({
      requestId,
      userId,
      roomId,
      meetingId,
      kind: AiRequestKind.FLOWCHART,
      prompt: input.prompt,
      status: AiRequestStatus.SUCCESS,
      errorCode: null,
      model: 'test-model',
      inputTokens: 10,
      outputTokens: 20,
      elementCount: 3,
    });
    expect(logged(aiRequestModel).latencyMs).toBeGreaterThanOrEqual(0);
  });

  it('lần đầu đếm thì đặt hạn key: người 60 s, meeting 3.600 s, phút 60 s, ngày 86.400 s', async () => {
    const { service, redis } = build([VALID]);
    await service.generate(input);
    expect(redis.expire).toHaveBeenCalledWith(USER_KEY, 60);
    expect(redis.expire).toHaveBeenCalledWith(MEETING_KEY, 3600);
    expect(redis.expire).toHaveBeenCalledWith(MINUTE_KEY, 60);
    expect(redis.expire).toHaveBeenCalledWith(DAY_KEY, 86_400);
  });

  it('JSON hỏng lần 1, lần 2 được → SUCCESS, token cộng 2 lần gọi', async () => {
    const { service, provider, aiRequestModel } = build(['không phải json', VALID]);
    expect((await service.generate(input)).ok).toBe(true);
    expect(provider.generateDiagram).toHaveBeenCalledTimes(2);
    expect(logged(aiRequestModel)).toMatchObject({ status: AiRequestStatus.SUCCESS, inputTokens: 20, outputTokens: 40 });
  });

  it('DSL sai cả 2 lần → INVALID_OUTPUT / BAD_DSL, không gọi lần 3', async () => {
    const { service, provider, aiRequestModel } = build([ORPHAN, ORPHAN, VALID]);
    expect(await service.generate(input)).toEqual({ ok: false, code: AiRequestStatus.INVALID_OUTPUT, message: INVALID });
    expect(provider.generateDiagram).toHaveBeenCalledTimes(2);
    expect(logged(aiRequestModel)).toMatchObject({
      status: AiRequestStatus.INVALID_OUTPUT,
      errorCode: 'BAD_DSL',
      elementCount: 0,
    });
  });

  it('Gemini 503 rồi lần 2 được → SUCCESS', async () => {
    const { service, provider } = build([
      new AiProviderError(AiRequestStatus.PROVIDER_ERROR, 'GEMINI_5XX', true),
      VALID,
    ]);
    expect((await service.generate(input)).ok).toBe(true);
    expect(provider.generateDiagram).toHaveBeenCalledTimes(2);
  });

  it('Gemini 5xx cả 2 lần → PROVIDER_ERROR / GEMINI_5XX', async () => {
    const err = () => new AiProviderError(AiRequestStatus.PROVIDER_ERROR, 'GEMINI_5XX', true);
    const { service, aiRequestModel } = build([err(), err()]);
    expect(await service.generate(input)).toEqual({
      ok: false,
      code: AiRequestStatus.PROVIDER_ERROR,
      message: 'Dịch vụ AI đang lỗi, thử lại sau.',
    });
    expect(logged(aiRequestModel)).toMatchObject({ status: AiRequestStatus.PROVIDER_ERROR, errorCode: 'GEMINI_5XX' });
  });

  it('Gemini 429 → RATE_LIMITED / GEMINI_429, không thử lại', async () => {
    const { service, provider, aiRequestModel } = build([
      new AiProviderError(AiRequestStatus.RATE_LIMITED, 'GEMINI_429', false),
      VALID,
    ]);
    expect(await service.generate(input)).toEqual({ ok: false, code: AiRequestStatus.RATE_LIMITED, message: BUSY });
    expect(provider.generateDiagram).toHaveBeenCalledTimes(1);
    expect(logged(aiRequestModel)).toMatchObject({ errorCode: 'GEMINI_429' });
  });

  it('hết giờ → TIMEOUT, không thử lại', async () => {
    const { service, provider } = build([new AiProviderError(AiRequestStatus.TIMEOUT, 'TIMEOUT', false), VALID]);
    expect(await service.generate(input)).toEqual({
      ok: false,
      code: AiRequestStatus.TIMEOUT,
      message: 'AI phản hồi quá lâu, hãy thử lại.',
    });
    expect(provider.generateDiagram).toHaveBeenCalledTimes(1);
  });

  it('người dùng đã dùng 5 lượt trong phút → USER_LIMIT, không gọi Gemini, không đếm meeting', async () => {
    const { service, provider, redis, aiRequestModel } = build([VALID], { [USER_KEY]: 5 });
    expect(await service.generate(input)).toEqual({ ok: false, code: AiRequestStatus.RATE_LIMITED, message: PERSONAL });
    expect(provider.generateDiagram).not.toHaveBeenCalled();
    expect(redis.incr).not.toHaveBeenCalledWith(MEETING_KEY);
    expect(logged(aiRequestModel)).toMatchObject({
      status: AiRequestStatus.RATE_LIMITED,
      errorCode: 'USER_LIMIT',
      elementCount: 0,
    });
  });

  it('meeting đã dùng 20 lượt trong giờ → MEETING_LIMIT', async () => {
    const { service, provider, aiRequestModel } = build([VALID], { [MEETING_KEY]: 20 });
    expect(await service.generate(input)).toEqual({ ok: false, code: AiRequestStatus.RATE_LIMITED, message: PERSONAL });
    expect(provider.generateDiagram).not.toHaveBeenCalled();
    expect(logged(aiRequestModel)).toMatchObject({ errorCode: 'MEETING_LIMIT' });
  });

  it.each<[string, Record<string, number>]>([
    ['12 lần gọi / phút', { [MINUTE_KEY]: 12 }],
    ['450 lần gọi / ngày', { [DAY_KEY]: 450 }],
  ])('cả hệ thống đã đủ %s → GLOBAL_LIMIT, không gọi Gemini', async (_name, counts) => {
    const { service, provider, aiRequestModel } = build([VALID], counts);
    expect(await service.generate(input)).toEqual({ ok: false, code: AiRequestStatus.RATE_LIMITED, message: BUSY });
    expect(provider.generateDiagram).not.toHaveBeenCalled();
    expect(logged(aiRequestModel)).toMatchObject({ errorCode: 'GLOBAL_LIMIT' });
  });

  it('lần thử lại cũng tính vào trần hệ thống (còn đúng 1 lần gọi trong phút)', async () => {
    const { service, provider, aiRequestModel } = build(['hỏng', VALID], { [MINUTE_KEY]: 11 });
    expect(await service.generate(input)).toEqual({ ok: false, code: AiRequestStatus.RATE_LIMITED, message: BUSY });
    expect(provider.generateDiagram).toHaveBeenCalledTimes(1);
    expect(logged(aiRequestModel)).toMatchObject({ errorCode: 'GLOBAL_LIMIT', inputTokens: 10 });
  });

  it('elkjs lỗi → INVALID_OUTPUT / LAYOUT_FAILED', async () => {
    vi.mocked(layoutDiagram).mockRejectedValueOnce(new Error('elk lỗi'));
    const { service, aiRequestModel } = build([VALID]);
    expect(await service.generate(input)).toEqual({ ok: false, code: AiRequestStatus.INVALID_OUTPUT, message: INVALID });
    expect(logged(aiRequestModel)).toMatchObject({
      status: AiRequestStatus.INVALID_OUTPUT,
      errorCode: 'LAYOUT_FAILED',
      elementCount: 0,
    });
  });

  it('ghi ai_requests lỗi (vd trùng requestId) → vẫn trả kết quả', async () => {
    const { service, aiRequestModel } = build([VALID]);
    aiRequestModel.create.mockRejectedValue(Object.assign(new Error('E11000 duplicate key'), { code: 11000 }));
    expect((await service.generate(input)).ok).toBe(true);
  });

  it('lỗi lạ (không phải AiProviderError) → ném ra, không nuốt', async () => {
    const { service } = build([new Error('bug')]);
    await expect(service.generate(input)).rejects.toThrow('bug');
  });
});
