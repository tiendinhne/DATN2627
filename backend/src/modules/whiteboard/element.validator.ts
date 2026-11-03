import { WB_ELEMENT_TYPES, WB_MAX_BATCH_BYTES, WB_MAX_BATCH_ELEMENTS } from '../../shared/whiteboard.js';

// Element Excalidraw — server chỉ đọc 5 field này, các field còn lại lưu nguyên
export interface WbElement {
  id: string;
  type: string;
  version: number;
  versionNonce: number;
  isDeleted: boolean;
  [key: string]: unknown;
}

// id của Excalidraw là chuỗi kiểu nanoid
const ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

// Kiểm tay từng element — không dùng DTO lồng vì whitelist sẽ xoá / từ chối hàng chục field của Excalidraw (spec §6)
export function isValidElement(value: unknown): value is WbElement {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const e = value as Record<string, unknown>;
  return (
    typeof e.id === 'string' &&
    ID_PATTERN.test(e.id) &&
    Number.isSafeInteger(e.version) &&
    (e.version as number) >= 1 &&
    Number.isSafeInteger(e.versionNonce) &&
    typeof e.isDeleted === 'boolean' &&
    typeof e.type === 'string' &&
    WB_ELEMENT_TYPES.includes(e.type)
  );
}

// Kiểm cả batch wb:ops. Trả về thông báo lỗi, hoặc null nếu hợp lệ. 1 element sai → cả batch bị từ chối
export function validateElementsBatch(elements: unknown[]): string | null {
  if (elements.length < 1 || elements.length > WB_MAX_BATCH_ELEMENTS) {
    return `Mỗi lần gửi từ 1 đến ${WB_MAX_BATCH_ELEMENTS} đối tượng`;
  }
  const ids = new Set<string>();
  for (const element of elements) {
    if (!isValidElement(element)) return 'Đối tượng bảng vẽ không hợp lệ';
    if (ids.has(element.id)) return 'Trùng id đối tượng trong cùng một lần gửi';
    ids.add(element.id);
  }
  // Đếm byte UTF-8 (giới hạn của Socket.IO tính theo byte), không đếm ký tự
  if (Buffer.byteLength(JSON.stringify(elements)) > WB_MAX_BATCH_BYTES) {
    return 'Dữ liệu bảng vẽ gửi lên quá lớn';
  }
  return null;
}
