/**
 * Tập con của Excalidraw element mà server cần biết để merge.
 * Server KHÔNG cần hiểu toàn bộ shape của Excalidraw — chỉ cần 4 field đầu.
 */
export interface WbElement {
  id: string;
  /** tăng mỗi lần element bị sửa */
  version: number;
  /** tie-break khi hai client cùng version */
  versionNonce: number;
  /** tombstone — KHÔNG xoá khỏi mảng, để LWW hoạt động đúng */
  isDeleted?: boolean;
  [key: string]: unknown;
}

export const MAX_ELEMENTS_PER_BOARD = 5000;
