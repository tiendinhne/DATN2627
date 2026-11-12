// Dựng element Excalidraw từ kết quả AI (spec AI §8.3). Chỉ trình duyệt người yêu cầu gọi, đúng 1 lần mỗi requestId
// → mọi client nhận cùng id / version / versionNonce qua wb:ops (spec §1 câu 5). Hàm này KHÔNG đụng tới bảng
import type { ExcalidrawElementSkeleton, ValidLinearElement } from "@excalidraw/excalidraw/data/transform";
import type { OrderedExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import type { AiDiagram } from "@shared/ai";

// Thư viện Excalidraw đã import động ở useWhiteboardSync (không import tĩnh — Excalidraw cần window)
type ExcalidrawLib = typeof import("@excalidraw/excalidraw");

// Khoảng cách từ mép phải nội dung đang có tới sơ đồ mới (px)
const GAP = 100;

export function buildAiElements(
  lib: ExcalidrawLib,
  diagram: AiDiagram,
  existing: readonly OrderedExcalidrawElement[]
): OrderedExcalidrawElement[] {
  // 1. Vùng trống bên phải bounding box của element chưa xoá; bảng trống → (0, 0)
  const alive = existing.filter((element) => !element.isDeleted);
  let offsetX = 0;
  let offsetY = 0;
  if (alive.length > 0) {
    const [, minY, maxX] = lib.getCommonBounds(alive);
    offsetX = maxX + GAP;
    offsetY = minY;
  }

  // 2. Khung: có sẵn width / height thì Excalidraw giữ kích thước; nhãn tự xuống dòng theo khung, chữ cao hơn thì khung tự cao lên
  const nodes: ExcalidrawElementSkeleton[] = diagram.nodes.map((node) => ({
    type: node.shape,
    id: node.id,
    x: node.x + offsetX,
    y: node.y + offsetY,
    width: node.width,
    height: node.height,
    label: { text: node.label },
  }));

  // Mũi tên: x, y = điểm đầu đã dời; points tương đối với điểm đầu ([0, 0] trước). start / end gắn vào khung theo id
  const arrows: ValidLinearElement[] = diagram.edges.map((edge) => {
    const [startX, startY] = edge.points[0];
    return {
      type: "arrow",
      x: startX + offsetX,
      y: startY + offsetY,
      // LocalPoint của Excalidraw là tuple [x, y] có "brand" kiểu → ép kiểu
      points: edge.points.map(([x, y]) => [x - startX, y - startY]) as unknown as ValidLinearElement["points"],
      start: { id: edge.from },
      end: { id: edge.to },
      label: edge.label ? { text: edge.label } : undefined,
    };
  });

  // 3. regenerateIds mặc định true: id n1, n2 của DSL chỉ để nối mũi tên; element thật nhận id mới, không trùng sơ đồ khác
  return lib.convertToExcalidrawElements([...nodes, ...arrows]);
}
