// Hằng số + kiểu module AI dùng chung backend (validate) và frontend (giao diện, chèn sơ đồ) — frontend import qua @shared/ai (ADR-024)
// Chỉ hằng số và kiểu, không import gì — giống shared/whiteboard.ts (spec AI §8.1)

// Độ dài yêu cầu người dùng nhập (spec §3.1)
export const AI_PROMPT_MIN_LENGTH = 3;
export const AI_PROMPT_MAX_LENGTH = 1000;

// Giới hạn DSL do AI trả về (PROJECT_CONTEXT §12; số cạnh: spec §4 [phát sinh kỹ thuật])
export const AI_MAX_NODES = 40;
export const AI_MAX_EDGES = 80;
export const AI_MAX_LABEL_LENGTH = 80;

// Ba loại hình node AI được dùng — trùng tên type của Excalidraw
export const AI_SHAPES = ['rectangle', 'ellipse', 'diamond'] as const;
export type AiShape = (typeof AI_SHAPES)[number];

// Kết quả backend gửi trong ai:result (spec §6.3): node đã có toạ độ (elkjs), cạnh là danh sách điểm tuyệt đối (≥ 2 điểm)
export interface AiDiagramNode {
  id: string;
  label: string;
  shape: AiShape;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface AiDiagramEdge {
  from: string;
  to: string;
  label?: string;
  points: [number, number][];
}

export interface AiDiagram {
  nodes: AiDiagramNode[];
  edges: AiDiagramEdge[];
}
