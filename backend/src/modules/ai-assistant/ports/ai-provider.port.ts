import type { AiRequestKind, AiRequestStatus } from '../../../shared/enums.js';

// Port "ai-provider": năng lực sinh DSL sơ đồ từ ngôn ngữ tự nhiên (ràng buộc 9 — tên theo năng lực, không theo vendor).
// AiAssistantService chỉ biết interface này; GeminiAiProviderAdapter cài đặt nó; test dùng bản giả.
export const AI_PROVIDER_PORT = Symbol('AI_PROVIDER_PORT');

// Mọi trạng thái thất bại của 1 lần gọi AI — dùng lại enum của ai_requests, không thêm enum
export type AiFailureStatus = Exclude<AiRequestStatus, AiRequestStatus.SUCCESS>;

export interface AiProviderPort {
  readonly model: string; // ghi vào ai_requests.model
  readonly timeoutMs: number; // hạn cho CẢ request (AI_TIMEOUT_MS) — service không đọc env
  // Trả chuỗi JSON thô CHƯA kiểm + số token. Lỗi → ném AiProviderError
  generateDiagram(input: {
    kind: AiRequestKind;
    prompt: string;
    signal: AbortSignal;
  }): Promise<{ text: string; inputTokens: number | null; outputTokens: number | null }>;
}

// Lỗi đã chuẩn hoá — không lộ kiểu lỗi / mã HTTP của vendor ra ngoài adapter (spec §5.4)
export class AiProviderError extends Error {
  constructor(
    readonly status: AiFailureStatus, // ghi vào ai_requests.status
    readonly errorCode: string, // ghi vào ai_requests.errorCode
    readonly retryable: boolean, // service có được thử lại không
  ) {
    super(errorCode);
    this.name = 'AiProviderError';
  }
}
