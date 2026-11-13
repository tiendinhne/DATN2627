import ELK from 'elkjs/lib/elk.bundled.js';
import { AiRequestKind } from '../../../shared/enums.js';
import type { AiDiagram, AiShape } from '../../../shared/ai.js';
import type { DiagramDsl } from '../domain/diagram-dsl.js';

// Số liệu chữ Excalidraw 0.18.1 (spec §6.2): cỡ 20, Excalifont lineHeight 1,25 → 25 px/dòng; đệm chữ trong khung 5 px
const LINE_HEIGHT = 25;
const PADDING = 5;
// Bề rộng trung bình 1 ký tự ở cỡ 20 (px) — ƯỚC LƯỢNG, chốt sau khi đo thật (spec §10.2, plan Task 8)
export const CHAR_PX = 12;

// Bề rộng cố định + công thức chiều cao theo hình, suy từ getBoundTextMaxWidth / getBoundTextMaxHeight của Excalidraw
const SHAPES: Record<
  AiShape,
  { width: number; textWidth: number; minHeight: number; heightFor: (textHeight: number) => number }
> = {
  rectangle: { width: 200, textWidth: 190, minHeight: 60, heightFor: (h) => h + 2 * PADDING },
  ellipse: { width: 240, textWidth: 160, minHeight: 70, heightFor: (h) => Math.ceil((h + 2 * PADDING) * Math.SQRT2) },
  diamond: { width: 280, textWidth: 130, minHeight: 80, heightFor: (h) => 2 * (h + 2 * PADDING) },
};

// Khoảng cách giữa node (px) — rộng để phần Excalidraw tự kéo cao khung không đè node bên cạnh (spec §6.1)
const NODE_SPACING = 60;
const LAYER_SPACING = 80;

// Flowchart / sơ đồ đi từ trên xuống, mindmap toả sang phải. Hướng mặc định của layered là RIGHT → luôn đặt rõ
const DIRECTION: Record<AiRequestKind, 'DOWN' | 'RIGHT'> = {
  [AiRequestKind.FLOWCHART]: 'DOWN',
  [AiRequestKind.DIAGRAM]: 'DOWN',
  [AiRequestKind.MINDMAP]: 'RIGHT',
};

// Kích thước node: rộng cố định theo hình, cao theo số dòng ước lượng (Excalidraw tự kéo cao nếu ước lượng thiếu)
export function nodeSize(shape: AiShape, label: string): { width: number; height: number } {
  const spec = SHAPES[shape];
  const lines = Math.max(1, Math.ceil((label.length * CHAR_PX) / spec.textWidth));
  return { width: spec.width, height: Math.max(spec.minHeight, spec.heightFor(lines * LINE_HEIGHT)) };
}

// DSL đã kiểm → toạ độ node + đường cạnh (thuật toán layered). Lỗi → ném, service ghi LAYOUT_FAILED
export async function layoutDiagram(dsl: DiagramDsl, kind: AiRequestKind): Promise<AiDiagram> {
  // elkjs là gói CommonJS: với module nodenext phải gọi .default (spec §6.1 — đã kiểm tsc + chạy thật)
  const graph = await new ELK.default().layout({
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': DIRECTION[kind],
      'elk.spacing.nodeNode': String(NODE_SPACING),
      'elk.layered.spacing.nodeNodeBetweenLayers': String(LAYER_SPACING),
    },
    children: dsl.nodes.map((node) => ({ id: node.id, ...nodeSize(node.shape, node.label) })),
    edges: dsl.edges.map((edge, index) => ({ id: `e${index}`, sources: [edge.from], targets: [edge.to] })),
  });

  const placed = new Map((graph.children ?? []).map((child) => [child.id, child]));
  const nodes = dsl.nodes.map((node) => {
    const box = placed.get(node.id);
    if (!box || !Number.isFinite(box.x) || !Number.isFinite(box.y)) {
      throw new Error(`elkjs không trả toạ độ node ${node.id}`);
    }
    return { id: node.id, label: node.label, shape: node.shape, x: box.x!, y: box.y!, width: box.width!, height: box.height! };
  });

  const routed = new Map((graph.edges ?? []).map((edge) => [edge.id, edge]));
  const edges = dsl.edges.map((edge, index) => {
    const section = routed.get(`e${index}`)?.sections?.[0];
    if (!section) throw new Error(`elkjs không trả đường cạnh e${index}`);
    const points = [section.startPoint, ...(section.bendPoints ?? []), section.endPoint].map(
      (point): [number, number] => [point.x, point.y],
    );
    return { from: edge.from, to: edge.to, ...(edge.label ? { label: edge.label } : {}), points };
  });

  return { nodes, edges };
}
