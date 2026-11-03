import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createClient } from 'redis';
import { WB_APPLY_SCRIPT } from './whiteboard.lua.js';

// Chạy trên Redis THẬT (container redis-dev, cổng 6379). Không kết nối được → FAIL, không skip (spec §10.1).
// CI sau này cần `services: redis` (spec §10.3)
const client = createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379' });
const prefix = `test:wb:${process.pid}:${Date.now()}:`;
const keys = [`${prefix}hash`, `${prefix}seq`, `${prefix}alive`];

type El = { id: string; version: number; versionNonce: number; isDeleted?: boolean; [key: string]: unknown };

// Gọi script giống WhiteboardService.applyOps
function apply(elements: El[], maxAlive = 5000, maxTotal = 20000) {
  const args = [String(maxAlive), String(maxTotal), '60'];
  for (const e of elements) {
    const full = { isDeleted: false, ...e };
    args.push(e.id, String(e.version), String(e.versionNonce), full.isDeleted ? '1' : '0', JSON.stringify(full));
  }
  return client.eval(WB_APPLY_SCRIPT, { keys, arguments: args });
}
const stored = async (id: string) => JSON.parse((await client.hGet(keys[0], id)) ?? 'null');
const alive = async () => Number(await client.get(keys[2]));
const seq = async () => Number(await client.get(keys[1]));

beforeAll(async () => {
  await client.connect();
});
beforeEach(async () => {
  await client.del(keys);
});
afterAll(async () => {
  await client.del(keys);
  await client.quit();
});

describe('wb-apply — luật LWW giống shouldDiscardRemoteElement (Excalidraw 0.18.1)', () => {
  it('element mới → OK, seq 1, chỉ số 0, lưu nguyên JSON', async () => {
    expect(await apply([{ id: 'a', version: 1, versionNonce: 5, x: 10 }])).toEqual(['OK', 1, 0]);
    expect(await stored('a')).toEqual({ id: 'a', version: 1, versionNonce: 5, x: 10, isDeleted: false });
  });

  it('version cao hơn → thắng', async () => {
    await apply([{ id: 'a', version: 1, versionNonce: 5 }]);
    expect(await apply([{ id: 'a', version: 2, versionNonce: 99 }])).toEqual(['OK', 2, 0]);
    expect((await stored('a')).version).toBe(2);
  });

  it('version thấp hơn → thua, NOOP, seq không tăng', async () => {
    await apply([{ id: 'a', version: 2, versionNonce: 5 }]);
    expect(await apply([{ id: 'a', version: 1, versionNonce: 1 }])).toEqual(['NOOP']);
    expect(await seq()).toBe(1);
    expect((await stored('a')).version).toBe(2);
  });

  it('cùng version, nonce bản tới nhỏ hơn → thắng', async () => {
    await apply([{ id: 'a', version: 2, versionNonce: 50 }]);
    expect(await apply([{ id: 'a', version: 2, versionNonce: 40 }])).toEqual(['OK', 2, 0]);
    expect((await stored('a')).versionNonce).toBe(40);
  });

  it('cùng version, nonce bản tới lớn hơn → thua', async () => {
    await apply([{ id: 'a', version: 2, versionNonce: 50 }]);
    expect(await apply([{ id: 'a', version: 2, versionNonce: 60 }])).toEqual(['NOOP']);
  });

  it('cùng version, cùng nonce → nhận bản tới (dấu <, không phải <=)', async () => {
    await apply([{ id: 'a', version: 2, versionNonce: 50, tag: 'old' }]);
    expect(await apply([{ id: 'a', version: 2, versionNonce: 50, tag: 'new' }])).toEqual(['OK', 2, 0]);
    expect((await stored('a')).tag).toBe('new');
  });

  it('batch lẫn thắng / thua → chỉ trả chỉ số element thắng', async () => {
    await apply([{ id: 'a', version: 2, versionNonce: 5 }]);
    expect(await apply([{ id: 'a', version: 1, versionNonce: 5 }, { id: 'b', version: 1, versionNonce: 5 }])).toEqual(['OK', 2, 1]);
  });
});

describe('wb-apply — giới hạn và đếm element còn hiển thị', () => {
  it('vượt maxAlive → LIMIT, không ghi gì', async () => {
    await apply([{ id: 'a', version: 1, versionNonce: 1 }, { id: 'b', version: 1, versionNonce: 1 }], 2);
    expect(await apply([{ id: 'c', version: 1, versionNonce: 1 }], 2)).toEqual(['LIMIT']);
    expect(await client.hLen(keys[0])).toBe(2);
    expect(await alive()).toBe(2);
    expect(await seq()).toBe(1);
  });

  it('tombstone không tính: xoá hết rồi thêm mới vẫn được', async () => {
    await apply([{ id: 'a', version: 1, versionNonce: 1 }, { id: 'b', version: 1, versionNonce: 1 }], 2);
    await apply([{ id: 'a', version: 2, versionNonce: 1, isDeleted: true }, { id: 'b', version: 2, versionNonce: 1, isDeleted: true }], 2);
    expect(await alive()).toBe(0);
    expect(await apply([{ id: 'c', version: 1, versionNonce: 1 }, { id: 'd', version: 1, versionNonce: 1 }], 2)).toEqual(['OK', 3, 0, 1]);
    expect(await alive()).toBe(2);
  });

  it('đếm alive đúng ở 4 chuyển trạng thái, bản thua không đổi', async () => {
    await apply([{ id: 'a', version: 1, versionNonce: 1 }]); // mới, sống: +1
    expect(await alive()).toBe(1);
    await apply([{ id: 'b', version: 1, versionNonce: 1, isDeleted: true }]); // mới, đã xoá: 0
    expect(await alive()).toBe(1);
    await apply([{ id: 'a', version: 2, versionNonce: 1, isDeleted: true }]); // sống → xoá: −1
    expect(await alive()).toBe(0);
    await apply([{ id: 'a', version: 3, versionNonce: 1 }]); // xoá → sống: +1
    expect(await alive()).toBe(1);
    await apply([{ id: 'a', version: 1, versionNonce: 1, isDeleted: true }]); // thua: không đổi
    expect(await alive()).toBe(1);
  });

  it('bộ đếm đã vượt giới hạn → batch chỉ sửa / xoá vẫn qua, thêm mới bị chặn', async () => {
    await apply([{ id: 'a', version: 1, versionNonce: 1 }, { id: 'b', version: 1, versionNonce: 1 }], 5);
    // Giả lập giới hạn bị hạ xuống dưới số đang có (maxAlive 1, maxTotal 1)
    expect((await apply([{ id: 'a', version: 2, versionNonce: 1 }], 1, 1))[0]).toBe('OK');
    expect((await apply([{ id: 'b', version: 2, versionNonce: 1, isDeleted: true }], 1, 1))[0]).toBe('OK');
    expect(await apply([{ id: 'c', version: 1, versionNonce: 1 }], 1, 1)).toEqual(['LIMIT']);
  });

  it('bảng đầy vẫn sửa và xoá được', async () => {
    await apply([{ id: 'a', version: 1, versionNonce: 1 }], 1);
    expect((await apply([{ id: 'a', version: 2, versionNonce: 1 }], 1))[0]).toBe('OK');
    expect((await apply([{ id: 'a', version: 3, versionNonce: 1, isDeleted: true }], 1))[0]).toBe('OK');
  });

  it('vượt maxTotal (tính cả tombstone) → LIMIT', async () => {
    await apply([{ id: 'a', version: 1, versionNonce: 1 }, { id: 'b', version: 1, versionNonce: 1, isDeleted: true }], 5000, 2);
    expect(await apply([{ id: 'c', version: 1, versionNonce: 1 }], 5000, 2)).toEqual(['LIMIT']);
  });

  it('có element thắng → cả 3 key có TTL', async () => {
    await apply([{ id: 'a', version: 1, versionNonce: 1 }]);
    for (const key of keys) {
      expect(await client.ttl(key)).toBeGreaterThan(0);
    }
  });
});
