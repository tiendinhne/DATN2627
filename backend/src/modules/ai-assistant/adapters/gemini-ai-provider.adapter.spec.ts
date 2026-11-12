import { afterEach, describe, expect, it, vi } from 'vitest';
import { GEMINI_MODEL, GeminiAiProviderAdapter, buildSystemPrompt, geminiEnvSchema } from './gemini-ai-provider.adapter.js';
import { AiProviderError } from '../ports/ai-provider.port.js';
import { AiRequestKind, AiRequestStatus } from '../../../shared/enums.js';

// Response Gemini tối thiểu — dạng đo thật 2026-11-11 (1 câu trả lời có thể tách thành nhiều parts)
const geminiReply = (parts: string[], finishReason = 'STOP') => ({
  candidates: [{ content: { role: 'model', parts: parts.map((text) => ({ text })) }, finishReason }],
  usageMetadata: { promptTokenCount: 33, candidatesTokenCount: 373 },
});
const jsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

// Test KHÔNG đọc env thật, KHÔNG gọi mạng: env + fetch đều giả
function build() {
  vi.stubEnv('GEMINI_API_KEY', 'test-key');
  vi.stubEnv('AI_TIMEOUT_MS', '30000');
  const fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  return { adapter: new GeminiAiProviderAdapter(), fetchMock };
}
const call = (adapter: GeminiAiProviderAdapter, signal = new AbortController().signal) =>
  adapter.generateDiagram({ kind: AiRequestKind.FLOWCHART, prompt: 'Quy trình đăng nhập', signal });

// Bắt lỗi ném ra, trả 3 field của AiProviderError dạng object thường để so
async function failure(promise: Promise<unknown>) {
  const error = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(AiProviderError);
  const { status, errorCode, retryable } = error as AiProviderError;
  return { status, errorCode, retryable };
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('geminiEnvSchema', () => {
  const env = { GEMINI_API_KEY: 'k', AI_TIMEOUT_MS: '30000' };

  it('đủ biến → hợp lệ, timeout ép sang số', () => {
    const r = geminiEnvSchema.safeParse(env);
    expect(r.success && r.data.AI_TIMEOUT_MS).toBe(30000);
  });

  it('key rỗng → lỗi', () => {
    expect(geminiEnvSchema.safeParse({ ...env, GEMINI_API_KEY: '' }).success).toBe(false);
  });

  it('timeout dưới 5.000 ms → lỗi', () => {
    expect(geminiEnvSchema.safeParse({ ...env, AI_TIMEOUT_MS: '1000' }).success).toBe(false);
  });
});

describe('GeminiAiProviderAdapter', () => {
  it('thiếu GEMINI_API_KEY → constructor ném lỗi (fail-fast lúc khởi động)', () => {
    vi.stubEnv('GEMINI_API_KEY', '');
    vi.stubEnv('AI_TIMEOUT_MS', '30000');
    expect(() => new GeminiAiProviderAdapter()).toThrow(/GEMINI_API_KEY/);
  });

  it('model là hằng, timeoutMs lấy từ env', () => {
    const { adapter } = build();
    expect(GEMINI_MODEL).toBe('gemini-3.5-flash-lite');
    expect(adapter.model).toBe('gemini-3.5-flash-lite');
    expect(adapter.timeoutMs).toBe(30000);
  });

  it('gửi đúng request: URL, header key, system prompt tách khỏi prompt người dùng, JSON mode + schema', async () => {
    const { adapter, fetchMock } = build();
    fetchMock.mockResolvedValue(jsonResponse(200, geminiReply(['{"nodes":[],"edges":[]}'])));
    const controller = new AbortController();

    await call(adapter, controller.signal);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent');
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual({ 'Content-Type': 'application/json', 'x-goog-api-key': 'test-key' });
    expect(init.signal).toBe(controller.signal);
    const body = JSON.parse(init.body);
    expect(body.systemInstruction).toEqual({ parts: [{ text: buildSystemPrompt(AiRequestKind.FLOWCHART) }] });
    expect(body.systemInstruction.parts[0].text).not.toContain('Quy trình đăng nhập');
    expect(body.contents).toEqual([{ role: 'user', parts: [{ text: 'Quy trình đăng nhập' }] }]);
    expect(body.generationConfig.responseMimeType).toBe('application/json');
    const schema = body.generationConfig.responseSchema;
    expect(schema.properties.nodes.maxItems).toBe(40);
    // Gọi thật 2026-11-12: thêm maxItems 80 cho edges → Gemini trả 400 INVALID_ARGUMENT → không gửi; Zod vẫn chặn > 80
    expect(schema.properties.edges.maxItems).toBeUndefined();
    expect(schema.properties.nodes.items.properties.shape.enum).toEqual(['rectangle', 'ellipse', 'diamond']);
  });

  it('system prompt khác nhau theo loại sơ đồ', () => {
    const prompts = [AiRequestKind.FLOWCHART, AiRequestKind.MINDMAP, AiRequestKind.DIAGRAM].map(buildSystemPrompt);
    expect(new Set(prompts).size).toBe(3);
    expect(buildSystemPrompt(AiRequestKind.MINDMAP)).toContain('mindmap');
  });

  it('nối text của mọi parts, đọc số token', async () => {
    const { adapter, fetchMock } = build();
    fetchMock.mockResolvedValue(jsonResponse(200, geminiReply(['{"nodes":', '[],"edges":[]}'])));
    await expect(call(adapter)).resolves.toEqual({ text: '{"nodes":[],"edges":[]}', inputTokens: 33, outputTokens: 373 });
  });

  it('không có usageMetadata → token null', async () => {
    const { adapter, fetchMock } = build();
    const { usageMetadata: _omit, ...reply } = geminiReply(['{}']);
    fetchMock.mockResolvedValue(jsonResponse(200, reply));
    await expect(call(adapter)).resolves.toMatchObject({ inputTokens: null, outputTokens: null });
  });

  it.each<[number, AiRequestStatus, string, boolean]>([
    [429, AiRequestStatus.RATE_LIMITED, 'GEMINI_429', false],
    [500, AiRequestStatus.PROVIDER_ERROR, 'GEMINI_5XX', true],
    [503, AiRequestStatus.PROVIDER_ERROR, 'GEMINI_5XX', true],
    [400, AiRequestStatus.PROVIDER_ERROR, 'GEMINI_HTTP_400', false],
    [403, AiRequestStatus.PROVIDER_ERROR, 'GEMINI_HTTP_403', false],
  ])('HTTP %i → %s / %s, thử lại được: %s', async (httpStatus, status, errorCode, retryable) => {
    const { adapter, fetchMock } = build();
    fetchMock.mockResolvedValue(jsonResponse(httpStatus, { error: { code: httpStatus, status: 'UNAVAILABLE' } }));
    expect(await failure(call(adapter))).toEqual({ status, errorCode, retryable });
  });

  it.each<[string, unknown]>([
    ['text rỗng', geminiReply([''])],
    ['finishReason khác STOP', geminiReply(['{"nodes":'], 'MAX_TOKENS')],
    ['không có candidates', { usageMetadata: {} }],
  ])('%s → EMPTY_OUTPUT, thử lại được', async (_name, reply) => {
    const { adapter, fetchMock } = build();
    fetchMock.mockResolvedValue(jsonResponse(200, reply));
    expect(await failure(call(adapter))).toEqual({
      status: AiRequestStatus.INVALID_OUTPUT,
      errorCode: 'EMPTY_OUTPUT',
      retryable: true,
    });
  });

  it('lỗi mạng → NETWORK, thử lại được', async () => {
    const { adapter, fetchMock } = build();
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));
    expect(await failure(call(adapter))).toEqual({
      status: AiRequestStatus.PROVIDER_ERROR,
      errorCode: 'NETWORK',
      retryable: true,
    });
  });

  it('signal đã huỷ (hết hạn) → TIMEOUT, không thử lại', async () => {
    const { adapter, fetchMock } = build();
    const controller = new AbortController();
    controller.abort();
    fetchMock.mockRejectedValue(new DOMException('This operation was aborted', 'AbortError'));
    expect(await failure(call(adapter, controller.signal))).toEqual({
      status: AiRequestStatus.TIMEOUT,
      errorCode: 'TIMEOUT',
      retryable: false,
    });
  });
});
