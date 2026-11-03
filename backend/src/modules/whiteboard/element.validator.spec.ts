import { describe, expect, it } from 'vitest';
import { isValidElement, validateElementsBatch } from './element.validator.js';
import { WB_MAX_BATCH_BYTES, WB_MAX_BATCH_ELEMENTS } from '../../shared/whiteboard.js';

// Element tối thiểu Excalidraw gửi lên; field khác (x, y, strokeColor…) không kiểm, giữ nguyên
function el(overrides: Record<string, unknown> = {}) {
  return { id: 'abc_DEF-123', type: 'rectangle', version: 3, versionNonce: 12345, isDeleted: false, x: 0, y: 0, ...overrides };
}

describe('isValidElement', () => {
  it('nhận element hợp lệ, không quan tâm field khác của Excalidraw', () => {
    expect(isValidElement(el({ strokeColor: '#000', groupIds: [], customData: { a: 1 } }))).toBe(true);
  });

  it.each(['rectangle', 'diamond', 'ellipse', 'arrow', 'line', 'freedraw', 'text', 'frame'])('nhận type %s', (type) => {
    expect(isValidElement(el({ type }))).toBe(true);
  });

  it.each([
    ['null', null],
    ['mảng', [el()]],
    ['chuỗi', 'rectangle'],
    ['thiếu version', el({ version: undefined })],
    ['version 0', el({ version: 0 })],
    ['version không nguyên', el({ version: 1.5 })],
    ['versionNonce là chuỗi', el({ versionNonce: '1' })],
    ['version 2^53', el({ version: 2 ** 53 })],
    ['versionNonce 2^53', el({ versionNonce: 2 ** 53 })],
    ['isDeleted là chuỗi', el({ isDeleted: 'false' })],
    ['id có khoảng trắng', el({ id: 'a b' })],
    ['id rỗng', el({ id: '' })],
    ['id 65 ký tự', el({ id: 'a'.repeat(65) })],
    ['type image', el({ type: 'image' })],
    ['type iframe', el({ type: 'iframe' })],
    ['type embeddable', el({ type: 'embeddable' })],
    ['type selection', el({ type: 'selection' })],
    ['type magicframe', el({ type: 'magicframe' })],
  ])('từ chối: %s', (_name, value) => {
    expect(isValidElement(value)).toBe(false);
  });
});

describe('validateElementsBatch', () => {
  it('batch hợp lệ → null', () => {
    expect(validateElementsBatch([el(), el({ id: 'x2' })])).toBeNull();
  });

  it('mảng rỗng → lỗi', () => {
    expect(validateElementsBatch([])).not.toBeNull();
  });

  it(`${WB_MAX_BATCH_ELEMENTS + 1} element → lỗi`, () => {
    const batch = Array.from({ length: WB_MAX_BATCH_ELEMENTS + 1 }, (_, i) => el({ id: `e${i}` }));
    expect(validateElementsBatch(batch)).not.toBeNull();
  });

  it('trùng id trong cùng batch → lỗi', () => {
    expect(validateElementsBatch([el(), el()])).not.toBeNull();
  });

  it('1 element sai → cả batch lỗi', () => {
    expect(validateElementsBatch([el(), el({ id: 'x2', type: 'embeddable' })])).not.toBeNull();
  });

  it('quá 512 KB → lỗi', () => {
    expect(validateElementsBatch([el({ type: 'text', text: 'x'.repeat(WB_MAX_BATCH_BYTES) })])).not.toBeNull();
  });

  it('đếm byte UTF-8, không đếm ký tự (chữ có dấu 3 byte)', () => {
    // 'ệ' = 3 byte UTF-8 → ~262k ký tự nhưng ~786 KB
    expect(validateElementsBatch([el({ type: 'text', text: 'ệ'.repeat(WB_MAX_BATCH_BYTES / 2) })])).not.toBeNull();
  });
});
