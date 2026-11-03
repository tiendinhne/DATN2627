// Hằng số whiteboard dùng chung backend (validate) + frontend (lọc, chia batch) — frontend import qua @shared/whiteboard (ADR-024)
// Chỉ hằng số, không code NestJS / React (spec whiteboard_sync_spec.md §6)

// Loại element được đồng bộ. Chặn: image (spec ảnh làm sau), embeddable / iframe (nhúng URL tuỳ ý), selection, magicframe
export const WB_ELEMENT_TYPES: readonly string[] = [
  'rectangle',
  'diamond',
  'ellipse',
  'arrow',
  'line',
  'freedraw',
  'text',
  'frame',
];

// Mỗi lần gửi wb:ops: tối đa 100 element, JSON ≤ 512 KB (dưới trần 1 MB mặc định của Socket.IO)
export const WB_MAX_BATCH_ELEMENTS = 100;
export const WB_MAX_BATCH_BYTES = 512 * 1024;

// Giới hạn 1 board: 5.000 element còn hiển thị (ADR-014), 20.000 tính cả tombstone (chống phình Redis)
export const WB_MAX_ALIVE_ELEMENTS = 5000;
export const WB_MAX_TOTAL_ELEMENTS = 20000;
