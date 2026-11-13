import { z } from 'zod';
import { AI_MAX_EDGES, AI_MAX_LABEL_LENGTH, AI_MAX_NODES, AI_SHAPES } from '../../../shared/ai.js';

// Chuẩn hoá nhãn (spec §4): NFC (tiếng Việt dựng sẵn) → gộp mọi khoảng trắng, cả xuống dòng → cắt hai đầu
// → quá 80 ký tự thì cắt còn 79 + "…" (spec §1 câu 12). Gộp xuống dòng là cố ý: Excalidraw tự xuống dòng theo khung
export function normalizeLabel(value: string): string {
  const text = value.normalize('NFC').replace(/\s+/g, ' ').trim();
  return text.length > AI_MAX_LABEL_LENGTH ? `${text.slice(0, AI_MAX_LABEL_LENGTH - 1)}…` : text;
}

const nodeSchema = z.object({
  id: z.string().regex(/^[A-Za-z0-9_-]{1,32}$/),
  label: z.string().transform(normalizeLabel).pipe(z.string().min(1)),
  shape: z.enum(AI_SHAPES),
});

const edgeSchema = z.object({
  from: z.string(),
  to: z.string(),
  // Nhãn cạnh tuỳ chọn; rỗng sau chuẩn hoá → bỏ
  label: z
    .string()
    .optional()
    .transform((value) => (value === undefined ? undefined : normalizeLabel(value) || undefined)),
});

// DSL Gemini trả về — response AI là input không tin cậy (PROJECT_CONTEXT §14, P10). Gemini không áp dụng maxLength → kiểm ở đây
export const diagramDslSchema = z
  .object({
    nodes: z.array(nodeSchema).min(1).max(AI_MAX_NODES),
    edges: z.array(edgeSchema).max(AI_MAX_EDGES),
  })
  .superRefine((dsl, ctx) => {
    const ids = new Set<string>();
    for (const node of dsl.nodes) {
      if (ids.has(node.id)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Trùng id node ${node.id}` });
      ids.add(node.id);
    }
    const linked = new Set<string>();
    for (const edge of dsl.edges) {
      if (!ids.has(edge.from) || !ids.has(edge.to)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Cạnh trỏ tới node không có: ${edge.from} → ${edge.to}` });
      }
      if (edge.from === edge.to) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Cạnh tự vòng ở ${edge.from}` });
      linked.add(edge.from);
      linked.add(edge.to);
    }
    // §12: không node mồ côi (sơ đồ 1 node thì không cần cạnh)
    if (dsl.nodes.length > 1) {
      for (const node of dsl.nodes) {
        if (!linked.has(node.id)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Node mồ côi ${node.id}` });
      }
    }
  });

export type DiagramDsl = z.infer<typeof diagramDslSchema>;

// Chuỗi Gemini trả → DSL đã kiểm. Mã lỗi ghi vào ai_requests.errorCode (spec §7.2)
export function parseDiagramDsl(
  text: string,
): { ok: true; dsl: DiagramDsl } | { ok: false; errorCode: 'BAD_JSON' | 'BAD_DSL' } {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, errorCode: 'BAD_JSON' };
  }
  const result = diagramDslSchema.safeParse(raw);
  return result.success ? { ok: true, dsl: result.data } : { ok: false, errorCode: 'BAD_DSL' };
}
