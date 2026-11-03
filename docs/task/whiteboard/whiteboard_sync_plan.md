# Whiteboard — đồng bộ realtime + lưu trữ (phần lõi) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Nhiều thành viên cùng vẽ trên board của một meeting, thấy thay đổi của nhau với độ trễ thấp nhất, đúng khi ≥2 instance, board lưu xuống Mongo và lưu bản cuối khi meeting kết thúc.

**Architecture:** Client Excalidraw throttle 50 ms gửi element đổi version qua Socket.IO `wb:ops`. Gateway validate → script Lua `wb-apply` merge LWW atomic vào Redis Hash → phát element thắng tới kênh `meeting:{id}` (Redis adapter) → giành khoá `SET NX PX 15000` để persist Mongo nền. `endMeeting` ép socket rời kênh rồi lưu bản cuối.

**Tech Stack:** NestJS 11 ESM · Socket.IO 4.8 + `@socket.io/redis-adapter` · node-redis 4.7.1 (`client.eval`) · Mongoose · Next.js 15 + `@excalidraw/excalidraw` 0.18.1 · vitest 4.

**Spec:** `docs/task/whiteboard/whiteboard_sync_spec.md` — đọc cùng plan này. Mọi "§n" trong plan là section của spec, trừ khi ghi rõ PROJECT_CONTEXT.

## Global Constraints

- Import tương đối trong backend kết thúc bằng `.js` (ESM, ràng buộc #1).
- Mọi emit server → client đi qua `RealtimePublisher`, envelope `{ v: 1, seq, ts, actorId, roomId, meetingId, data }` (ràng buộc #6).
- Không `Map` / `Set` / biến module giữ state theo user / room ở **server** (ràng buộc #5). `socket.data` / `socket.rooms` là state của kết nối, được phép.
- Validate mọi payload socket bằng `validatePayload` có sẵn của gateway (ràng buộc #3).
- **Không thêm dependency** (backend và frontend). `socket.io-client` của script đo lấy từ `frontend/node_modules`.
- Lệnh `npm` / `npx` chạy bằng **PowerShell**, không Bash.
- Ghi chú trong code: tiếng Việt, ngắn, giống file xung quanh.
- Hằng số: `WB_MAX_BATCH_ELEMENTS = 100`, `WB_MAX_BATCH_BYTES = 512 * 1024`, `WB_MAX_ALIVE_ELEMENTS = 5000`, `WB_MAX_TOTAL_ELEMENTS = 20000`, TTL key Redis `86400` s, khoá persist `15000` ms, throttle client `50` ms, con trỏ im `5000` ms.
- Type element cho phép: `rectangle, diamond, ellipse, arrow, line, freedraw, text, frame`.
- Luật LWW (Excalidraw 0.18.1 `shouldDiscardRemoteElement`, dấu `<`): **bỏ bản tới** khi `stored.version > in.version` **hoặc** (`stored.version == in.version` **và** `stored.versionNonce < in.versionNonce`).
- Backend trong Docker **không hot reload** trên Windows (progress 2026-11-02) → sau khi sửa `backend/src`: `docker compose restart backend`; sửa `package.json` thì `docker compose up -d --build backend`.
- **Commit:** user tự duyệt. Bước "Commit" = báo user + đề xuất message; chỉ chạy `git commit` khi user đồng ý. Message kết thúc bằng dòng `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Code plan có thể sai** (memory "Soát + chạy thật code của plan"): test chép nguyên văn; code phải đối chiếu `.d.ts` / mã thư viện đã cài và chạy thật. Sửa code plan → ghi vào progress + chú thích ngay trong plan.

## File Structure

| File | Trách nhiệm |
|---|---|
| `backend/src/shared/whiteboard.ts` (mới) | Hằng số dùng chung server (validate) + client (lọc, chia batch) — ADR-024 |
| `backend/src/modules/whiteboard/element.validator.ts` (mới) | `isValidElement`, `validateElementsBatch` |
| `backend/src/modules/whiteboard/whiteboard.lua.ts` (mới) | Chuỗi script `WB_APPLY_SCRIPT` |
| `backend/src/modules/whiteboard/whiteboard.service.ts` (mới) | `assertCanJoin`, `getSnapshot`, `applyOps`, `tryPersistInBackground`, `persist`, `finalizeBoard` |
| `backend/src/modules/whiteboard/dto/whiteboard-events.dto.ts` (mới) | `MeetingIdDto`, `WbOpsDto`, `WbPointerDto` |
| `backend/src/modules/whiteboard/whiteboard.module.ts` (sửa) | Đăng ký model Meeting, `WhiteboardService`, export |
| `backend/src/modules/realtime/realtime-publisher.service.ts` (sửa) | `sendSnapshot`, `publishWbOps`, `publishWbPointer`, `leaveMeeting`, `closeMeetingChannel` |
| `backend/src/modules/realtime/gateways/meeting.gateway.ts` (sửa) | 4 handler `meeting:join`, `meeting:leave`, `wb:ops`, `wb:pointer` |
| `backend/src/modules/realtime/realtime.module.ts` (sửa) | import `WhiteboardModule` |
| `backend/src/modules/meetings/meetings.service.ts` (sửa) | `endMeeting` → `closeBoard`; `removeFromActiveMeeting` → `leaveMeeting` |
| `backend/src/modules/meetings/meetings.module.ts` (sửa) | import `WhiteboardModule`, `RealtimeModule` |
| `frontend/src/features/whiteboard/hooks/useWhiteboardSync.ts` (mới) | Socket, gửi / nhận element, con trỏ |
| `frontend/src/features/whiteboard/components/WhiteboardCanvas.tsx` (sửa) | Giữ `excalidrawAPI`, gắn hook, `aiEnabled={false}`, tắt ảnh, thông báo |
| `frontend/src/features/meeting/components/MeetingWorkspace.tsx` (sửa) | Truyền `token`, `meetingId` |
| `frontend/src/features/whiteboard/types.ts` (xoá), `index.ts` (sửa) | Bỏ type mock không ai dùng |
| `tests/load/wb-latency.mjs` (mới) | Đo độ trễ kịch bản A, B |

Phụ thuộc module (không vòng): `Realtime → Whiteboard`; `Meetings → Whiteboard, Realtime`; `Rooms → Realtime, Meetings` (đã có).

---

### Task 1: Hằng số dùng chung + kiểm element

**Files:**
- Create: `backend/src/shared/whiteboard.ts`
- Create: `backend/src/modules/whiteboard/element.validator.ts`
- Test: `backend/src/modules/whiteboard/element.validator.spec.ts`

**Interfaces:**
- Produces: `WB_ELEMENT_TYPES: readonly string[]`, `WB_MAX_BATCH_ELEMENTS`, `WB_MAX_BATCH_BYTES`, `WB_MAX_ALIVE_ELEMENTS`, `WB_MAX_TOTAL_ELEMENTS` (number); `interface WbElement { id: string; type: string; version: number; versionNonce: number; isDeleted: boolean; [key: string]: unknown }`; `isValidElement(value: unknown): value is WbElement`; `validateElementsBatch(elements: unknown[]): string | null` (null = hợp lệ, chuỗi = thông báo lỗi).

- [ ] **Step 1: Viết test (fail)**

`backend/src/modules/whiteboard/element.validator.spec.ts`:

```ts
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
```

- [ ] **Step 2: Chạy test, thấy fail**

```powershell
Set-Location backend; npx vitest run src/modules/whiteboard/element.validator.spec.ts
```
Expected: FAIL — `Failed to resolve import "./element.validator.js"`.

- [ ] **Step 3: Viết code**

`backend/src/shared/whiteboard.ts`:

```ts
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
```

`backend/src/modules/whiteboard/element.validator.ts`:

```ts
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
    Number.isInteger(e.version) &&
    (e.version as number) >= 1 &&
    Number.isInteger(e.versionNonce) &&
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
```

- [ ] **Step 4: Chạy test, thấy pass**

```powershell
Set-Location backend; npx vitest run src/modules/whiteboard/element.validator.spec.ts
```
Expected: PASS — 32 test (`isValidElement` 1 + 8 + 16, `validateElementsBatch` 7).

- [ ] **Step 5: Ghi progress + đề xuất commit**

Thêm vào `docs/progress.md` mục "Whiteboard: Task 1" (đã xong gì, số test pass, lệch plan nếu có). Đề xuất: `feat: hằng số whiteboard dùng chung và kiểm element`.

---

### Task 2: Script Lua `wb-apply` (test trên Redis thật)

**Files:**
- Create: `backend/src/modules/whiteboard/whiteboard.lua.ts`
- Test: `backend/src/modules/whiteboard/whiteboard.lua.spec.ts`

**Interfaces:**
- Produces: `WB_APPLY_SCRIPT: string`. Gọi: `client.eval(WB_APPLY_SCRIPT, { keys: [hash, seq, alive], arguments: [maxAlive, maxTotal, ttlSeconds, ...mỗi element 5 giá trị id, version, versionNonce, isDeleted ('0'|'1'), json] })`. Trả về `['LIMIT']` · `['NOOP']` · `['OK', seq: number, ...idx: number[]]` (idx từ 0).

> Script đã chạy thử bằng `redis-cli --eval` trên `redis-dev` lúc viết plan (2026-11-03): mới / version cũ thua / cùng version nonce lớn thua / nonce nhỏ thắng / nonce bằng nhận bản tới / vượt maxAlive / xoá → alive 0 / batch lẫn thắng thua / vượt maxTotal — đều đúng.

- [ ] **Step 1: Viết test (fail)**

`backend/src/modules/whiteboard/whiteboard.lua.spec.ts`:

```ts
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
```

- [ ] **Step 2: Chạy test, thấy fail**

Container `redis-dev` phải đang chạy (`docker compose up -d redis`).

```powershell
Set-Location backend; npx vitest run src/modules/whiteboard/whiteboard.lua.spec.ts
```
Expected: FAIL — `Failed to resolve import "./whiteboard.lua.js"`.

- [ ] **Step 3: Viết code**

`backend/src/modules/whiteboard/whiteboard.lua.ts`:

```ts
// Script Lua wb-apply — merge LWW batch element vào Redis Hash, atomic (spec whiteboard_sync_spec.md §4.2).
// Redis chạy từng script một → 2 instance cùng ghi 1 board không mất op.
// KEYS[1] = wb:{meetingId} (Hash id → JSON) · KEYS[2] = wb:seq:{meetingId} · KEYS[3] = wb:alive:{meetingId}
// ARGV[1] = maxAlive · ARGV[2] = maxTotal · ARGV[3] = ttlSeconds
// ARGV[4..] = mỗi element 5 giá trị: id, version, versionNonce, isDeleted ('0'|'1'), json
// Trả về: {'LIMIT'} · {'NOOP'} · {'OK', seq, idx…} (idx = vị trí element thắng trong batch, đếm từ 0)
export const WB_APPLY_SCRIPT = `
local maxAlive = tonumber(ARGV[1])
local maxTotal = tonumber(ARGV[2])
local ttl = tonumber(ARGV[3])
local winners = {}
local aliveDelta = 0
local newIds = 0

-- Lượt 1: tính thắng / thua và thay đổi số element còn hiển thị, CHƯA ghi gì
local i = 0
for a = 4, #ARGV, 5 do
  local version = tonumber(ARGV[a + 1])
  local nonce = tonumber(ARGV[a + 2])
  local deleted = ARGV[a + 3] == '1'
  local stored = redis.call('HGET', KEYS[1], ARGV[a])
  local wins
  if not stored then
    wins = true
    newIds = newIds + 1
    if not deleted then aliveDelta = aliveDelta + 1 end
  else
    local s = cjson.decode(stored)
    -- Luật shouldDiscardRemoteElement của Excalidraw 0.18.1: bỏ bản tới khi bản đang lưu mới hơn
    wins = not (s.version > version or (s.version == version and s.versionNonce < nonce))
    if wins then
      local storedDeleted = s.isDeleted == true
      if storedDeleted and not deleted then aliveDelta = aliveDelta + 1 end
      if not storedDeleted and deleted then aliveDelta = aliveDelta - 1 end
    end
  end
  if wins then winners[#winners + 1] = i end
  i = i + 1
end

-- Kiểm giới hạn trước khi ghi: 5.000 element còn hiển thị, 20.000 tính cả tombstone
local alive = tonumber(redis.call('GET', KEYS[3]) or '0')
if alive + aliveDelta > maxAlive or redis.call('HLEN', KEYS[1]) + newIds > maxTotal then
  return {'LIMIT'}
end
if #winners == 0 then return {'NOOP'} end

-- Lượt 2: ghi element thắng (lưu nguyên chuỗi JSON, không encode lại), cập nhật đếm, seq, TTL
for _, idx in ipairs(winners) do
  local a = 4 + idx * 5
  redis.call('HSET', KEYS[1], ARGV[a], ARGV[a + 4])
end
redis.call('INCRBY', KEYS[3], aliveDelta)
local seq = redis.call('INCR', KEYS[2])
redis.call('EXPIRE', KEYS[1], ttl)
redis.call('EXPIRE', KEYS[2], ttl)
redis.call('EXPIRE', KEYS[3], ttl)
local result = {'OK', seq}
for _, idx in ipairs(winners) do result[#result + 1] = idx end
return result
`;
```

- [ ] **Step 4: Chạy test, thấy pass**

```powershell
Set-Location backend; npx vitest run src/modules/whiteboard/whiteboard.lua.spec.ts
```
Expected: PASS — 13 test. Sau đó `docker exec redis-dev redis-cli --scan --pattern "test:wb:*"` không còn key nào.

- [ ] **Step 5: Ghi progress + đề xuất commit**

Progress mục "Whiteboard: Task 2". Đề xuất: `feat: script Lua wb-apply merge LWW whiteboard trong Redis`.

---

### Task 3: `WhiteboardService` + module

**Files:**
- Create: `backend/src/modules/whiteboard/whiteboard.service.ts`
- Modify: `backend/src/modules/whiteboard/whiteboard.module.ts`
- Test: `backend/src/modules/whiteboard/whiteboard.service.spec.ts`

**Interfaces:**
- Consumes: `WB_APPLY_SCRIPT` (Task 2); `WbElement` (Task 1); `RoomAccessService.assertRoomAccess(userId, roomId)`; `RedisService.getClient()`.
- Produces (class `WhiteboardService`):
  - `assertCanJoin(userId: string, meetingId: string): Promise<{ roomId: string }>` — 404 / lỗi của `assertRoomAccess` / 409
  - `getSnapshot(meetingId: string): Promise<{ seq: number | null; elements: unknown[] }>`
  - `applyOps(meetingId: string, elements: WbElement[]): Promise<{ seq: number; winners: WbElement[] } | null>` — null khi không element nào thắng; 400 khi `LIMIT`
  - `tryPersistInBackground(meetingId: string): void` — không bao giờ ném
  - `persist(meetingId: string): Promise<void>`
  - `finalizeBoard(meetingId: string): Promise<void>` — không bao giờ ném

- [ ] **Step 1: Viết test (fail)**

`backend/src/modules/whiteboard/whiteboard.service.spec.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { gunzipSync } from 'node:zlib';
import { WhiteboardService } from './whiteboard.service.js';
import { WB_APPLY_SCRIPT } from './whiteboard.lua.js';
import { MeetingStatus, RoomRole } from '../../shared/enums.js';

// Query Mongoose giả: lean/select nối chuỗi, exec() trả result
function query(result: unknown) {
  const chain: any = {
    lean: vi.fn(() => chain),
    select: vi.fn(() => chain),
    exec: vi.fn().mockResolvedValue(result),
  };
  return chain;
}
const q = (result: unknown) => vi.fn((..._args: any[]) => query(result));

const userId = new Types.ObjectId().toString();
const roomId = new Types.ObjectId().toString();
const meetingId = new Types.ObjectId().toString();
const json = (value: unknown) => JSON.stringify(value);
const duplicateKeyError = () => Object.assign(new Error('E11000 duplicate key'), { code: 11000 });

// Redis client giả: multi().hGetAll().get().exec() → [hash, seq]
function fakeRedisClient(hash: Record<string, string>, seq: string | null) {
  const multi: any = {
    hGetAll: vi.fn(() => multi),
    get: vi.fn(() => multi),
    exec: vi.fn().mockResolvedValue([hash, seq]),
  };
  return {
    multi: vi.fn(() => multi),
    eval: vi.fn(),
    set: vi.fn().mockResolvedValue('OK'),
    del: vi.fn().mockResolvedValue(3),
  };
}

function build(hash: Record<string, string> = {}, seq: string | null = null) {
  const whiteboardModel = { updateOne: q({ acknowledged: true }) };
  const meetingModel = {
    findById: q({ _id: new Types.ObjectId(meetingId), roomId: new Types.ObjectId(roomId), status: MeetingStatus.ACTIVE }),
  };
  const access = { assertRoomAccess: vi.fn().mockResolvedValue({ role: RoomRole.MEMBER }) };
  const client = fakeRedisClient(hash, seq);
  const redis = { getClient: () => client };
  const service = new WhiteboardService(whiteboardModel as any, meetingModel as any, access as any, redis as any);
  return { service, whiteboardModel, meetingModel, access, client };
}

describe('assertCanJoin', () => {
  it('thành viên + meeting ACTIVE → trả roomId, kiểm quyền theo roomId của meeting', async () => {
    const { service, access } = build();
    await expect(service.assertCanJoin(userId, meetingId)).resolves.toEqual({ roomId });
    expect(access.assertRoomAccess).toHaveBeenCalledWith(userId, roomId);
  });

  it('meeting không tồn tại → 404', async () => {
    const { service, meetingModel } = build();
    meetingModel.findById.mockReturnValue(query(null));
    await expect(service.assertCanJoin(userId, meetingId)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('không phải thành viên → ném lỗi của assertRoomAccess', async () => {
    const { service, access } = build();
    access.assertRoomAccess.mockRejectedValue(new ForbiddenException());
    await expect(service.assertCanJoin(userId, meetingId)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('meeting đã kết thúc → 409', async () => {
    const { service, meetingModel } = build();
    meetingModel.findById.mockReturnValue(query({ roomId: new Types.ObjectId(roomId), status: MeetingStatus.ENDED }));
    await expect(service.assertCanJoin(userId, meetingId)).rejects.toBeInstanceOf(ConflictException);
  });
});

describe('getSnapshot', () => {
  it('đọc Hash + seq cùng một MULTI, trả cả tombstone', async () => {
    const { service, client } = build({ a: json({ id: 'a', isDeleted: false }), b: json({ id: 'b', isDeleted: true }) }, '7');
    const snapshot = await service.getSnapshot(meetingId);
    expect(client.multi).toHaveBeenCalledTimes(1);
    expect(snapshot.seq).toBe(7);
    expect(snapshot.elements).toEqual(expect.arrayContaining([{ id: 'a', isDeleted: false }, { id: 'b', isDeleted: true }]));
  });

  it('board trống → seq null, elements rỗng', async () => {
    const { service } = build();
    await expect(service.getSnapshot(meetingId)).resolves.toEqual({ seq: null, elements: [] });
  });
});

describe('applyOps', () => {
  const a = { id: 'a', type: 'rectangle', version: 2, versionNonce: 9, isDeleted: false };
  const b = { id: 'b', type: 'text', version: 1, versionNonce: 3, isDeleted: true };

  it('gọi script với đúng key + ARGV, trả element thắng theo chỉ số', async () => {
    const { service, client } = build();
    client.eval.mockResolvedValue(['OK', 5, 1]);
    await expect(service.applyOps(meetingId, [a, b])).resolves.toEqual({ seq: 5, winners: [b] });
    expect(client.eval).toHaveBeenCalledWith(WB_APPLY_SCRIPT, {
      keys: [`wb:${meetingId}`, `wb:seq:${meetingId}`, `wb:alive:${meetingId}`],
      arguments: ['5000', '20000', '86400', 'a', '2', '9', '0', json(a), 'b', '1', '3', '1', json(b)],
    });
  });

  it('NOOP → null', async () => {
    const { service, client } = build();
    client.eval.mockResolvedValue(['NOOP']);
    await expect(service.applyOps(meetingId, [a])).resolves.toBeNull();
  });

  it('LIMIT → 400', async () => {
    const { service, client } = build();
    client.eval.mockResolvedValue(['LIMIT']);
    await expect(service.applyOps(meetingId, [a])).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('persist', () => {
  it('ghi gzip element CHƯA xoá với guard lastSeq + upsert, roomId lấy từ meeting', async () => {
    const { service, whiteboardModel } = build(
      { a: json({ id: 'a', isDeleted: false }), b: json({ id: 'b', isDeleted: true }) },
      '7',
    );
    await service.persist(meetingId);

    expect(whiteboardModel.updateOne).toHaveBeenCalledWith(
      { meetingId, lastSeq: { $lt: 7 } },
      {
        $set: {
          elementsGzip: expect.any(Buffer),
          elementCount: 1,
          rawSizeBytes: expect.any(Number),
          lastSeq: 7,
          lastPersistedAt: expect.any(Date),
        },
        $setOnInsert: { roomId: expect.anything() },
      },
      { upsert: true },
    );
    const update = whiteboardModel.updateOne.mock.calls[0][1] as any;
    // So chuỗi — toEqual giữa 2 instance ObjectId không ổn định
    expect(String(update.$setOnInsert.roomId)).toBe(roomId);
    expect(JSON.parse(gunzipSync(update.$set.elementsGzip).toString())).toEqual([{ id: 'a', isDeleted: false }]);
  });

  it('Hash rỗng → không ghi (endMeeting chạy lại không đè board rỗng)', async () => {
    const { service, whiteboardModel } = build({}, null);
    await service.persist(meetingId);
    expect(whiteboardModel.updateOne).not.toHaveBeenCalled();
  });

  it('mọi element đã xoá → vẫn ghi [] (board bị clear là trạng thái thật)', async () => {
    const { service, whiteboardModel } = build({ a: json({ id: 'a', isDeleted: true }) }, '3');
    await service.persist(meetingId);
    const update = whiteboardModel.updateOne.mock.calls[0][1] as any;
    expect(update.$set.elementCount).toBe(0);
    expect(JSON.parse(gunzipSync(update.$set.elementsGzip).toString())).toEqual([]);
  });

  it('E11000 (đã có bản mới hơn) → bỏ qua, không ném', async () => {
    const { service, whiteboardModel } = build({ a: json({ id: 'a', isDeleted: false }) }, '3');
    whiteboardModel.updateOne.mockReturnValue({ exec: vi.fn().mockRejectedValue(duplicateKeyError()) });
    await expect(service.persist(meetingId)).resolves.toBeUndefined();
  });

  it('lỗi Mongo khác → ném', async () => {
    const { service, whiteboardModel } = build({ a: json({ id: 'a', isDeleted: false }) }, '3');
    whiteboardModel.updateOne.mockReturnValue({ exec: vi.fn().mockRejectedValue(new Error('mongo down')) });
    await expect(service.persist(meetingId)).rejects.toThrow('mongo down');
  });
});

describe('tryPersistInBackground', () => {
  it('giành được khoá 15 s → persist chạy nền', async () => {
    const { service, client } = build();
    const persist = vi.spyOn(service, 'persist').mockResolvedValue();
    service.tryPersistInBackground(meetingId);
    await vi.waitFor(() => expect(persist).toHaveBeenCalledWith(meetingId));
    expect(client.set).toHaveBeenCalledWith(`wb:persist-lock:${meetingId}`, '1', { NX: true, PX: 15000 });
  });

  it('không giành được khoá → không persist', async () => {
    const { service, client } = build();
    client.set.mockResolvedValue(null);
    const persist = vi.spyOn(service, 'persist').mockResolvedValue();
    service.tryPersistInBackground(meetingId);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(persist).not.toHaveBeenCalled();
  });

  it('persist nền lỗi → không ném ra ngoài (chỉ log)', async () => {
    const { service } = build();
    vi.spyOn(service, 'persist').mockRejectedValue(new Error('mongo down'));
    expect(() => service.tryPersistInBackground(meetingId)).not.toThrow();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
});

describe('finalizeBoard', () => {
  it('persist rồi xoá 3 key Redis', async () => {
    const { service, client } = build();
    const persist = vi.spyOn(service, 'persist').mockResolvedValue();
    await service.finalizeBoard(meetingId);
    expect(client.del).toHaveBeenCalledWith([`wb:${meetingId}`, `wb:seq:${meetingId}`, `wb:alive:${meetingId}`]);
    expect(persist.mock.invocationCallOrder[0]).toBeLessThan(client.del.mock.invocationCallOrder[0]);
  });

  it('persist lỗi → giữ key (TTL 24 h), không ném', async () => {
    const { service, client } = build();
    vi.spyOn(service, 'persist').mockRejectedValue(new Error('mongo down'));
    await expect(service.finalizeBoard(meetingId)).resolves.toBeUndefined();
    expect(client.del).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Chạy test, thấy fail**

```powershell
Set-Location backend; npx vitest run src/modules/whiteboard/whiteboard.service.spec.ts
```
Expected: FAIL — `Failed to resolve import "./whiteboard.service.js"`.

- [ ] **Step 3: Viết code**

`backend/src/modules/whiteboard/whiteboard.service.ts`:

```ts
import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { promisify } from 'node:util';
import { gzip } from 'node:zlib';
import { Whiteboard } from './schemas/whiteboard.schema.js';
import type { WhiteboardDocument } from './schemas/whiteboard.schema.js';
import { Meeting } from '../meetings/schemas/meeting.schema.js';
import type { MeetingDocument } from '../meetings/schemas/meeting.schema.js';
import { RoomAccessService } from '../room-members/room-access.service.js';
import { RedisService } from '../../common/services/redis.service.js';
import { MeetingStatus } from '../../shared/enums.js';
import { WB_MAX_ALIVE_ELEMENTS, WB_MAX_TOTAL_ELEMENTS } from '../../shared/whiteboard.js';
import { WB_APPLY_SCRIPT } from './whiteboard.lua.js';
import type { WbElement } from './element.validator.js';

// gzip chạy ở thread pool — không chặn event loop (board lớn vài MB), giữ độ trễ realtime
const gzipAsync = promisify(gzip);

// TTL key Redis của board (DB_DESIGN Phần E) — làm mới mỗi op
const BOARD_TTL_SECONDS = 24 * 60 * 60;
// Khoá giới hạn tần suất ghi Mongo: tối đa 1 lần / 15 s / board (spec §5)
const PERSIST_LOCK_MS = 15_000;

// Tên key Redis của 1 board
function boardKeys(meetingId: string) {
  return {
    hash: `wb:${meetingId}`,
    seq: `wb:seq:${meetingId}`,
    alive: `wb:alive:${meetingId}`,
    lock: `wb:persist-lock:${meetingId}`,
  };
}

// Lỗi trùng unique index của Mongo
function isDuplicateKey(err: unknown): boolean {
  return (err as { code?: number })?.code === 11000;
}

@Injectable()
export class WhiteboardService {
  private readonly logger = new Logger(WhiteboardService.name);

  constructor(
    @InjectModel(Whiteboard.name) private whiteboardModel: Model<WhiteboardDocument>,
    @InjectModel(Meeting.name) private meetingModel: Model<MeetingDocument>,
    private access: RoomAccessService,
    private redis: RedisService,
  ) {}

  // meeting:join — thành viên phòng + meeting ACTIVE (spec §3.1). Trả roomId để gateway gắn envelope
  async assertCanJoin(userId: string, meetingId: string): Promise<{ roomId: string }> {
    const meeting = await this.meetingModel.findById(meetingId).select('roomId status').lean().exec();
    if (!meeting) throw new NotFoundException('Buổi học không tồn tại');
    await this.access.assertRoomAccess(userId, String(meeting.roomId));
    if (meeting.status !== MeetingStatus.ACTIVE) throw new ConflictException('Buổi học đã kết thúc');
    return { roomId: String(meeting.roomId) };
  }

  // Snapshot gửi người vừa join / reconnect: toàn bộ Hash, GỒM tombstone (để người reconnect xoá được element đã bị xoá)
  async getSnapshot(meetingId: string): Promise<{ seq: number | null; elements: unknown[] }> {
    const { hash, seq } = await this.readBoard(meetingId);
    return {
      seq: seq === null ? null : Number(seq),
      elements: Object.values(hash).map((value) => JSON.parse(value)),
    };
  }

  // Chạy Lua wb-apply: trả seq + element thắng; null nếu không element nào thắng; vượt giới hạn → 400
  async applyOps(meetingId: string, elements: WbElement[]): Promise<{ seq: number; winners: WbElement[] } | null> {
    const keys = boardKeys(meetingId);
    const args = [String(WB_MAX_ALIVE_ELEMENTS), String(WB_MAX_TOTAL_ELEMENTS), String(BOARD_TTL_SECONDS)];
    for (const element of elements) {
      args.push(
        element.id,
        String(element.version),
        String(element.versionNonce),
        element.isDeleted ? '1' : '0',
        JSON.stringify(element),
      );
    }
    const reply = (await this.redis.getClient().eval(WB_APPLY_SCRIPT, {
      keys: [keys.hash, keys.seq, keys.alive],
      arguments: args,
    })) as Array<string | number>;

    if (reply[0] === 'LIMIT') throw new BadRequestException('Bảng vẽ đã đạt giới hạn 5.000 đối tượng');
    if (reply[0] === 'NOOP') return null;
    return { seq: Number(reply[1]), winners: reply.slice(2).map((index) => elements[Number(index)]) };
  }

  // Sau op có element thắng: instance nào giành được khoá 15 s thì ghi Mongo ở nền (không timer RAM — ràng buộc #5)
  tryPersistInBackground(meetingId: string): void {
    void this.redis
      .getClient()
      .set(boardKeys(meetingId).lock, '1', { NX: true, PX: PERSIST_LOCK_MS })
      .then((locked) => (locked ? this.persist(meetingId) : undefined))
      .catch((err) => this.logger.error(`Lưu whiteboard nền lỗi, meeting ${meetingId}: ${err}`));
  }

  // Ghi board từ Redis xuống Mongo (spec §5). Guard lastSeq chống ghi đè ngược (ADR-015)
  async persist(meetingId: string): Promise<void> {
    const { hash, seq } = await this.readBoard(meetingId);
    const values = Object.values(hash);
    // Redis trống → không ghi, tránh endMeeting chạy lại lần 2 ghi board rỗng đè Mongo
    if (seq === null || values.length === 0) return;

    // Mongo chỉ giữ element còn hiển thị — tombstone chỉ cần cho đồng bộ live (spec §1 câu 12)
    const elements = values.map((value) => JSON.parse(value)).filter((element) => element.isDeleted !== true);
    const raw = JSON.stringify(elements);
    const meeting = await this.meetingModel.findById(meetingId).select('roomId').lean().exec();
    if (!meeting) return;

    try {
      await this.whiteboardModel
        .updateOne(
          { meetingId, lastSeq: { $lt: Number(seq) } },
          {
            $set: {
              elementsGzip: await gzipAsync(raw),
              elementCount: elements.length,
              rawSizeBytes: Buffer.byteLength(raw),
              lastSeq: Number(seq),
              lastPersistedAt: new Date(),
            },
            $setOnInsert: { roomId: meeting.roomId },
          },
          { upsert: true },
        )
        .exec();
    } catch (err) {
      // Đã có lastSeq >= seq → filter không khớp → upsert cố insert trùng meetingId → E11000: bản Mongo mới hơn, bỏ qua
      if (!isDuplicateKey(err)) throw err;
    }
  }

  // Gọi từ endMeeting: lưu bản cuối rồi xoá key Redis. KHÔNG BAO GIỜ ném — lỗi thì giữ key (TTL 24 h) để không mất board
  async finalizeBoard(meetingId: string): Promise<void> {
    try {
      await this.persist(meetingId);
      const keys = boardKeys(meetingId);
      await this.redis.getClient().del([keys.hash, keys.seq, keys.alive]);
    } catch (err) {
      this.logger.error(`Không lưu được bản cuối whiteboard, meeting ${meetingId}: ${err}`);
    }
  }

  // Đọc Hash + seq trong cùng 1 MULTI — state và seq luôn khớp nhau (spec §5 bước 1)
  private async readBoard(meetingId: string): Promise<{ hash: Record<string, string>; seq: string | null }> {
    const keys = boardKeys(meetingId);
    const [hash, seq] = (await this.redis.getClient().multi().hGetAll(keys.hash).get(keys.seq).exec()) as unknown as [
      Record<string, string>,
      string | null,
    ];
    return { hash, seq };
  }
}
```

`backend/src/modules/whiteboard/whiteboard.module.ts` (thay toàn bộ):

```ts
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Whiteboard, WhiteboardSchema } from './schemas/whiteboard.schema.js';
import { Meeting, MeetingSchema } from '../meetings/schemas/meeting.schema.js';
import { RoomMembersModule } from '../room-members/room-members.module.js';
import { WhiteboardService } from './whiteboard.service.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Whiteboard.name, schema: WhiteboardSchema },
      // Meeting: kiểm ACTIVE khi join, lấy roomId khi lưu — đăng ký trực tiếp để không import MeetingsModule (tránh vòng)
      { name: Meeting.name, schema: MeetingSchema },
    ]),
    // RoomAccessService để kiểm thành viên khi meeting:join
    RoomMembersModule,
  ],
  providers: [WhiteboardService],
  // RealtimeModule (gateway) và MeetingsModule (lưu bản cuối) dùng
  exports: [WhiteboardService],
})
export class WhiteboardModule {}
```

- [ ] **Step 4: Chạy test, thấy pass**

```powershell
Set-Location backend; npx vitest run src/modules/whiteboard/whiteboard.service.spec.ts
```
Expected: PASS — 19 test.

- [ ] **Step 5: Ghi progress + đề xuất commit**

Progress mục "Whiteboard: Task 3". Đề xuất: `feat: WhiteboardService — snapshot, áp op qua Lua, lưu Mongo có guard`.

---

### Task 4: `RealtimePublisher` — 5 method whiteboard

**Files:**
- Modify: `backend/src/modules/realtime/realtime-publisher.service.ts` (thêm method trước `private requireNamespace()`)
- Test: `backend/src/modules/realtime/realtime-publisher.service.spec.ts` (thêm `describe` cuối file)

**Interfaces:**
- Produces:
  - `sendSnapshot(socket: Socket, input: { seq: number | null; actorId: string; roomId: string; meetingId: string; elements: unknown[] }): void`
  - `publishWbOps(senderSocketId: string, input: { seq: number; actorId: string; roomId: string; meetingId: string; elements: unknown[] }): void`
  - `publishWbPointer(senderSocketId: string, input: { actorId: string; displayName: string; roomId: string; meetingId: string; x: number; y: number }): void`
  - `leaveMeeting(userId: string, meetingId: string): Promise<void>`
  - `closeMeetingChannel(meetingId: string): Promise<void>`

- [ ] **Step 1: Viết test (fail)** — thêm cuối `realtime-publisher.service.spec.ts`:

```ts
describe('RealtimePublisher whiteboard', () => {
  const input = { actorId: 'user-id', roomId: 'room-id', meetingId: 'meeting-id' };

  it('sendSnapshot gửi riêng socket vừa join, envelope chuẩn', () => {
    const publisher = new RealtimePublisher();
    const socket = { emit: vi.fn() };
    publisher.sendSnapshot(socket as any, { ...input, seq: 7, elements: [{ id: 'a' }] });
    expect(socket.emit).toHaveBeenCalledWith(
      'meeting:snapshot',
      expect.objectContaining({ v: 1, seq: 7, ...input, data: { elements: [{ id: 'a' }] } }),
    );
  });

  it('publishWbOps phát tới kênh meeting, trừ socket người gửi', () => {
    const emit = vi.fn();
    const except = vi.fn().mockReturnValue({ emit });
    const to = vi.fn().mockReturnValue({ except });
    const publisher = new RealtimePublisher();
    publisher.setNamespace({ to } as any);

    publisher.publishWbOps('socket-1', { ...input, seq: 9, elements: [{ id: 'b' }] });

    expect(to).toHaveBeenCalledWith('meeting:meeting-id');
    expect(except).toHaveBeenCalledWith('socket-1');
    expect(emit).toHaveBeenCalledWith(
      'wb:ops',
      expect.objectContaining({ v: 1, seq: 9, ...input, data: { elements: [{ id: 'b' }] } }),
    );
  });

  it('publishWbPointer dùng volatile, seq null, kèm tên hiển thị', () => {
    const emit = vi.fn();
    const except = vi.fn().mockReturnValue({ emit });
    const to = vi.fn().mockReturnValue({ except });
    const publisher = new RealtimePublisher();
    publisher.setNamespace({ volatile: { to } } as any);

    publisher.publishWbPointer('socket-1', { ...input, displayName: 'An', x: 1, y: 2 });

    expect(to).toHaveBeenCalledWith('meeting:meeting-id');
    expect(except).toHaveBeenCalledWith('socket-1');
    expect(emit).toHaveBeenCalledWith(
      'wb:pointer',
      expect.objectContaining({ seq: null, data: { userId: 'user-id', displayName: 'An', x: 1, y: 2 } }),
    );
  });

  it('leaveMeeting ép mọi socket của user rời kênh meeting (mọi instance)', async () => {
    const socketsLeave = vi.fn().mockResolvedValue(undefined);
    const namespace = { in: vi.fn().mockReturnValue({ socketsLeave }) };
    const publisher = new RealtimePublisher();
    publisher.setNamespace(namespace as any);

    await publisher.leaveMeeting('user-id', 'meeting-id');

    expect(namespace.in).toHaveBeenCalledWith('user:user-id');
    expect(socketsLeave).toHaveBeenCalledWith('meeting:meeting-id');
  });

  it('closeMeetingChannel ép mọi socket rời kênh meeting', async () => {
    const socketsLeave = vi.fn().mockResolvedValue(undefined);
    const namespace = { in: vi.fn().mockReturnValue({ socketsLeave }) };
    const publisher = new RealtimePublisher();
    publisher.setNamespace(namespace as any);

    await publisher.closeMeetingChannel('meeting-id');

    expect(namespace.in).toHaveBeenCalledWith('meeting:meeting-id');
    expect(socketsLeave).toHaveBeenCalledWith('meeting:meeting-id');
  });
});
```

- [ ] **Step 2: Chạy test, thấy fail**

```powershell
Set-Location backend; npx vitest run src/modules/realtime/realtime-publisher.service.spec.ts
```
Expected: FAIL — `publisher.sendSnapshot is not a function` (5 test mới fail, test cũ pass).

- [ ] **Step 3: Viết code** — thêm vào class `RealtimePublisher`, ngay trước `private requireNamespace()`:

```ts
  // Whiteboard: snapshot gửi riêng socket vừa meeting:join (spec whiteboard §3.2)
  sendSnapshot(
    socket: Socket,
    input: { seq: number | null; actorId: string; roomId: string; meetingId: string; elements: unknown[] },
  ) {
    socket.emit('meeting:snapshot', {
      v: 1,
      seq: input.seq,
      ts: new Date().toISOString(),
      actorId: input.actorId,
      roomId: input.roomId,
      meetingId: input.meetingId,
      data: { elements: input.elements },
    });
  }

  // Whiteboard: element thắng tới mọi người trong meeting trừ người gửi — qua Redis adapter tới mọi instance
  publishWbOps(
    senderSocketId: string,
    input: { seq: number; actorId: string; roomId: string; meetingId: string; elements: unknown[] },
  ) {
    this.requireNamespace()
      .to(`meeting:${input.meetingId}`)
      .except(senderSocketId)
      .emit('wb:ops', {
        v: 1,
        seq: input.seq,
        ts: new Date().toISOString(),
        actorId: input.actorId,
        roomId: input.roomId,
        meetingId: input.meetingId,
        data: { elements: input.elements },
      });
  }

  // Whiteboard: con trỏ — volatile (gói cũ bỏ, không xếp hàng), không seq, không lưu
  publishWbPointer(
    senderSocketId: string,
    input: { actorId: string; displayName: string; roomId: string; meetingId: string; x: number; y: number },
  ) {
    this.requireNamespace()
      .volatile.to(`meeting:${input.meetingId}`)
      .except(senderSocketId)
      .emit('wb:pointer', {
        v: 1,
        seq: null,
        ts: new Date().toISOString(),
        actorId: input.actorId,
        roomId: input.roomId,
        meetingId: input.meetingId,
        data: { userId: input.actorId, displayName: input.displayName, x: input.x, y: input.y },
      });
  }

  // Kick / rời phòng: ép socket của user rời kênh whiteboard của meeting đang diễn ra (spec §3.3)
  async leaveMeeting(userId: string, meetingId: string) {
    await this.requireNamespace().in(`user:${userId}`).socketsLeave(`meeting:${meetingId}`);
  }

  // Meeting kết thúc: ép mọi socket rời kênh → op gửi sau đó tự bị chặn 403 (spec §3.3)
  async closeMeetingChannel(meetingId: string) {
    const channel = `meeting:${meetingId}`;
    await this.requireNamespace().in(channel).socketsLeave(channel);
  }
```

- [ ] **Step 4: Chạy test, thấy pass**

```powershell
Set-Location backend; npx vitest run src/modules/realtime/realtime-publisher.service.spec.ts
```
Expected: PASS — toàn bộ file (test cũ + 5 mới).

- [ ] **Step 5: Ghi progress + đề xuất commit**

Progress mục "Whiteboard: Task 4". Đề xuất: `feat: publisher phát snapshot, wb:ops, wb:pointer và đóng kênh meeting`.

---

### Task 5: Gateway — `meeting:join`, `meeting:leave`, `wb:ops`, `wb:pointer`

**Files:**
- Create: `backend/src/modules/whiteboard/dto/whiteboard-events.dto.ts`
- Modify: `backend/src/modules/realtime/gateways/meeting.gateway.ts` (constructor + thay handler `wb:ops` cũ + thêm 3 handler + `assertInMeeting`)
- Modify: `backend/src/modules/realtime/realtime.module.ts`
- Test: `backend/src/modules/realtime/gateways/meeting.gateway.spec.ts` (thay `build()`, thêm `describe`)

**Interfaces:**
- Consumes: `WhiteboardService` (Task 3), publisher (Task 4), `validateElementsBatch`, `WbElement` (Task 1).
- Produces: `MeetingGateway(jwt, users, roomAccess, chat, publisher, whiteboard)` — tham số thứ 6 mới; handler `handleMeetingJoin`, `handleMeetingLeave`, `handleWhiteboardOps`, `handleWhiteboardPointer` (đều `(socket: Socket, data: unknown) => Promise<void>`). `socket.data.meetingRoomIds: Record<meetingId, roomId>`.

- [ ] **Step 1: Viết test (fail)**

Trong `meeting.gateway.spec.ts`: thêm import `ForbiddenException` và thay hàm `build()` bằng bản dưới (test chat cũ vẫn dùng được: `to()` vẫn trả `{ emit }`):

```ts
import { ForbiddenException } from '@nestjs/common';
```

```ts
const meetingId = '507f1f77bcf86cd799439099';

function build() {
  const jwt = { verifyAsync: vi.fn().mockResolvedValue({ sub: userId }) };
  const users = {
    findById: vi
      .fn()
      .mockResolvedValue({ _id: userId, displayName: 'Student' }),
  };
  const roomAccess = {
    assertRoomAccess: vi.fn().mockResolvedValue(undefined),
  };
  const chat = {
    sendMessage: vi.fn().mockResolvedValue({
      created: true,
      message: { id: 'message-id', roomId, content: 'hello' },
    }),
    nextSequence: vi.fn().mockResolvedValue(1),
  };
  const whiteboard = {
    assertCanJoin: vi.fn().mockResolvedValue({ roomId }),
    getSnapshot: vi.fn().mockResolvedValue({ seq: 3, elements: [{ id: 'a' }] }),
    applyOps: vi.fn().mockResolvedValue(null),
    tryPersistInBackground: vi.fn(),
  };
  const publisher = new RealtimePublisher();
  const gateway = new MeetingGateway(
    jwt as any,
    users as any,
    roomAccess as any,
    chat as any,
    publisher,
    whiteboard as any,
  );
  const emit = vi.fn();
  const except = vi.fn().mockReturnValue({ emit });
  const to = vi.fn().mockReturnValue({ emit, except });
  publisher.setNamespace({ to, volatile: { to } } as any);
  // socket.rooms giả: join / leave cập nhật như Socket.IO thật
  const socket = {
    id: 'socket-1',
    rooms: new Set<string>(['socket-1']),
    data: { userId, displayName: 'Student' } as Record<string, any>,
    join: vi.fn(async (channel: string) => {
      socket.rooms.add(channel);
    }),
    leave: vi.fn(async (channel: string) => {
      socket.rooms.delete(channel);
    }),
    emit: vi.fn(),
  };
  return { gateway, jwt, users, roomAccess, chat, whiteboard, socket, emit, except, to };
}
```

Sửa test `'authenticates the JWT…'`: dòng `expect(socket.data).toEqual({ userId, displayName: 'Student' });` giữ nguyên (socket của test đó tự tạo).

Thêm cuối file:

```ts
// Element hợp lệ tối thiểu
const element = (id: string, overrides: Record<string, unknown> = {}) => ({
  id,
  type: 'rectangle',
  version: 1,
  versionNonce: 7,
  isDeleted: false,
  ...overrides,
});

// Socket đã meeting:join thành công
async function joined() {
  const ctx = build();
  await ctx.gateway.handleMeetingJoin(ctx.socket as any, { meetingId });
  ctx.socket.emit.mockClear();
  return ctx;
}

describe('MeetingGateway whiteboard events', () => {
  it('meeting:join kiểm quyền, vào kênh TRƯỚC rồi mới đọc snapshot, gửi snapshot riêng socket', async () => {
    const { gateway, whiteboard, socket } = build();

    await gateway.handleMeetingJoin(socket as any, { meetingId });

    expect(whiteboard.assertCanJoin).toHaveBeenCalledWith(userId, meetingId);
    expect(socket.join).toHaveBeenCalledWith(`meeting:${meetingId}`);
    expect(socket.join.mock.invocationCallOrder[0]).toBeLessThan(
      whiteboard.getSnapshot.mock.invocationCallOrder[0],
    );
    expect(socket.emit).toHaveBeenCalledWith(
      'meeting:snapshot',
      expect.objectContaining({ v: 1, seq: 3, roomId, meetingId, data: { elements: [{ id: 'a' }] } }),
    );
  });

  it('meeting:join không có quyền → error 403, không vào kênh', async () => {
    const { gateway, whiteboard, socket } = build();
    whiteboard.assertCanJoin.mockRejectedValue(new ForbiddenException('Không phải thành viên'));

    await gateway.handleMeetingJoin(socket as any, { meetingId });

    expect(socket.join).not.toHaveBeenCalled();
    expect(socket.emit).toHaveBeenCalledWith('error', expect.objectContaining({ statusCode: 403 }));
  });

  it('meeting:join meetingId sai định dạng → 400, không kiểm quyền', async () => {
    const { gateway, whiteboard, socket } = build();

    await gateway.handleMeetingJoin(socket as any, { meetingId: 'abc' });

    expect(whiteboard.assertCanJoin).not.toHaveBeenCalled();
    expect(socket.emit).toHaveBeenCalledWith('error', expect.objectContaining({ statusCode: 400 }));
  });

  it('wb:ops khi chưa join → 403, không chạy Lua', async () => {
    const { gateway, whiteboard, socket } = build();

    await gateway.handleWhiteboardOps(socket as any, { meetingId, elements: [element('a')] });

    expect(whiteboard.applyOps).not.toHaveBeenCalled();
    expect(socket.emit).toHaveBeenCalledWith('error', expect.objectContaining({ statusCode: 403 }));
  });

  it('wb:ops có 1 element sai → 400, không chạy Lua', async () => {
    const { gateway, whiteboard, socket } = await joined();

    await gateway.handleWhiteboardOps(socket as any, {
      meetingId,
      elements: [element('a'), element('b', { type: 'embeddable' })],
    });

    expect(whiteboard.applyOps).not.toHaveBeenCalled();
    expect(socket.emit).toHaveBeenCalledWith('error', expect.objectContaining({ statusCode: 400 }));
  });

  it('wb:ops chỉ phát element thắng tới kênh meeting, trừ người gửi, rồi thử lưu nền', async () => {
    const { gateway, whiteboard, socket, to, except, emit } = await joined();
    const a = element('a');
    const b = element('b');
    whiteboard.applyOps.mockResolvedValue({ seq: 9, winners: [b] });

    await gateway.handleWhiteboardOps(socket as any, { meetingId, elements: [a, b] });

    expect(whiteboard.applyOps).toHaveBeenCalledWith(meetingId, [a, b]);
    expect(to).toHaveBeenCalledWith(`meeting:${meetingId}`);
    expect(except).toHaveBeenCalledWith('socket-1');
    expect(emit).toHaveBeenCalledWith(
      'wb:ops',
      expect.objectContaining({ seq: 9, actorId: userId, roomId, meetingId, data: { elements: [b] } }),
    );
    expect(whiteboard.tryPersistInBackground).toHaveBeenCalledWith(meetingId);
  });

  it('wb:ops không element nào thắng → không phát, không lưu', async () => {
    const { gateway, whiteboard, socket, emit } = await joined();
    whiteboard.applyOps.mockResolvedValue(null);

    await gateway.handleWhiteboardOps(socket as any, { meetingId, elements: [element('a')] });

    expect(emit).not.toHaveBeenCalledWith('wb:ops', expect.anything());
    expect(whiteboard.tryPersistInBackground).not.toHaveBeenCalled();
  });

  it('bị ép rời kênh (kick / meeting kết thúc) → wb:ops sau đó bị 403', async () => {
    const { gateway, whiteboard, socket } = await joined();
    socket.rooms.delete(`meeting:${meetingId}`);

    await gateway.handleWhiteboardOps(socket as any, { meetingId, elements: [element('a')] });

    expect(whiteboard.applyOps).not.toHaveBeenCalled();
    expect(socket.emit).toHaveBeenCalledWith('error', expect.objectContaining({ statusCode: 403 }));
  });

  it('wb:pointer phát volatile kèm tên hiển thị, seq null', async () => {
    const { gateway, socket, except, emit } = await joined();

    await gateway.handleWhiteboardPointer(socket as any, { meetingId, x: 10, y: -5.5 });

    expect(except).toHaveBeenCalledWith('socket-1');
    expect(emit).toHaveBeenCalledWith(
      'wb:pointer',
      expect.objectContaining({ seq: null, data: { userId, displayName: 'Student', x: 10, y: -5.5 } }),
    );
  });

  it('wb:pointer toạ độ ngoài ±1e7 → 400', async () => {
    const { gateway, socket } = await joined();

    await gateway.handleWhiteboardPointer(socket as any, { meetingId, x: 1e9, y: 0 });

    expect(socket.emit).toHaveBeenCalledWith('error', expect.objectContaining({ statusCode: 400 }));
  });

  it('meeting:leave rời kênh', async () => {
    const { gateway, socket } = await joined();

    await gateway.handleMeetingLeave(socket as any, { meetingId });

    expect(socket.leave).toHaveBeenCalledWith(`meeting:${meetingId}`);
    expect(socket.rooms.has(`meeting:${meetingId}`)).toBe(false);
  });
});
```

- [ ] **Step 2: Chạy test, thấy fail**

```powershell
Set-Location backend; npx vitest run src/modules/realtime/gateways/meeting.gateway.spec.ts
```
Expected: FAIL — `gateway.handleMeetingJoin is not a function` (test whiteboard mới fail, 4 test chat cũ pass).

- [ ] **Step 3: Viết code**

`backend/src/modules/whiteboard/dto/whiteboard-events.dto.ts`:

```ts
import { IsArray, IsMongoId, IsNumber, Max, Min } from 'class-validator';

// meeting:join, meeting:leave
export class MeetingIdDto {
  @IsMongoId()
  meetingId!: string;
}

// wb:ops — từng element kiểm bằng validateElementsBatch (không dùng DTO lồng: whitelist sẽ xoá field của Excalidraw)
export class WbOpsDto {
  @IsMongoId()
  meetingId!: string;

  @IsArray()
  elements!: unknown[];
}

// wb:pointer — toạ độ canvas, số hữu hạn trong ±1e7
export class WbPointerDto {
  @IsMongoId()
  meetingId!: string;

  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(-1e7)
  @Max(1e7)
  x!: number;

  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(-1e7)
  @Max(1e7)
  y!: number;
}
```

`meeting.gateway.ts` — sửa import `@nestjs/common` thêm `ForbiddenException`; thêm import:

```ts
import { WhiteboardService } from '../../whiteboard/whiteboard.service.js';
import { MeetingIdDto, WbOpsDto, WbPointerDto } from '../../whiteboard/dto/whiteboard-events.dto.js';
import { validateElementsBatch } from '../../whiteboard/element.validator.js';
import type { WbElement } from '../../whiteboard/element.validator.js';
```

Constructor thêm tham số cuối:

```ts
    private readonly publisher: RealtimePublisher,
    private readonly whiteboard: WhiteboardService,
  ) {}
```

Xoá handler cũ:

```ts
  @SubscribeMessage('wb:ops')
  handleWhiteboardOps(socket: Socket, data: any) {
    this.logger.log(`Whiteboard ops from ${socket.id}:`, data);
  }
```

và thay bằng:

```ts
  // Vào board của meeting: thành viên + meeting ACTIVE → vào kênh TRƯỚC rồi mới đọc snapshot,
  // để op phát ra ở giữa vẫn tới (LWW không phụ thuộc thứ tự) — spec whiteboard §3.1
  @SubscribeMessage('meeting:join')
  async handleMeetingJoin(socket: Socket, data: unknown) {
    try {
      const dto = await this.validatePayload(MeetingIdDto, data);
      const { roomId } = await this.whiteboard.assertCanJoin(socket.data.userId, dto.meetingId);
      await socket.join(`meeting:${dto.meetingId}`);
      // roomId của meeting giữ trên kết nối (không phải state server) để gắn envelope cho wb:*
      socket.data.meetingRoomIds = { ...socket.data.meetingRoomIds, [dto.meetingId]: roomId };
      const snapshot = await this.whiteboard.getSnapshot(dto.meetingId);
      this.publisher.sendSnapshot(socket, {
        seq: snapshot.seq,
        actorId: socket.data.userId,
        roomId,
        meetingId: dto.meetingId,
        elements: snapshot.elements,
      });
    } catch (error) {
      this.sendExpectedError(socket, error);
    }
  }

  @SubscribeMessage('meeting:leave')
  async handleMeetingLeave(socket: Socket, data: unknown) {
    try {
      const dto = await this.validatePayload(MeetingIdDto, data);
      await socket.leave(`meeting:${dto.meetingId}`);
    } catch (error) {
      this.sendExpectedError(socket, error);
    }
  }

  // Nét vẽ: validate → Lua merge LWW (atomic) → phát element thắng → thử lưu nền. Không query Mongo mỗi op
  @SubscribeMessage('wb:ops')
  async handleWhiteboardOps(socket: Socket, data: unknown) {
    try {
      const dto = await this.validatePayload(WbOpsDto, data);
      const roomId = this.assertInMeeting(socket, dto.meetingId);
      const invalid = validateElementsBatch(dto.elements);
      if (invalid) throw new BadRequestException(invalid);

      const result = await this.whiteboard.applyOps(dto.meetingId, dto.elements as WbElement[]);
      if (!result) return;
      this.publisher.publishWbOps(socket.id, {
        seq: result.seq,
        actorId: socket.data.userId,
        roomId,
        meetingId: dto.meetingId,
        elements: result.winners,
      });
      this.whiteboard.tryPersistInBackground(dto.meetingId);
    } catch (error) {
      this.sendExpectedError(socket, error);
    }
  }

  // Con trỏ: chỉ chuyển tiếp, không Redis, không seq, không lưu
  @SubscribeMessage('wb:pointer')
  async handleWhiteboardPointer(socket: Socket, data: unknown) {
    try {
      const dto = await this.validatePayload(WbPointerDto, data);
      const roomId = this.assertInMeeting(socket, dto.meetingId);
      this.publisher.publishWbPointer(socket.id, {
        actorId: socket.data.userId,
        displayName: socket.data.displayName,
        roomId,
        meetingId: dto.meetingId,
        x: dto.x,
        y: dto.y,
      });
    } catch (error) {
      this.sendExpectedError(socket, error);
    }
  }

  // Socket phải đang ở kênh meeting (đã join, chưa bị kick / meeting chưa kết thúc) — kiểm trong RAM, không query
  private assertInMeeting(socket: Socket, meetingId: string): string {
    const roomId: string | undefined = socket.data.meetingRoomIds?.[meetingId];
    if (!roomId || !socket.rooms.has(`meeting:${meetingId}`)) {
      throw new ForbiddenException('Bạn chưa vào buổi học này');
    }
    return roomId;
  }
```

`backend/src/modules/realtime/realtime.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { ChatModule } from '../chat/chat.module.js';
import { RoomMembersModule } from '../room-members/room-members.module.js';
import { UsersModule } from '../users/users.module.js';
import { WhiteboardModule } from '../whiteboard/whiteboard.module.js';
import { MeetingGateway } from './gateways/meeting.gateway.js';
import { RealtimePublisher } from './realtime-publisher.service.js';

@Module({
  imports: [AuthModule, ChatModule, RoomMembersModule, UsersModule, WhiteboardModule],
  providers: [MeetingGateway, RealtimePublisher],
  exports: [RealtimePublisher],
})
export class RealtimeModule {}
```

- [ ] **Step 4: Chạy test, thấy pass**

```powershell
Set-Location backend; npx vitest run src/modules/realtime
```
Expected: PASS — gateway (4 chat + 11 whiteboard) + publisher.

- [ ] **Step 5: Ghi progress + đề xuất commit**

Progress mục "Whiteboard: Task 5". Đề xuất: `feat: gateway meeting:join, wb:ops, wb:pointer cho whiteboard`.

---

### Task 6: Meeting — đóng kênh + lưu bản cuối, kick rời kênh; chạy thật backend

**Files:**
- Modify: `backend/src/modules/meetings/meetings.service.ts` (import, constructor, `endMeeting`, `removeFromActiveMeeting`, thêm `closeBoard`)
- Modify: `backend/src/modules/meetings/meetings.module.ts`
- Test: `backend/src/modules/meetings/meetings.service.spec.ts` (`build()` + 2 `describe` thêm test)

**Interfaces:**
- Consumes: `WhiteboardService.finalizeBoard` (Task 3), `RealtimePublisher.closeMeetingChannel`, `leaveMeeting` (Task 4).
- Produces: `MeetingsService(meetingModel, participantModel, roomModel, access, redis, media, whiteboard, realtime)` — 2 tham số cuối mới.

- [ ] **Step 1: Viết test (fail)**

`meetings.service.spec.ts` — trong `build()`, thêm trước `const service = ...`:

```ts
  // Whiteboard + publisher giả: lưu bản cuối / đóng kênh khi kết thúc, rời kênh khi kick (spec whiteboard §3.3, §5)
  const whiteboard = { finalizeBoard: vi.fn().mockResolvedValue(undefined) };
  const realtime = {
    closeMeetingChannel: vi.fn().mockResolvedValue(undefined),
    leaveMeeting: vi.fn().mockResolvedValue(undefined),
  };
```

đổi lời gọi constructor và giá trị trả về:

```ts
  const service = new MeetingsService(
    meetingModel as any,
    participantModel as any,
    roomModel as any,
    access as any,
    redis as any,
    media as any,
    whiteboard as any,
    realtime as any,
  );
  return { service, meetingModel, participantModel, roomModel, access, redis, media, whiteboard, realtime };
```

Thêm vào cuối `describe('endMeeting', ...)`:

```ts
  it('whiteboard: đóng kênh meeting rồi lưu bản cuối', async () => {
    const { service, meetingModel, whiteboard, realtime } = build();
    meetingModel.findById
      .mockReturnValueOnce(query(fakeMeeting({ startedAt })))
      .mockReturnValueOnce(query(fakeMeeting({ startedAt, status: MeetingStatus.ENDED, endedAt })));

    await service.endMeeting(meetingId, EndReason.HOST_ENDED, endedAt, userId);

    expect(realtime.closeMeetingChannel).toHaveBeenCalledWith(meetingId);
    expect(whiteboard.finalizeBoard).toHaveBeenCalledWith(meetingId);
    expect(realtime.closeMeetingChannel.mock.invocationCallOrder[0]).toBeLessThan(
      whiteboard.finalizeBoard.mock.invocationCallOrder[0],
    );
  });

  it('whiteboard: đóng kênh lỗi → vẫn lưu bản cuối, endMeeting không ném', async () => {
    const { service, meetingModel, whiteboard, realtime } = build();
    meetingModel.findById
      .mockReturnValueOnce(query(fakeMeeting({ startedAt })))
      .mockReturnValueOnce(query(fakeMeeting({ startedAt, status: MeetingStatus.ENDED, endedAt })));
    realtime.closeMeetingChannel.mockRejectedValue(new Error('redis down'));

    await expect(service.endMeeting(meetingId, EndReason.HOST_ENDED, endedAt, userId)).resolves.toBeUndefined();
    expect(whiteboard.finalizeBoard).toHaveBeenCalledWith(meetingId);
  });
```

Thêm vào cuối `describe('removeFromActiveMeeting', ...)`:

```ts
  it('có meeting ACTIVE → ép socket của người đó rời kênh whiteboard', async () => {
    const { service, meetingModel, realtime } = build();
    meetingModel.findOne.mockReturnValue(query(fakeMeeting()));

    await service.removeFromActiveMeeting(roomId, userId);

    expect(realtime.leaveMeeting).toHaveBeenCalledWith(userId, meetingId);
  });

  it('không có meeting ACTIVE → không đụng kênh whiteboard', async () => {
    const { service, realtime } = build();

    await service.removeFromActiveMeeting(roomId, userId);

    expect(realtime.leaveMeeting).not.toHaveBeenCalled();
  });
```

- [ ] **Step 2: Chạy test, thấy fail**

```powershell
Set-Location backend; npx vitest run src/modules/meetings/meetings.service.spec.ts
```
Expected: FAIL — 3 test mới (`closeMeetingChannel` / `leaveMeeting` không được gọi); test cũ pass.

- [ ] **Step 3: Viết code**

`meetings.service.ts` — thêm import:

```ts
import { WhiteboardService } from '../whiteboard/whiteboard.service.js';
import { RealtimePublisher } from '../realtime/realtime-publisher.service.js';
```

Constructor thêm 2 tham số cuối:

```ts
    @Inject(MEDIA_PORT) private media: MediaPort,
    private whiteboard: WhiteboardService,
    private realtime: RealtimePublisher,
  ) {}
```

Trong `endMeeting`, giữa `updateOne(...)` và `await this.finalize(meetingId);`:

```ts
    // Whiteboard: đuổi mọi socket khỏi kênh rồi lưu bản cuối (spec whiteboard §3.3, §5). Không bao giờ ném
    await this.closeBoard(meetingId);

    // Vẫn chạy kể cả khi update không khớp → sửa được lần finalize trước bị dở
    await this.finalize(meetingId);
```

Trong `removeFromActiveMeeting`, thay:

```ts
      meetingId = String(active._id);
      await this.media.removeParticipant(meetingId, userId);
```

bằng:

```ts
      meetingId = String(active._id);
      // Ép socket rời kênh whiteboard trước (không vẽ được nữa), rồi đưa ra khỏi call LiveKit
      await this.realtime.leaveMeeting(userId, meetingId);
      await this.media.removeParticipant(meetingId, userId);
```

Thêm method private, ngay trước `private async finalize(`:

```ts
  // Đóng kênh whiteboard + lưu bản cuối. KHÔNG BAO GIỜ ném — kết thúc meeting không phụ thuộc whiteboard
  private async closeBoard(meetingId: string) {
    try {
      await this.realtime.closeMeetingChannel(meetingId);
    } catch (err) {
      this.logger.error(`Không đóng được kênh whiteboard của meeting ${meetingId}: ${err}`);
    }
    // finalizeBoard tự bắt lỗi, lỗi thì giữ key Redis
    await this.whiteboard.finalizeBoard(meetingId);
  }
```

`meetings.module.ts` — thêm import và vào mảng `imports`:

```ts
import { WhiteboardModule } from '../whiteboard/whiteboard.module.js';
import { RealtimeModule } from '../realtime/realtime.module.js';
```

```ts
    // RoomAccessService để kiểm quyền
    RoomMembersModule,
    // Lưu bản cuối whiteboard khi kết thúc meeting
    WhiteboardModule,
    // Đóng kênh whiteboard / ép rời kênh khi kick (RealtimePublisher)
    RealtimeModule,
```

- [ ] **Step 4: Chạy toàn bộ test + build**

```powershell
Set-Location backend; npx vitest run; npm run lint; npm run build
```
Expected: mọi test pass (gồm `whiteboard.lua.spec.ts` trên Redis thật); lint không lỗi mới; build exit 0.

- [ ] **Step 5: Chạy thật backend (DI + Lua qua node-redis)**

```powershell
docker compose restart backend
docker compose logs --tail 40 backend
```
Expected: có `Nest application successfully started`, **không** có `Nest can't resolve dependencies`.

Kiểm nhanh `eval` của node-redis thật trong container (đồ bỏ, không lưu file):

```powershell
docker exec backend-dev node -e "const {createClient}=require('redis');(async()=>{const c=createClient({url:process.env.REDIS_URL});await c.connect();console.log(await c.eval(\"return {'OK', 1, 0}\",{keys:[],arguments:[]}));await c.quit()})()"
```
Expected: `[ 'OK', 1, 0 ]` (chuỗi + số). Nếu khác → sửa cách đọc `reply` trong `applyOps`, ghi vào progress.

- [ ] **Step 6: Ghi progress + đề xuất commit**

Progress mục "Whiteboard: Task 6" (kèm output test / build / log khởi động). Đề xuất: `feat: kết thúc meeting đóng kênh và lưu bản cuối whiteboard`.

---

### Task 7: Frontend — đồng bộ trong `WhiteboardCanvas`

**Files:**
- Create: `frontend/src/features/whiteboard/hooks/useWhiteboardSync.ts`
- Modify: `frontend/src/features/whiteboard/components/WhiteboardCanvas.tsx` (thay toàn bộ)
- Modify: `frontend/src/features/meeting/components/MeetingWorkspace.tsx:265`
- Modify: `frontend/src/features/whiteboard/index.ts`; Delete: `frontend/src/features/whiteboard/types.ts`

**Interfaces:**
- Consumes: hằng số `@shared/whiteboard` (Task 1); event server Task 5 (`meeting:snapshot`, `wb:ops`, `wb:pointer`, `error` — envelope `{ meetingId, data }`).
- Produces: `useWhiteboardSync({ token, meetingId, api }) → { onChange, onPointerUpdate, notice, clearNotice }`; `WhiteboardCanvas` props thêm `token?: string | null`, `meetingId?: string`.

Frontend chưa có framework test → kiểm bằng lint + build + chạy thật (spec §10.2).

- [ ] **Step 1: Viết hook**

`frontend/src/features/whiteboard/hooks/useWhiteboardSync.ts`:

```ts
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import type { Collaborator, ExcalidrawImperativeAPI, SocketId } from "@excalidraw/excalidraw/types";
import type { OrderedExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import type { RemoteExcalidrawElement } from "@excalidraw/excalidraw/data/reconcile";
import { API_BASE_URL } from "@/services/api";
import { WB_ELEMENT_TYPES, WB_MAX_BATCH_BYTES, WB_MAX_BATCH_ELEMENTS } from "@shared/whiteboard";

// Chu kỳ gửi nét vẽ / con trỏ — throttle, KHÔNG debounce: đang kéo hình vẫn gửi đều (spec §1 câu 7)
const SEND_INTERVAL_MS = 50;
// Con trỏ người khác im quá 5 s thì ẩn
const POINTER_IDLE_MS = 5000;

type ExcalidrawLib = typeof import("@excalidraw/excalidraw");

// Envelope server gửi xuống (PROJECT_CONTEXT §9) — chỉ đọc field cần
interface Envelope<T> {
  meetingId: string | null;
  data: T;
}

// Throttle tối giản: lần đầu chạy ngay, các lần gọi trong chu kỳ gộp thành 1 lần chạy cuối chu kỳ
function throttle(fn: () => void, ms: number) {
  let last = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const run = () => {
    last = Date.now();
    timer = null;
    fn();
  };
  const call = () => {
    if (timer) return;
    const wait = ms - (Date.now() - last);
    if (wait <= 0) run();
    else timer = setTimeout(run, wait);
  };
  call.cancel = () => {
    if (timer) clearTimeout(timer);
    timer = null;
  };
  return call;
}

const encoder = new TextEncoder();
const noop = () => {};

export function useWhiteboardSync({
  token,
  meetingId,
  api,
}: {
  token?: string | null;
  meetingId?: string;
  api: ExcalidrawImperativeAPI | null;
}) {
  const [notice, setNotice] = useState("");
  // Hàm thật gắn vào onChange / onPointerUpdate — đổi mỗi khi socket đổi
  const handlersRef = useRef<{ onChange: () => void; onPointer: (x: number, y: number) => void }>({
    onChange: noop,
    onPointer: noop,
  });
  // id → version đã gửi đi hoặc nhận về gần nhất: chỉ gửi phần đổi + chống echo (spec §9)
  const syncedVersions = useRef(new Map<string, number>());

  useEffect(() => {
    // Chưa có meeting / token / Excalidraw chưa sẵn sàng → bảng chạy local
    if (!api || !token || !meetingId) return;

    let lib: ExcalidrawLib | null = null;
    let disposed = false;
    const synced = syncedVersions.current;
    const warned = new Set<string>();
    const collaborators = new Map<SocketId, Collaborator>();
    const lastSeen = new Map<SocketId, number>();
    let pointer: { x: number; y: number } | null = null;

    // Kết nối sau khi tải xong thư viện → snapshot không bao giờ tới trước reconcileElements
    const socket = io(`${API_BASE_URL}/meeting`, {
      auth: { token },
      transports: ["websocket"],
      autoConnect: false,
    });

    // Áp element nhận được: reconcile (giữ element mình đang gõ / kéo / vẽ dở) → không vào undo/redo
    const applyRemote = (remote: unknown[]) => {
      if (!lib || remote.length === 0) return;
      for (const element of remote as { id: string; version: number }[]) {
        synced.set(element.id, Math.max(synced.get(element.id) ?? 0, element.version));
      }
      const restored = lib.restoreElements(remote as OrderedExcalidrawElement[], null);
      const elements = lib.reconcileElements(
        api.getSceneElementsIncludingDeleted(),
        restored as RemoteExcalidrawElement[],
        api.getAppState(),
      );
      api.updateScene({ elements, captureUpdate: lib.CaptureUpdateAction.NEVER });
    };

    // Gửi element có version mới hơn bản đã đồng bộ, chia batch theo số lượng + byte
    const flush = () => {
      if (!socket.connected) return; // mất mạng: chưa ghi version → reconnect sẽ gửi
      const batches: OrderedExcalidrawElement[][] = [];
      let batch: OrderedExcalidrawElement[] = [];
      let batchBytes = 2; // "[]"
      for (const element of api.getSceneElementsIncludingDeleted()) {
        if (element.version <= (synced.get(element.id) ?? 0)) continue;
        synced.set(element.id, element.version); // ghi lúc gửi, không chờ server
        const bytes = encoder.encode(JSON.stringify(element)).length;
        // Lọc trước khi gửi: loại không đồng bộ (vd embeddable) hoặc quá lớn → chỉ ở máy mình (spec §6, §9)
        if (!WB_ELEMENT_TYPES.includes(element.type) || bytes > WB_MAX_BATCH_BYTES - 2) {
          if (!warned.has(element.id)) {
            warned.add(element.id);
            setNotice("Đối tượng này chỉ hiện trên máy bạn, không đồng bộ.");
          }
          continue;
        }
        if (batch.length === WB_MAX_BATCH_ELEMENTS || batchBytes + bytes + 1 > WB_MAX_BATCH_BYTES) {
          batches.push(batch);
          batch = [];
          batchBytes = 2;
        }
        batch.push(element);
        batchBytes += bytes + 1; // + dấu phẩy
      }
      if (batch.length) batches.push(batch);
      for (const elements of batches) socket.emit("wb:ops", { meetingId, elements });
    };

    const scheduleFlush = throttle(flush, SEND_INTERVAL_MS);
    const sendPointer = throttle(() => {
      if (pointer && socket.connected) socket.emit("wb:pointer", { meetingId, ...pointer });
    }, SEND_INTERVAL_MS);
    const showCollaborators = () => api.updateScene({ collaborators: new Map(collaborators) });

    socket.on("connect", () => socket.emit("meeting:join", { meetingId }));
    socket.on("meeting:snapshot", (envelope: Envelope<{ elements: unknown[] }>) => {
      if (envelope.meetingId !== meetingId) return;
      setNotice("");
      applyRemote(envelope.data.elements);
      flush(); // gửi phần đã vẽ lúc mất mạng
    });
    socket.on("wb:ops", (envelope: Envelope<{ elements: unknown[] }>) => {
      if (envelope.meetingId === meetingId) applyRemote(envelope.data.elements);
    });
    socket.on(
      "wb:pointer",
      (envelope: Envelope<{ userId: string; displayName: string; x: number; y: number }>) => {
        if (envelope.meetingId !== meetingId) return;
        const id = envelope.data.userId as SocketId;
        collaborators.set(id, {
          id: envelope.data.userId,
          username: envelope.data.displayName,
          pointer: { x: envelope.data.x, y: envelope.data.y, tool: "pointer" },
        });
        lastSeen.set(id, Date.now());
        showCollaborators();
      }
    );
    socket.on("error", (error: { message?: string | string[] }) => {
      const message = Array.isArray(error?.message) ? error.message.join(", ") : error?.message;
      setNotice(message || "Lỗi đồng bộ bảng vẽ.");
    });
    socket.on("connect_error", () => setNotice("Mất kết nối bảng vẽ, đang thử lại..."));

    // Ẩn con trỏ người im lâu
    const idleTimer = setInterval(() => {
      let changed = false;
      for (const [id, at] of lastSeen) {
        if (Date.now() - at > POINTER_IDLE_MS) {
          lastSeen.delete(id);
          collaborators.delete(id);
          changed = true;
        }
      }
      if (changed) showCollaborators();
    }, 1000);

    handlersRef.current = {
      onChange: scheduleFlush,
      onPointer: (x, y) => {
        pointer = { x, y };
        sendPointer();
      },
    };

    // Next.js SSR: chỉ tải thư viện ở trình duyệt (giống WhiteboardCanvas dùng next/dynamic)
    void import("@excalidraw/excalidraw").then((module) => {
      lib = module;
      if (!disposed) socket.connect();
    });

    return () => {
      disposed = true;
      handlersRef.current = { onChange: noop, onPointer: noop };
      scheduleFlush.cancel();
      sendPointer.cancel();
      clearInterval(idleTimer);
      if (socket.connected) socket.emit("meeting:leave", { meetingId });
      socket.disconnect();
    };
  }, [api, token, meetingId]);

  const onChange = useCallback(() => handlersRef.current.onChange(), []);
  const onPointerUpdate = useCallback(
    (payload: { pointer: { x: number; y: number } }) =>
      handlersRef.current.onPointer(payload.pointer.x, payload.pointer.y),
    []
  );
  const clearNotice = useCallback(() => setNotice(""), []);

  return { onChange, onPointerUpdate, notice, clearNotice };
}
```

- [ ] **Step 2: Sửa `WhiteboardCanvas.tsx` (thay toàn bộ)**

```tsx
"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
// CSS bắt buộc của Excalidraw (README của thư viện)
import "@excalidraw/excalidraw/index.css";
import { useWhiteboardSync } from "../hooks/useWhiteboardSync";

// Excalidraw dùng window/canvas nên chỉ render ở client → tắt SSR (cách Excalidraw hướng dẫn cho Next.js)
const Excalidraw = dynamic(
  async () => (await import("@excalidraw/excalidraw")).Excalidraw,
  { ssr: false }
);

// Tắt chèn ảnh (nút, dán, kéo thả) — ảnh làm ở spec sau. Hằng ngoài component để không tạo object mới mỗi render
const UI_OPTIONS = { tools: { image: false } };

interface WhiteboardCanvasProps {
  dark?: boolean;
  // Ẩn chứ không gỡ khỏi cây khi đang ghim nội dung khác — gỡ ra là mất kết nối đồng bộ
  hidden?: boolean;
  // Có token + meetingId → đồng bộ realtime; thiếu → chạy local
  token?: string | null;
  meetingId?: string;
}

// Không đặt langCode="vi-VN": Excalidraw 0.18.1 mới dịch 49% tiếng Việt, dưới ngưỡng 85% nên tự rơi về tiếng Anh
export function WhiteboardCanvas({ dark = false, hidden = false, token, meetingId }: WhiteboardCanvasProps) {
  const [api, setApi] = useState<ExcalidrawImperativeAPI | null>(null);
  const { onChange, onPointerUpdate, notice, clearNotice } = useWhiteboardSync({ token, meetingId, api });

  return (
    <div className="whiteboard" hidden={hidden}>
      <Excalidraw
        excalidrawAPI={setApi}
        theme={dark ? "dark" : "light"}
        onChange={onChange}
        onPointerUpdate={onPointerUpdate}
        isCollaborating={Boolean(meetingId)}
        // AI của đồ án là module riêng → tắt hộp thoại text-to-diagram / magicframe của Excalidraw
        aiEnabled={false}
        UIOptions={UI_OPTIONS}
      />
      {notice && (
        <button
          type="button"
          onClick={clearNotice}
          className="absolute bottom-3 left-1/2 z-10 -translate-x-1/2 rounded-md bg-slate-900/90 px-3 py-1.5 text-sm text-white"
        >
          {notice}
        </button>
      )}
    </div>
  );
}

export default WhiteboardCanvas;
```

- [ ] **Step 3: Truyền token + meetingId; bỏ type mock**

`MeetingWorkspace.tsx` dòng 265:

```tsx
          <WhiteboardCanvas
            dark={isDark}
            hidden={pinnedContent?.type === "track"}
            token={accessToken}
            meetingId={meetingData.meeting.id}
          />
```

`frontend/src/features/whiteboard/index.ts`:

```ts
export * from "./components/WhiteboardCanvas";
export * from "./components/AIPanel";
```

Xoá `frontend/src/features/whiteboard/types.ts` (grep trước: `WhiteboardElement|WhiteboardState` không còn file nào dùng).

- [ ] **Step 4: Lint + build**

```powershell
Set-Location frontend; npm run lint; npm run build
```
Expected: không lỗi mới trong 4 file đã sửa (lỗi có sẵn khác thì ghi lại, không sửa). Nếu tsc báo type của `restoreElements` / `reconcileElements` / `updateScene` khác plan → đối chiếu `node_modules/@excalidraw/excalidraw/dist/types/excalidraw/*.d.ts`, sửa, ghi progress.

- [ ] **Step 5: Chạy thật — 2 trình duyệt (spec §10.2)**

```powershell
docker compose up -d --build
```
2 tài khoản cùng phòng, HOST bắt đầu meeting, cả hai vào. Kiểm lần lượt, ghi kết quả từng dòng vào progress:

1. A vẽ hình chữ nhật → B thấy.
2. A **kéo** hình liên tục → B thấy hình di chuyển **trong lúc** kéo.
3. A, B cùng sửa 1 hình → hai bên ra cùng kết quả.
4. Xoá 1 hình; clear board → bên kia mất theo.
5. B tắt mạng (DevTools → Offline), A xoá 1 hình, B bật lại → hình biến mất ở B.
6. B vẽ lúc offline, bật lại → A thấy nét đó.
7. A chèn `embeddable` từ menu "thêm công cụ" → A thấy thông báo không đồng bộ; hình vẽ cùng lúc vẫn sang B.
8. Con trỏ A hiện ở B kèm tên; A dừng 5 s → con trỏ ẩn.
9. Tài khoản C vào giữa buổi → thấy đủ board.
10. HOST kick B → B vẽ tiếp thì A không thấy (console B có `error` 403).
11. HOST kết thúc meeting → Mongo:
    ```powershell
    docker exec mongo-dev mongosh <tên-db> --quiet --eval "db.whiteboards.find({}, {elementCount:1, lastSeq:1, lastPersistedAt:1}).sort({_id:-1}).limit(1)"
    docker exec redis-dev redis-cli --scan --pattern "wb:*"
    ```
    `elementCount` = số hình còn trên bảng; không còn key `wb:*` của meeting đó. (`<tên-db>` lấy từ `MONGODB_URI` trong `backend/.env`.)

- [ ] **Step 6: Ghi progress + đề xuất commit**

Progress mục "Whiteboard: Task 7" (kết quả 11 kịch bản). Đề xuất: `feat: đồng bộ whiteboard realtime ở frontend`.

---

### Task 8: Script đo độ trễ `tests/load/wb-latency.mjs`

**Files:**
- Create: `tests/load/wb-latency.mjs`

**Interfaces:**
- Consumes: REST `POST /auth/register` (`{ email, username, displayName, password }` → `{ accessToken }`), `POST /rooms` (`{ name }` → `{ id, joinCode }`), `POST /rooms/join` (`{ code }`), `POST /rooms/:roomId/meetings` (`{ title }` → `{ id }`), `POST /meetings/:meetingId/end` (204); socket Task 5.

- [ ] **Step 1: Viết script**

```js
// Đo độ trễ đồng bộ whiteboard — spec docs/task/whiteboard/whiteboard_sync_spec.md §11
// Chạy (PowerShell, từ gốc repo, backend + LiveKit đang chạy trong Docker): node tests/load/wb-latency.mjs
// Mỗi N: tạo N tài khoản bench_*, 1 phòng, 1 meeting; đo 2 kịch bản; kết thúc meeting.
// Phải xong trước MEETING_AUTO_END_AFTER_MIN (ADR-022) — không ai vào LiveKit nên room tự đóng sau vài phút
import { createRequire } from 'node:module';

// Lấy socket.io-client từ frontend/node_modules — không thêm dependency (gốc repo không có dependencies)
const require = createRequire(new URL('../../frontend/package.json', import.meta.url));
const { io } = require('socket.io-client');

const API = process.env.API_URL || 'http://localhost:3001';
const SIZES = (process.env.WB_SIZES || '2,10,20').split(',').map(Number);
const DURATION_MS = 10_000; // mỗi kịch bản 10 s
const TICK_MS = 50; // đúng chu kỳ throttle của client (spec §9)
const POINTS_PER_TICK = 3; // ~60 điểm/giây cho nét vẽ tay

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function api(path, { token, body } = {}) {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`POST ${path} → ${res.status} ${await res.text()}`);
  return res.status === 204 ? null : res.json();
}

// N tài khoản mới cùng 1 phòng; người đầu là HOST, bắt đầu meeting
async function setup(n) {
  const run = Date.now().toString(36);
  const tokens = [];
  for (let i = 0; i < n; i++) {
    const username = `bench_${run}_${i}`;
    const { accessToken } = await api('/auth/register', {
      body: { email: `${username}@example.com`, username, displayName: `Bench ${i}`, password: 'bench123' },
    });
    tokens.push(accessToken);
  }
  const room = await api('/rooms', { token: tokens[0], body: { name: `Bench ${run} N=${n}` } });
  for (const token of tokens.slice(1)) await api('/rooms/join', { token, body: { code: room.joinCode } });
  const meeting = await api(`/rooms/${room.id}/meetings`, { token: tokens[0], body: { title: `Bench N=${n}` } });
  return { tokens, meetingId: meeting.id };
}

// Kết nối + meeting:join, xong khi nhận snapshot
function connect(token, meetingId) {
  return new Promise((resolve, reject) => {
    const socket = io(`${API}/meeting`, { auth: { token }, transports: ['websocket'] });
    socket.on('connect_error', reject);
    socket.on('error', (error) => console.error('socket error', error));
    socket.on('connect', () => socket.emit('meeting:join', { meetingId }));
    socket.once('meeting:snapshot', () => resolve(socket));
  });
}

const percentile = (sorted, p) => sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];

// A gửi 1 element mỗi 50 ms trong 10 s; người nhận đo (nhận − sentAt) và đếm byte
async function scenario(name, sender, receivers, meetingId, makeElement) {
  const samples = [];
  let bytes = 0;
  let lastPayloadBytes = 0;
  const onOps = (envelope) => {
    const sentAt = envelope.data.elements[0]?.customData?.sentAt;
    if (typeof sentAt === 'number') samples.push(Date.now() - sentAt);
    bytes += Buffer.byteLength(JSON.stringify(envelope));
  };
  for (const receiver of receivers) receiver.on('wb:ops', onOps);

  const started = Date.now();
  for (let tick = 1; Date.now() - started < DURATION_MS; tick++) {
    const element = makeElement(tick);
    lastPayloadBytes = Buffer.byteLength(JSON.stringify(element));
    sender.emit('wb:ops', { meetingId, elements: [element] });
    await sleep(TICK_MS);
  }
  await sleep(1000); // chờ gói cuối
  for (const receiver of receivers) receiver.off('wb:ops', onOps);

  samples.sort((a, b) => a - b);
  return {
    scenario: name,
    samples: samples.length,
    p50_ms: percentile(samples, 50),
    p95_ms: percentile(samples, 95),
    max_ms: samples.at(-1),
    lastPayloadBytes,
    bytesPerSecPerReceiver: Math.round(bytes / receivers.length / (DURATION_MS / 1000)),
  };
}

// Kịch bản A: 1 hình chữ nhật nhỏ, version tăng mỗi tick
const rectangle = (id) => (tick) => ({
  id, type: 'rectangle', version: tick, versionNonce: tick, isDeleted: false,
  x: tick, y: 0, width: 100, height: 60, customData: { sentAt: Date.now() },
});

// Kịch bản B: 1 nét vẽ tay dài dần, mỗi lần gửi TOÀN BỘ points (như Excalidraw)
const freedraw = (id) => {
  const points = [];
  return (tick) => {
    for (let k = 0; k < POINTS_PER_TICK; k++) {
      const i = points.length;
      points.push([i * 1.37, Math.sin(i / 10) * 40.123]);
    }
    return {
      id, type: 'freedraw', version: tick, versionNonce: tick, isDeleted: false,
      x: 0, y: 0, points, pressures: [], simulatePressure: true, customData: { sentAt: Date.now() },
    };
  };
};

const results = [];
for (const n of SIZES) {
  const { tokens, meetingId } = await setup(n);
  const sockets = await Promise.all(tokens.map((token) => connect(token, meetingId)));
  const [sender, ...receivers] = sockets;
  results.push({ N: n, ...(await scenario('A element nhỏ', sender, receivers, meetingId, rectangle(`rect${n}`))) });
  results.push({ N: n, ...(await scenario('B nét vẽ tay', sender, receivers, meetingId, freedraw(`free${n}`))) });
  for (const socket of sockets) socket.disconnect();
  await api(`/meetings/${meetingId}/end`, { token: tokens[0] });
}
console.table(results);
```

- [ ] **Step 2: Chạy thử N=2**

```powershell
$env:WB_SIZES = "2"; node tests/load/wb-latency.mjs; Remove-Item Env:WB_SIZES
```
Expected: bảng 2 dòng, `samples` ≈ 190–200 mỗi kịch bản, không lỗi. Lỗi REST (vd body đăng ký sai) → đối chiếu DTO thật, sửa script, ghi progress.

- [ ] **Step 3: Chạy đủ N = 2, 10, 20**

```powershell
node tests/load/wb-latency.mjs
```
Dán bảng kết quả vào progress (mục "Whiteboard: Task 8 — số đo 1 instance"), ghi cấu hình máy (CPU, RAM, Docker Desktop).

- [ ] **Step 4: Đề xuất commit**

Đề xuất: `test: script đo độ trễ đồng bộ whiteboard`.

---

### Task 9: Cập nhật tài liệu

**Files:**
- Modify: `docs/PROJECT_CONTEXT.md` §9, §10, §11
- Modify: `docs/architecture/whiteboard.md` §1–§5
- Modify: `docs/database/DB_DESIGN.md` §C.8, Phần E
- Modify: `docs/api/endpoint.md` (thêm mục sau "### Socket.IO chat")
- Modify: `docs/decisions.md` (ADR-028…031, sửa ADR-014)
- Modify: `docs/progress.md`

- [ ] **Step 1: PROJECT_CONTEXT §9** — bảng Client → Server: `meeting:join` thành `{ meetingId }`; thêm dòng `meeting:leave | { meetingId }`; `wb:ops` thành `{ meetingId, elements[] }`; `wb:pointer` thành `{ meetingId, x, y }`; **xoá** dòng `wb:resync`. Bảng Server → Client: `meeting:snapshot` thành `envelope, data: { elements[] } — gửi riêng socket vừa join, gồm cả tombstone`; `wb:ops` thành `envelope, data: { elements[] } — chỉ element thắng, kênh meeting:{id} trừ người gửi`; `wb:pointer` thành `envelope seq null, data: { userId, displayName, x, y } — volatile`. Mục "Ordering, duplicate, reconnection": thay 2 gạch "Ring buffer 500 op…" và "Client reconnect gửi lastSeq…" bằng: `- Join / reconnect: client gửi lại meeting:join, server trả full snapshot từ Redis (không ring buffer — ADR-029)`.

- [ ] **Step 2: PROJECT_CONTEXT §10** — khối "Luồng": `debounce ~150ms` → `throttle 50 ms`; `merge LWW vào Redis live state` → `Lua wb-apply merge LWW vào Redis Hash (atomic, ADR-028)`; `broadcast qua Redis adapter tới MỌI instance` giữ; thêm dòng đầu luồng server `→ Backend: validate + socket đã ở kênh meeting:{id}`. Gạch "Echo loop… cờ isApplyingRemote" → `Echo loop: map id → version đã gửi / nhận (ADR-031)`. Gạch "Hàm merge nằm ở shared/…" → `Luật LWW: server trong Lua, client dùng reconcileElements của Excalidraw — cùng luật, client thêm lớp giữ thao tác đang dở (ADR-028). Hằng số dùng chung ở backend/src/shared/whiteboard.ts`.

- [ ] **Step 3: PROJECT_CONTEXT §11** — đoạn "Không ghi Mongo mỗi op…" thay bằng: `Không ghi Mongo mỗi op. Sau op có thay đổi: SET wb:persist-lock:{id} NX PX 15000, instance giành được khoá ghi nền; endMeeting ghi bản cuối rồi xoá key Redis (ADR-030). Không timer RAM, không cron, không ghi khi graceful shutdown (state ở Redis).` Đoạn "Ràng buộc 16 MB" thêm: `5.000 tính element còn hiển thị; Mongo không lưu tombstone`. Sau khối code guard thêm: `Filter không khớp vì đã có lastSeq ≥ seq → upsert ném E11000 → bắt và bỏ qua (đã có bản mới hơn).`

- [ ] **Step 4: `whiteboard.md`** — §1 câu "Hàm merge nằm ở shared/…" sửa như Step 2; §2 luồng sửa như Step 2; §3 dòng "Echo loop" → map version, thêm dòng `Element không được phép (embeddable…) | client lọc theo shared/whiteboard.ts, server từ chối cả batch`; §4 thay như Step 3 + thêm `wb:alive:{id}`; §5 thay bằng `Join / reconnect luôn nhận full snapshot (gồm tombstone) — ADR-029`. Xoá 2 chỗ trỏ tới `realtime.md` / `security.md` (file không tồn tại).

- [ ] **Step 5: DB_DESIGN** — Phần E bảng key: `wb:{meetingId}` → `Hash (elementId → JSON) | 24h | Live state, gồm tombstone`; thêm `wb:alive:{meetingId} | String | 24h | Số element chưa xoá (Lua)` và `wb:persist-lock:{meetingId} | String | 15 s | Khoá giới hạn ghi Mongo`; **xoá** dòng `wb:ops:{meetingId}`. §C.8 thêm ghi chú: `elementsGzip chỉ chứa element chưa xoá; elementCount = số element đó`.

- [ ] **Step 6: `endpoint.md`** — thêm sau mục "### Socket.IO chat":

```markdown
### Socket.IO whiteboard
Cùng namespace `/meeting`. Spec: `docs/task/whiteboard/whiteboard_sync_spec.md` §3.

| Client → Server | Payload | Lỗi (`error`) |
|---|---|---|
| `meeting:join` | `{ meetingId }` | 400 sai định dạng · 404 không có meeting · 403 không phải thành viên · 409 meeting đã kết thúc |
| `meeting:leave` | `{ meetingId }` | 400 |
| `wb:ops` | `{ meetingId, elements[] }` — 1–100 element, ≤ 512 KB; mỗi element có `id`, `type` (rectangle, diamond, ellipse, arrow, line, freedraw, text, frame), `version` ≥ 1, `versionNonce`, `isDeleted` | 400 sai / vượt 5.000 đối tượng · 403 chưa join |
| `wb:pointer` | `{ meetingId, x, y }` (±1e7) | 400 · 403 |

| Server → Client | `data` | Gửi tới |
|---|---|---|
| `meeting:snapshot` | `{ elements[] }` (gồm tombstone), `seq` hiện tại hoặc `null` | riêng socket vừa join |
| `wb:ops` | `{ elements[] }` — chỉ element thắng LWW | kênh `meeting:{id}` trừ người gửi |
| `wb:pointer` | `{ userId, displayName, x, y }`, `seq: null`, volatile | kênh `meeting:{id}` trừ người gửi |

Kick / rời phòng / meeting kết thúc → server ép socket rời kênh `meeting:{id}` trên mọi instance; `wb:*` sau đó trả 403.
```

- [ ] **Step 7: `decisions.md`** — ADR-014 thêm câu cuối phần Decision: `5.000 tính element còn hiển thị; tombstone không lưu xuống Mongo (ADR-028).` Thêm cuối file:

```markdown
## ADR-028 — Live state whiteboard = Redis Hash + script Lua `wb-apply` `[phát sinh kỹ thuật]`
**Decision:** `wb:{meetingId}` là Hash `elementId → JSON`. Mỗi `wb:ops` chạy 1 script Lua atomic: so LWW từng element (luật `shouldDiscardRemoteElement` của Excalidraw 0.18.1, dấu `<`), đếm element còn hiển thị (`wb:alive:{id}`), kiểm giới hạn 5.000 còn hiển thị / 20.000 tổng **trước khi ghi**, `INCR` seq. Server Lua trước rồi mới phát. Client dùng `reconcileElements` của Excalidraw (cùng luật + giữ element đang gõ / kéo / vẽ dở). Tombstone giữ ở Redis (snapshot cần), không xuống Mongo. Client lọc type theo `backend/src/shared/whiteboard.ts`, server từ chối cả batch nếu có element sai.
**Reason:** String gzip + đọc–merge–ghi mất op khi 2 instance ghi cùng board; WATCH/MULTI retry liên tục ở ~130 op/s/board. Lua chạy tuần tự trong Redis → atomic, 1 round-trip (<1 ms cùng host). Không viết hàm LWW TS ở `shared/` vì không ai gọi (server dùng Lua, client dùng Excalidraw) — lệch câu "dùng chung một bản" của PROJECT_CONTEXT §10.
**Alternatives:** String gzip + WATCH/MULTI; Hash + WATCH/MULTI; server chỉ relay như `excalidraw-room`; phát trước rồi ghi Redis nền.
**Rejected because:** WATCH xung đột cả key → retry; relay không có snapshot / validate / lưu server (trái §9, §14, đề cương §5.8); phát trước thì giới hạn 5.000 bị từ chối sau khi mọi người đã thấy.
**Status:** CONFIRMED — user chốt 2026-11-03. Chi tiết: `docs/task/whiteboard/whiteboard_sync_spec.md` §1, §4.

## ADR-029 — Bỏ ring buffer / replay; join và reconnect luôn nhận full snapshot `[phát sinh kỹ thuật]`
**Decision:** Bỏ `wb:ops:{meetingId}` (ring buffer 500 op), event `wb:resync`, `lastSeq` trong `meeting:join`. Server luôn trả `meeting:snapshot` từ Hash.
**Reason:** Đề cương không yêu cầu; bớt 1 key, 1 event, 1 nhánh logic. Board học nhóm nhỏ, tải lại cả board khi reconnect chấp nhận được.
**Alternatives:** giữ ring buffer + replay diff theo `lastSeq`.
**Rejected because:** thêm code cho lợi ích chỉ thấy với board rất lớn.
**Status:** CONFIRMED — user chốt 2026-11-02.

## ADR-030 — Lưu whiteboard xuống Mongo bằng `SET NX PX 15000`, bản cuối ở `endMeeting` `[phát sinh kỹ thuật]`
**Decision:** Sau mỗi op có element thắng: `SET wb:persist-lock:{id} 1 NX PX 15000`; instance giành được khoá đọc Hash + seq trong 1 `MULTI`, ghi gzip element chưa xoá với guard `lastSeq` (ADR-015), E11000 → bỏ qua. `endMeeting` (mọi đường kết thúc) ép socket rời kênh rồi ghi bản cuối, thành công thì xoá key Redis; Redis rỗng thì không ghi.
**Reason:** `setTimeout` debounce nằm trong RAM 1 instance → vi phạm stateless (ràng buộc #5), instance chết là mất timer. Không cần cron / lock nhả bằng Lua (cùng lý do ADR-022). RPO: Mongo chậm tối đa ~15 s khi đang vẽ; 15 s cuối nằm ở Redis tới khi kết thúc.
**Alternatives:** debounce 15 s + ép 60 s bằng timer (PROJECT_CONTEXT §11 cũ); cron + distributed lock.
**Rejected because:** timer RAM không stateless; cron thêm job + lock cho cùng kết quả.
**Status:** CONFIRMED — user chốt 2026-11-02.

## ADR-031 — Client gửi op bằng throttle 50 ms, chống echo bằng map version `[phát sinh kỹ thuật]`
**Decision:** `onChange` → throttle 50 ms (chạy ngay lần đầu + cuối chu kỳ) → gửi element có `version` lớn hơn map `id → version đã gửi / nhận`; ghi map lúc gửi và lúc nhận. Con trỏ throttle 50 ms, phát `volatile`.
**Reason:** Debounce chỉ gửi khi người dùng dừng tay → kéo hình liên tục người khác không thấy gì tới khi thả (user ưu tiên độ trễ realtime). Cờ `isApplyingRemote` hỏng khi `onChange` chạy sau lúc tắt cờ; Excalidraw cũng chống echo bằng version.
**Alternatives:** debounce ~150 ms + cờ `isApplyingRemote` (PROJECT_CONTEXT §10 cũ).
**Rejected because:** độ trễ khi kéo / vẽ liên tục.
**Status:** CONFIRMED — user chốt 2026-11-03. Băng thông nét vẽ tay dài đo ở `tests/load/wb-latency.mjs` kịch bản B.
```

- [ ] **Step 8: Progress** — mục "Whiteboard: Task 9 — tài liệu", liệt kê file đã sửa. Sửa bảng "Code hiện có" đầu `progress.md`: dòng "Meetings, chat, whiteboard" → whiteboard đã có đồng bộ realtime; dòng "Socket gateway /meeting" → có JWT, validate, chat, whiteboard; dòng Frontend → đã có `socket.io-client`, LiveKit, Excalidraw đồng bộ.

- [ ] **Step 9: Đề xuất commit**

Đề xuất: `docs: whiteboard đồng bộ realtime — §9 §10 §11, ADR-028…031`.

---

## Self-review (người viết plan, 2026-11-03)

- **Spec coverage:** §3.1–3.3 → Task 4, 5, 6 · §3.4, §12 → Task 9 · §4 → Task 2, 3 · §5 → Task 3, 6 · §6 → Task 1, 5 · §7 → Task 3, 5, 6 · §8 → Task 1–6 · §9 → Task 7 · §10.1 → Task 1–6 · §10.2 → Task 7 Step 5 · §10.3 → Task 6 Step 4, Task 7 Step 4 · §11 → Task 8 · §13 → Task 9 (ADR) + progress.
- **Đã kiểm khi viết:** Lua chạy trên `redis-dev` (9 ca); export `reconcileElements`, `restoreElements`, `CaptureUpdateAction` và props `aiEnabled`, `UIOptions.tools.image`, `onPointerUpdate`, `isCollaborating` trong types 0.18.1; `Namespace.volatile`, `BroadcastOperator.except` trong socket.io đã cài; `socket.io-client` 4.8.4 có export `require`; RedisService `getClient()`; `removeFromActiveMeeting`, `endMeeting` thật; không có vòng import module.
- **Chưa kiểm được lúc viết (executor kiểm ở bước chạy thật):** `client.eval` của node-redis trả số nguyên Lua thành `number` (Task 6 Step 5); `isCollaborating` có làm hiện thêm UI không mong muốn (Task 7 Step 5 — nếu có thì bỏ prop, ghi progress); type chính xác của `restoreElements` khi truyền `unknown[]` (Task 7 Step 4).
