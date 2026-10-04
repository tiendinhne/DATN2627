# Module Room — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Làm đủ module room theo spec: bảng quyền HOST/MEMBER, tạo / tham gia / xem / sửa phòng, kick, rời, giải tán, import/export thành viên, và frontend tương ứng.

**Architecture:** Module CRUD thuần, layered đơn giản: `RoomsController` → `RoomsService` → schema (ràng buộc 9 — không có hệ ngoài nên không có ports/adapters). Kiểm tra quyền đi qua `RoomAccessService` có sẵn ở module `room-members`, thêm hàm `assertRoomPermission` dựa trên bảng tra `shared/permissions.ts`. Rate limit đặt trong Redis để đúng khi chạy nhiều instance. Không có transaction (Mongo standalone) → mọi thao tác ghi được thiết kế để đúng khi chạy đồng thời (`deletedCount`, `upsertedCount`, unique index).

**Tech Stack:** NestJS 12 · ESM · Mongoose 9 · redis 4 · class-validator · vitest 4 · Next.js 16 (App Router, client component) · Tailwind 4

**Spec:** `docs/task/room/room_module_spec.md` (đọc cùng plan này). Task list gốc: `docs/task/room/room_module_tasks.md`.

## Cách chạy: mỗi session một task

Mở session mới cho từng task theo thứ tự, dán prompt dưới đây (đổi `N`). Không chạy 2 session song song (Task 2–8 cùng sửa `rooms.service.ts`). Không dùng worktree — `docs/task/` bị gitignore nên worktree mới không có spec/plan. Các điểm "cần user duyệt" của Task 9 đã chốt 2026-09-27 (ghi ở đầu Task 9; phát sinh thêm Task 9a thống nhất npm và Task 9b cài shadcn, mỗi task một phiên riêng, làm trước Task 9). Điểm của Task 8 chốt trước khi làm Task 8.

```
Làm Task N trong docs/task/room/room_module_plan.md bằng skill superpowers:executing-plans. CHỈ Task N, xong thì dừng.

Đọc trước khi làm:
1. docs/progress.md — mục "2026-09-26 — Module room" (task trước bàn giao gì, lệch gì)
2. docs/task/room/room_module_spec.md
3. Trong plan: phần đầu (Global Constraints, File map) + toàn bộ Task N

Trước khi code: git status sạch, chạy `npm test` (PowerShell, trong backend) phải pass.
Không dùng worktree.

Khi làm:
- Code trong plan là bản nháp, test + spec mới là chuẩn. Không sửa test cho khớp code sai.
- Lỗi kỹ thuật nhỏ: tự sửa. Cách làm khác plan nhưng giữ hành vi: được, ghi lại.
- Đổi hành vi / API / business rule / test: DỪNG, hỏi tôi.
- Nếu thay đổi ảnh hưởng tới Interfaces của task sau: sửa luôn các task đó trong plan.

Khi xong:
- Dán output `npm test` + `npm run build`.
- Ghi progress: task, số test pass, lệch khỏi plan, điều task sau cần biết.
- Hỏi tôi trước khi commit.
```

## Global Constraints

- Import tương đối trong **backend** kết thúc bằng `.js` (ESM): `from './rooms.service.js'`. Frontend dùng alias `@/...`, không thêm `.js`.
- Response trả `id`, không `_id` — map trong service (`toRoomResponse`).
- Mọi entry point có validate: DTO class-validator cho body/query; `:roomId` được `assertRoomAccess` kiểm; `:userId` kiểm bằng `Types.ObjectId.isValid`.
- Quyền quyết định ở backend. Frontend chỉ ẩn/hiện nút.
- Không `Map`/`Set`/biến **module-level** giữ state theo user/room. Biến cục bộ trong hàm thì được.
- Không thêm dependency, trừ shadcn/ui và các package CLI của nó tự cài (user duyệt 2026-09-27 — Task 9b). Chỉ dùng npm, không dùng pnpm (ADR-021); lệnh cài backend: `npm install --legacy-peer-deps`.
- Lệnh `npm` chạy bằng **PowerShell**. Backend: `Set-Location backend`. Frontend: `Set-Location frontend`.
- Ghi chú code ngắn, tiếng Việt, dễ hiểu — theo mật độ comment của `room-access.service.ts`.
- Test trước với service có logic (TDD). Không test DTO, schema, controller mỏng, page UI.
- **Commit chỉ khi user cho phép** trong phiên thực thi. Message: `<type>: <mô tả>`, type ∈ `feat fix refactor test docs chore`, kết thúc bằng dòng `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. `docs/task/` bị `.gitignore` → spec/plan không commit.
- Sau mỗi task: thêm vào mục "2026-09-26 — Module room" trong `docs/progress.md` một dòng: task, commit (hoặc "chưa commit"), quyết định/lệch nảy sinh.

**Thứ tự làm:** 1 → 2 → 3 → 4 → 5 → 6 → 7 → 9a → 9b → 9 → 8a → 10 (dừng giữa chừng 2026-10-01) → **10a** → 10 (làm lại); **Task 8 hoãn** (user chốt 2026-09-28 — làm sau, trước khi bảo vệ). (9a thống nhất npm, 9b cài shadcn — thêm 2026-09-27; 8a HOST thêm 1 thành viên bằng email — thêm 2026-09-28.)

---

## File map

| File | Việc | Task |
|---|---|---|
| `backend/src/shared/permissions.ts` | **Tạo** — bảng quyền + `can()` | 1 |
| `backend/src/shared/permissions.spec.ts` | **Tạo** — test | 1 |
| `backend/src/modules/room-members/room-access.service.ts` | Thêm `assertRoomPermission`, bỏ `isBanned` | 1 |
| `backend/src/modules/room-members/room-access.service.spec.ts` | Sửa test `isBanned`, thêm test permission | 1 |
| `backend/src/modules/room-members/schemas/room-member.schema.ts` | Bỏ `isBanned` | 1 |
| `backend/src/modules/rooms/rooms.service.ts` | **Tạo** — toàn bộ logic room | 2–8 |
| `backend/src/modules/rooms/rooms.service.spec.ts` | **Tạo** — test | 2–8 |
| `backend/src/modules/rooms/rooms.controller.ts` | **Tạo** — route | 2–8 |
| `backend/src/modules/rooms/dto/*.dto.ts` | **Tạo** — `create-room`, `join-room`, `update-room`, `list-rooms-query`, `import-members` | 2,3,4,8 |
| `backend/src/modules/rooms/rooms.module.ts` | Đăng ký controller, service, model `RoomMember` (+ `User` ở Task 8), import `RoomMembersModule` | 2, 8 |
| `frontend/components.json`, `frontend/src/lib/utils.ts`, `frontend/src/components/ui/*.tsx`, `frontend/app/globals.css`, `frontend/package.json`, `frontend/package-lock.json` | **Tạo/Sửa** — CLI shadcn sinh ra (`dialog` thêm ở Task 8) | 9b, 8 |
| `package.json`, `package-lock.json` (gốc), `backend/package.json`, `backend/package-lock.json`, `frontend/package.json` | Sửa / xoá lockfile gốc — thống nhất npm, bỏ workspace (ADR-021) | 9a |
| `frontend/src/types/room.ts` | **Tạo** — kiểu dữ liệu | 9, 8 |
| `frontend/src/services/room.service.ts` | **Tạo** — gọi API | 9, 8 |
| `frontend/src/lib/return-url.ts` | **Tạo** — `safeReturnUrl` chống open redirect | 9 |
| `frontend/app/rooms/page.tsx` | **Tạo** — danh sách + tạo + nhập mã | 9 |
| `frontend/app/rooms/[roomId]/page.tsx` | **Tạo** — chi tiết phòng | 9, 8 |
| `frontend/app/join/[code]/page.tsx` | **Tạo** — vào phòng bằng link | 9 |
| `frontend/app/login/page.tsx`, `frontend/app/auth/callback/page.tsx`, `frontend/app/dashboard/page.tsx` | Sửa — `returnUrl`, link sang `/rooms` | 9 |
| `frontend/src/features/rooms/ImportMembersDialog.tsx` | **Tạo** — dialog import có bước review | 8 |
| `docs/database/DB_DESIGN.md`, `docs/decisions.md`, `docs/api/endpoint.md`, `docs/progress.md` | Cập nhật | 1–10 |

---

### Task 1: Bảng quyền HOST/MEMBER + `assertRoomPermission` + bỏ `isBanned`

**Files:**
- Create: `backend/src/shared/permissions.ts`
- Test: `backend/src/shared/permissions.spec.ts`
- Modify: `backend/src/modules/room-members/room-access.service.ts`
- Modify: `backend/src/modules/room-members/room-access.service.spec.ts`
- Modify: `backend/src/modules/room-members/schemas/room-member.schema.ts`
- Modify: `docs/database/DB_DESIGN.md` (§C.4), `docs/decisions.md`, `docs/api/endpoint.md` (mục Chat)

**Interfaces:**
- Produces:
  - `enum RoomAction { UPDATE_ROOM, DISSOLVE_ROOM, KICK_MEMBER, IMPORT_MEMBERS, EXPORT_MEMBERS, MANAGE_MEETING }` (giá trị string trùng tên)
  - `can(role: RoomRole, action: RoomAction): boolean`
  - `RoomAccessService.assertRoomPermission(userId: string, roomId: string, action: RoomAction): Promise<member lean>` — 403 nếu role không được phép; lỗi 400/404/403 của `assertRoomAccess` giữ nguyên.
  - `RoomAccessService.assertRoomAccess` không còn lọc `isBanned`.

- [x] **Step 1: Viết test bảng quyền (fail)**

`backend/src/shared/permissions.spec.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { RoomAction, can } from './permissions.js';
import { RoomRole } from './enums.js';

describe('can', () => {
  it('HOST được làm mọi hành động trong bảng', () => {
    for (const action of Object.values(RoomAction)) {
      expect(can(RoomRole.HOST, action)).toBe(true);
    }
  });

  it('MEMBER không được làm hành động nào trong bảng (bảng chỉ chứa hành động dành cho HOST)', () => {
    for (const action of Object.values(RoomAction)) {
      expect(can(RoomRole.MEMBER, action)).toBe(false);
    }
  });
});
```

- [x] **Step 2: Chạy test, xác nhận fail**

Run (PowerShell, trong `backend`): `npm test -- src/shared/permissions.spec.ts`
Expected: FAIL — `Failed to load url ./permissions.js` / không tìm thấy module.

- [x] **Step 3: Viết `permissions.ts`**

`backend/src/shared/permissions.ts`:
```ts
import { RoomRole } from './enums.js';

// Các hành động bị giới hạn theo role (docs/rule/role.md).
// Hành động mà mọi thành viên đều làm được (chat, vẽ, AI, upload, media) KHÔNG nằm ở đây —
// chỉ cần là thành viên, kiểm bằng RoomAccessService.assertRoomAccess.
export enum RoomAction {
  UPDATE_ROOM = 'UPDATE_ROOM',
  DISSOLVE_ROOM = 'DISSOLVE_ROOM',
  KICK_MEMBER = 'KICK_MEMBER',
  IMPORT_MEMBERS = 'IMPORT_MEMBERS',
  EXPORT_MEMBERS = 'EXPORT_MEMBERS',
  MANAGE_MEETING = 'MANAGE_MEETING', // tạo / kết thúc meeting — module meeting dùng
}

// Bảng tra: hành động → những role được phép (§15 — dữ liệu, không phải if-else)
export const ROOM_PERMISSIONS: Record<RoomAction, readonly RoomRole[]> = {
  [RoomAction.UPDATE_ROOM]: [RoomRole.HOST],
  [RoomAction.DISSOLVE_ROOM]: [RoomRole.HOST],
  [RoomAction.KICK_MEMBER]: [RoomRole.HOST],
  [RoomAction.IMPORT_MEMBERS]: [RoomRole.HOST],
  [RoomAction.EXPORT_MEMBERS]: [RoomRole.HOST],
  [RoomAction.MANAGE_MEETING]: [RoomRole.HOST],
};

export function can(role: RoomRole, action: RoomAction): boolean {
  return ROOM_PERMISSIONS[action].includes(role);
}
```

- [x] **Step 4: Chạy test, xác nhận pass**

Run: `npm test -- src/shared/permissions.spec.ts`
Expected: PASS 2/2.

- [x] **Step 5: Sửa test `room-access.service.spec.ts` (fail)**

Đổi dòng import enum và thêm import permission ở đầu file:
```ts
import { MeetingStatus, RoomRole, RoomStatus } from '../../shared/enums.js';
import { RoomAction } from '../../shared/permissions.js';
```

Thay test `'không phải thành viên hoặc bị ban → 403 (lọc ngay trong query)'` bằng:
```ts
  it('không phải thành viên → 403 (lọc ngay trong query)', async () => {
    const { service, memberModel } = build({ room: { _id: roomId }, member: null });
    await expect(service.assertRoomAccess(userId, roomId)).rejects.toBeInstanceOf(ForbiddenException);
    expect(memberModel.findOne).toHaveBeenCalledWith({ roomId, userId });
  });
```

Thêm vào cuối file:
```ts
describe('assertRoomPermission', () => {
  it('MEMBER làm hành động dành cho HOST → 403', async () => {
    const member = { roomId, userId, role: RoomRole.MEMBER };
    const { service } = build({ room: { _id: roomId }, member });
    await expect(
      service.assertRoomPermission(userId, roomId, RoomAction.KICK_MEMBER),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('HOST → trả về membership', async () => {
    const member = { roomId, userId, role: RoomRole.HOST };
    const { service } = build({ room: { _id: roomId }, member });
    await expect(
      service.assertRoomPermission(userId, roomId, RoomAction.KICK_MEMBER),
    ).resolves.toEqual(member);
  });

  it('không phải thành viên → 403 từ assertRoomAccess', async () => {
    const { service } = build({ room: { _id: roomId }, member: null });
    await expect(
      service.assertRoomPermission(userId, roomId, RoomAction.KICK_MEMBER),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
```

- [x] **Step 6: Chạy test, xác nhận fail**

Run: `npm test -- src/modules/room-members/room-access.service.spec.ts`
Expected: FAIL — test `không phải thành viên` (query còn `isBanned: false`) và 3 test `assertRoomPermission` (`service.assertRoomPermission is not a function`).

- [x] **Step 7: Sửa `room-access.service.ts`**

Thêm import:
```ts
import { RoomAction, can } from '../../shared/permissions.js';
```

Trong `assertRoomAccess`, đổi comment + query thành viên:
```ts
  // User phải là thành viên của một room còn hoạt động
  async assertRoomAccess(userId: string, roomId: string) {
```
```ts
    const member = await this.memberModel
      .findOne({ roomId, userId })
      .lean()
      .exec();
```

Thêm method ngay sau `assertRoomAccess`:
```ts
  // Thành viên + role được phép làm hành động này (tra bảng shared/permissions.ts)
  async assertRoomPermission(userId: string, roomId: string, action: RoomAction) {
    const member = await this.assertRoomAccess(userId, roomId);
    if (!can(member.role, action)) {
      throw new ForbiddenException('Bạn không có quyền thực hiện thao tác này');
    }
    return member;
  }
```

- [x] **Step 8: Bỏ `isBanned` khỏi schema**

Trong `backend/src/modules/room-members/schemas/room-member.schema.ts` xoá:
```ts
  @Prop({ default: false })
  isBanned?: boolean;
```

- [ ] **Step 9: Chạy toàn bộ test + build**

Run: `npm test`
Expected: PASS toàn bộ (permissions 2, room-access 12).
Run: `npm run build`
Expected: build xong, không lỗi TS.

- [x] **Step 10: Cập nhật tài liệu**

`docs/database/DB_DESIGN.md` §C.4 — xoá 2 dòng:
```ts
  @Prop({ default: false })
  isBanned: boolean;
```
và thêm dưới khối code một dòng: `Kick = xoá bản ghi (không có ban) — ADR-020.`

`docs/api/endpoint.md` mục `GET /rooms/:roomId/messages`: đổi `Quyền: thành viên room, không bị ban.` → `Quyền: thành viên room.`

`docs/decisions.md` thêm cuối file:
```markdown

## ADR-020 — Mỗi room một HOST cố định, kick = xoá thành viên
**Decision:** Người tạo là HOST duy nhất, không chuyển host. Kick = xoá bản ghi `room_members` (vào lại được bằng mã), bỏ `isBanned`. HOST không rời phòng, chỉ giải tán. Quyền HOST tra bảng `shared/permissions.ts`.
**Reason:** Đề cương §5.4 (chủ phòng quản lý thành viên, kết thúc phòng); `docs/rule/role.md` ("Call API delete member"). Chỉ có 2 role → "đổi role" không có ý nghĩa. Chuyển host phải ghi 3 document mà Mongo standalone không có transaction.
**Alternatives:** kick = ban (`isBanned`); có chuyển host.
**Rejected because:** không có UI gỡ ban → trạng thái chết; chuyển host lỗi giữa chừng có thể để lại 2 HOST.
**Status:** CONFIRMED — user chốt 2026-09-26.
```

- [ ] **Step 11: Commit (khi user cho phép)**

```bash
git add backend/src/shared/permissions.ts backend/src/shared/permissions.spec.ts backend/src/modules/room-members docs/database/DB_DESIGN.md docs/decisions.md docs/api/endpoint.md docs/progress.md
git commit -m "feat: bảng quyền room và assertRoomPermission, bỏ isBanned"
```

---

### Task 2: Tạo phòng — `POST /rooms`

**Files:**
- Create: `backend/src/modules/rooms/dto/create-room.dto.ts`
- Create: `backend/src/modules/rooms/rooms.service.ts`
- Test: `backend/src/modules/rooms/rooms.service.spec.ts`
- Create: `backend/src/modules/rooms/rooms.controller.ts`
- Modify: `backend/src/modules/rooms/rooms.module.ts`
- Modify: `docs/api/endpoint.md`

**Interfaces:**
- Consumes: `RoomAccessService` (Task 1), `RedisService` (`incr`, `expire` — dùng từ Task 3).
- Produces:
  - `generateJoinCode(): string` — 8 ký tự `[A-Z2-7]`.
  - `toRoomResponse(room, myRole): RoomResponse` với `RoomResponse = { id, name, description, joinCode, ownerId, status, memberCount, createdAt, myRole }`.
  - `class RoomsService` — constructor `(roomModel, memberModel, access: RoomAccessService, redis: RedisService)`; Task 8 thêm `userModel` vào **cuối**.
  - `RoomsService.createRoom(userId: string, dto: CreateRoomDto): Promise<RoomResponse>`
  - Trong spec: helper `query()`, `q()`, `fakeRoom()`, `build()` — các task sau thêm test vào cùng file, dùng lại helper này.

- [ ] **Step 1: Viết DTO**

`backend/src/modules/rooms/dto/create-room.dto.ts`:
```ts
import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

// Bỏ khoảng trắng 2 đầu trước khi validate (tên toàn dấu cách = rỗng)
const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class CreateRoomDto {
  @Transform(trim)
  @IsString()
  @MinLength(1, { message: 'Tên phòng không được để trống' })
  @MaxLength(100, { message: 'Tên phòng tối đa 100 ký tự' })
  name!: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(500, { message: 'Mô tả tối đa 500 ký tự' })
  description?: string;
}
```

- [ ] **Step 2: Viết test (fail)**

`backend/src/modules/rooms/rooms.service.spec.ts`:
```ts
import { describe, it, expect, vi } from 'vitest';
import { InternalServerErrorException } from '@nestjs/common';
import { Types } from 'mongoose';
import { RoomsService, generateJoinCode } from './rooms.service.js';
import { RoomRole, RoomStatus } from '../../shared/enums.js';

// Query Mongoose giả: lean/sort/populate/select nối chuỗi, exec() trả result
function query(result: unknown) {
  const chain: any = {
    lean: vi.fn(() => chain),
    sort: vi.fn(() => chain),
    populate: vi.fn(() => chain),
    select: vi.fn(() => chain),
    exec: vi.fn().mockResolvedValue(result),
  };
  return chain;
}

// vi.fn trả về query giả; nhận mọi tham số để test đọc lại bằng mock.calls
const q = (result: unknown) => vi.fn((..._args: any[]) => query(result));

const userId = new Types.ObjectId().toString();
const roomId = new Types.ObjectId().toString();

function fakeRoom(overrides: Record<string, unknown> = {}) {
  return {
    _id: new Types.ObjectId(roomId),
    name: 'Nhóm Toán',
    description: '',
    joinCode: 'ABCDEFGH',
    ownerId: new Types.ObjectId(userId),
    status: RoomStatus.ACTIVE,
    memberCount: 1,
    createdAt: new Date('2026-09-26T00:00:00Z'),
    ...overrides,
  };
}

function build() {
  const roomModel = {
    create: vi.fn(),
    findOne: q(null),
    findById: q(null),
    findOneAndUpdate: q(null),
    updateOne: q({ modifiedCount: 1 }),
    deleteOne: q({ deletedCount: 1 }),
  };
  const memberModel = {
    create: vi.fn().mockResolvedValue({}),
    findOne: q(null),
    find: q([]),
    aggregate: q([]),
    deleteOne: q({ deletedCount: 1 }),
  };
  // Mặc định: là thành viên thường, và có quyền HOST khi hỏi assertRoomPermission
  const access = {
    assertRoomAccess: vi.fn().mockResolvedValue({ role: RoomRole.MEMBER }),
    assertRoomPermission: vi.fn().mockResolvedValue({ role: RoomRole.HOST }),
  };
  const redis = {
    incr: vi.fn().mockResolvedValue(1),
    expire: vi.fn().mockResolvedValue(true),
  };
  const service = new RoomsService(roomModel as any, memberModel as any, access as any, redis as any);
  return { service, roomModel, memberModel, access, redis };
}

// Lỗi trùng unique index của Mongo
const duplicateKeyError = () => Object.assign(new Error('E11000 duplicate key'), { code: 11000 });

describe('generateJoinCode', () => {
  it('8 ký tự base32 A–Z, 2–7', () => {
    expect(generateJoinCode()).toMatch(/^[A-Z2-7]{8}$/);
  });
});

describe('createRoom', () => {
  it('tạo room memberCount 1, người tạo thành HOST, response trả id', async () => {
    const { service, roomModel, memberModel } = build();
    const room = fakeRoom();
    roomModel.create.mockResolvedValue(room);

    const res = await service.createRoom(userId, { name: 'Nhóm Toán' });

    expect(roomModel.create).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Nhóm Toán', ownerId: userId, memberCount: 1 }),
    );
    expect(memberModel.create).toHaveBeenCalledWith({ roomId: room._id, userId, role: RoomRole.HOST });
    expect(res).toMatchObject({ id: roomId, ownerId: userId, myRole: RoomRole.HOST, memberCount: 1 });
    expect(res).not.toHaveProperty('_id');
  });

  it('joinCode trùng → sinh mã khác rồi thử lại', async () => {
    const { service, roomModel } = build();
    roomModel.create.mockRejectedValueOnce(duplicateKeyError()).mockResolvedValueOnce(fakeRoom());

    await service.createRoom(userId, { name: 'Nhóm Toán' });

    expect(roomModel.create).toHaveBeenCalledTimes(2);
    expect(roomModel.create.mock.calls[1][0].joinCode).toMatch(/^[A-Z2-7]{8}$/);
  });

  it('trùng mã 5 lần liên tiếp → 500', async () => {
    const { service, roomModel } = build();
    roomModel.create.mockRejectedValue(duplicateKeyError());

    await expect(service.createRoom(userId, { name: 'X' })).rejects.toBeInstanceOf(InternalServerErrorException);
    expect(roomModel.create).toHaveBeenCalledTimes(5);
  });

  it('tạo member HOST lỗi → xoá room vừa tạo và ném lại lỗi', async () => {
    const { service, roomModel, memberModel } = build();
    const room = fakeRoom();
    roomModel.create.mockResolvedValue(room);
    memberModel.create.mockRejectedValue(new Error('mongo down'));

    await expect(service.createRoom(userId, { name: 'X' })).rejects.toThrow('mongo down');
    expect(roomModel.deleteOne).toHaveBeenCalledWith({ _id: room._id });
  });
});
```

- [ ] **Step 3: Chạy test, xác nhận fail**

Run: `npm test -- src/modules/rooms/rooms.service.spec.ts`
Expected: FAIL — không tìm thấy `./rooms.service.js`.

- [ ] **Step 4: Viết `rooms.service.ts`**

`backend/src/modules/rooms/rooms.service.ts`:
```ts
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { randomInt } from 'node:crypto';
import { Room } from './schemas/room.schema.js';
import type { RoomDocument } from './schemas/room.schema.js';
import { RoomMember } from '../room-members/schemas/room-member.schema.js';
import type { RoomMemberDocument } from '../room-members/schemas/room-member.schema.js';
import { RoomAccessService } from '../room-members/room-access.service.js';
import { RedisService } from '../../common/services/redis.service.js';
import { RoomRole, RoomStatus } from '../../shared/enums.js';
import { CreateRoomDto } from './dto/create-room.dto.js';

// Mã tham gia: 8 ký tự base32, ngẫu nhiên, không tuần tự (§16)
const JOIN_CODE_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const JOIN_CODE_LENGTH = 8;
const JOIN_CODE_MAX_TRIES = 5;

export function generateJoinCode(): string {
  let code = '';
  for (let i = 0; i < JOIN_CODE_LENGTH; i++) {
    code += JOIN_CODE_ALPHABET[randomInt(JOIN_CODE_ALPHABET.length)];
  }
  return code;
}

// Lỗi trùng unique index của Mongo
function isDuplicateKey(err: unknown): boolean {
  return (err as { code?: number })?.code === 11000;
}

// Room đọc từ Mongo (document hoặc object lean)
type RoomLike = {
  _id: unknown;
  ownerId: unknown;
  name: string;
  description?: string;
  joinCode: string;
  status: RoomStatus;
  memberCount?: number;
  createdAt?: Date;
};

export type RoomResponse = ReturnType<typeof toRoomResponse>;

// Map document → response trả cho client: id thay cho _id (ràng buộc 2)
export function toRoomResponse(room: RoomLike, myRole: RoomRole) {
  return {
    id: String(room._id),
    name: room.name,
    description: room.description ?? '',
    joinCode: room.joinCode,
    ownerId: String(room.ownerId),
    status: room.status,
    memberCount: room.memberCount ?? 0,
    createdAt: room.createdAt,
    myRole,
  };
}

@Injectable()
export class RoomsService {
  constructor(
    @InjectModel(Room.name) private roomModel: Model<RoomDocument>,
    @InjectModel(RoomMember.name) private memberModel: Model<RoomMemberDocument>,
    private access: RoomAccessService,
    private redis: RedisService,
  ) {}

  // POST /rooms — người tạo thành HOST
  async createRoom(userId: string, dto: CreateRoomDto) {
    const room = await this.insertRoomWithUniqueCode(userId, dto);
    try {
      await this.memberModel.create({ roomId: room._id, userId, role: RoomRole.HOST });
    } catch (err) {
      // Không có transaction (Mongo standalone) → tự xoá room để không bỏ lại room không có HOST
      await this.roomModel.deleteOne({ _id: room._id }).exec();
      throw err;
    }
    return toRoomResponse(room, RoomRole.HOST);
  }

  // Sinh mã và insert; trùng mã (unique index) thì sinh lại, tối đa JOIN_CODE_MAX_TRIES lần
  private async insertRoomWithUniqueCode(userId: string, dto: CreateRoomDto) {
    for (let i = 0; i < JOIN_CODE_MAX_TRIES; i++) {
      try {
        return await this.roomModel.create({
          name: dto.name,
          description: dto.description ?? '',
          ownerId: userId,
          joinCode: generateJoinCode(),
          memberCount: 1,
        });
      } catch (err) {
        if (!isDuplicateKey(err)) throw err;
      }
    }
    throw new InternalServerErrorException('Không sinh được mã phòng, vui lòng thử lại');
  }
}
```

- [ ] **Step 5: Chạy test, xác nhận pass**

Run: `npm test -- src/modules/rooms/rooms.service.spec.ts`
Expected: PASS 5/5.

- [ ] **Step 6: Viết controller**

`backend/src/modules/rooms/rooms.controller.ts`:
```ts
import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RoomsService } from './rooms.service.js';
import { CreateRoomDto } from './dto/create-room.dto.js';

// Mọi route room đều cần đăng nhập (ADR-008).
// req.user là user đã xác thực (JwtStrategy.validate trả về document User → dùng req.user.id).
@UseGuards(JwtAuthGuard)
@Controller('rooms')
export class RoomsController {
  constructor(private roomsService: RoomsService) {}

  // POST /rooms  { name, description? }
  @Post()
  create(@Req() req: any, @Body() dto: CreateRoomDto) {
    return this.roomsService.createRoom(req.user.id, dto);
  }
}
```

- [ ] **Step 7: Đăng ký trong module**

`backend/src/modules/rooms/rooms.module.ts` thay toàn bộ bằng:
```ts
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Room, RoomSchema } from './schemas/room.schema.js';
import { File, FileSchema } from './schemas/file.schema.js';
import { RoomMember, RoomMemberSchema } from '../room-members/schemas/room-member.schema.js';
import { RoomMembersModule } from '../room-members/room-members.module.js';
import { RoomsController } from './rooms.controller.js';
import { RoomsService } from './rooms.service.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Room.name, schema: RoomSchema },
      { name: File.name, schema: FileSchema },
      { name: RoomMember.name, schema: RoomMemberSchema },
    ]),
    // Lấy RoomAccessService để kiểm quyền
    RoomMembersModule,
  ],
  controllers: [RoomsController],
  providers: [RoomsService],
})
export class RoomsModule {}
```

- [ ] **Step 8: Build**

Run: `npm run build`
Expected: không lỗi.

- [ ] **Step 9: Tài liệu `docs/api/endpoint.md`**

Thêm mục mới **trước** mục `## Chat`:
```markdown
## Rooms

Mọi endpoint cần header `Authorization: Bearer <accessToken>`. Lỗi validate → 400.

**Room response** (dùng chung cho các endpoint trả về một phòng):
`{ id, name, description, joinCode, ownerId, status, memberCount, createdAt, myRole }` — `myRole` là `HOST` hoặc `MEMBER` của người đang gọi.

### POST /rooms
Tạo phòng. Người tạo thành HOST.

| Body | Kiểu | Ràng buộc |
|---|---|---|
| name | string | bắt buộc, 1–100 ký tự (đã trim) |
| description | string | tuỳ chọn, ≤ 500 ký tự |

Response `201`: room response, `myRole: "HOST"`, `memberCount: 1`.
```

- [ ] **Step 10: Commit (khi user cho phép)**

```bash
git add backend/src/modules/rooms docs/api/endpoint.md docs/progress.md
git commit -m "feat: tạo phòng với join code ngẫu nhiên"
```

---

### Task 3: Tham gia phòng bằng mã — `POST /rooms/join`

**Files:**
- Create: `backend/src/modules/rooms/dto/join-room.dto.ts`
- Modify: `backend/src/modules/rooms/rooms.service.ts`
- Modify: `backend/src/modules/rooms/rooms.service.spec.ts`
- Modify: `backend/src/modules/rooms/rooms.controller.ts`
- Modify: `docs/api/endpoint.md`

**Interfaces:**
- Consumes: `toRoomResponse`, `isDuplicateKey`, helper test của Task 2.
- Produces:
  - `RoomsService.joinRoom(userId: string, code: string): Promise<RoomResponse>`
  - `private checkRateLimit(key: string, limit: number, message: string): Promise<void>` — Task 8 dùng lại.

- [ ] **Step 1: Viết DTO**

`backend/src/modules/rooms/dto/join-room.dto.ts`:
```ts
import { Transform } from 'class-transformer';
import { IsString, Matches } from 'class-validator';

export class JoinRoomDto {
  // Cho phép người dùng gõ chữ thường / thừa dấu cách
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @IsString()
  @Matches(/^[A-Z2-7]{8}$/, { message: 'Mã phòng gồm 8 ký tự (A–Z, 2–7)' })
  code!: string;
}
```

- [ ] **Step 2: Viết test (fail)**

Trong `rooms.service.spec.ts`, đổi dòng import `@nestjs/common` thành:
```ts
import { HttpException, InternalServerErrorException, NotFoundException } from '@nestjs/common';
```

Thêm vào cuối file:
```ts
describe('joinRoom', () => {
  it('mã sai hoặc phòng đã giải tán → 404 (query chỉ tìm room ACTIVE)', async () => {
    const { service, roomModel } = build();

    await expect(service.joinRoom(userId, 'ABCDEFGH')).rejects.toBeInstanceOf(NotFoundException);
    expect(roomModel.findOne).toHaveBeenCalledWith({
      joinCode: 'ABCDEFGH',
      status: RoomStatus.ACTIVE,
      deletedAt: null,
    });
  });

  it('thành viên mới → thêm MEMBER, tăng memberCount', async () => {
    const { service, roomModel, memberModel } = build();
    const room = fakeRoom();
    roomModel.findOne.mockReturnValue(query(room));

    const res = await service.joinRoom(userId, 'ABCDEFGH');

    expect(memberModel.create).toHaveBeenCalledWith({ roomId: room._id, userId, role: RoomRole.MEMBER });
    expect(roomModel.updateOne).toHaveBeenCalledWith({ _id: room._id }, { $inc: { memberCount: 1 } });
    expect(res).toMatchObject({ id: roomId, myRole: RoomRole.MEMBER, memberCount: 2 });
  });

  it('đã là thành viên → trả room với role hiện có, không tăng memberCount', async () => {
    const { service, roomModel, memberModel } = build();
    roomModel.findOne.mockReturnValue(query(fakeRoom()));
    memberModel.create.mockRejectedValue(duplicateKeyError());
    memberModel.findOne.mockReturnValue(query({ role: RoomRole.HOST }));

    const res = await service.joinRoom(userId, 'ABCDEFGH');

    expect(res.myRole).toBe(RoomRole.HOST);
    expect(roomModel.updateOne).not.toHaveBeenCalled();
  });

  it('lần thử đầu trong cửa sổ → đặt hạn 60s cho key rate limit', async () => {
    const { service, roomModel, redis } = build();
    roomModel.findOne.mockReturnValue(query(fakeRoom()));

    await service.joinRoom(userId, 'ABCDEFGH');

    expect(redis.incr).toHaveBeenCalledWith(`ratelimit:join:${userId}`);
    expect(redis.expire).toHaveBeenCalledWith(`ratelimit:join:${userId}`, 60);
  });

  it('quá 10 lần/phút → 429, không query room', async () => {
    const { service, roomModel, redis } = build();
    redis.incr.mockResolvedValue(11);

    const err = await service.joinRoom(userId, 'ABCDEFGH').catch((e) => e);

    expect(err).toBeInstanceOf(HttpException);
    expect(err.getStatus()).toBe(429);
    expect(roomModel.findOne).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Chạy test, xác nhận fail**

Run: `npm test -- src/modules/rooms/rooms.service.spec.ts`
Expected: FAIL 5 test `joinRoom` — `service.joinRoom is not a function`.

- [ ] **Step 4: Viết `joinRoom` + `checkRateLimit`**

Trong `rooms.service.ts`, đổi dòng import `@nestjs/common` thành:
```ts
import {
  HttpException,
  HttpStatus,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
```

Thêm hằng số dưới `JOIN_CODE_MAX_TRIES`:
```ts
// Chống dò mã: mỗi user tối đa 10 lần nhập mã / 60 giây, đếm trong Redis (§16)
const JOIN_RATE_LIMIT = 10;
const RATE_WINDOW_SECONDS = 60;
```

Thêm vào class `RoomsService` (sau `createRoom`):
```ts
  // POST /rooms/join — idempotent: đã là thành viên thì trả phòng luôn
  async joinRoom(userId: string, code: string) {
    await this.checkRateLimit(
      `ratelimit:join:${userId}`,
      JOIN_RATE_LIMIT,
      'Bạn nhập mã quá nhiều lần, vui lòng đợi 1 phút',
    );

    // Sai mã và phòng đã giải tán trả cùng một lỗi → không lộ phòng nào từng tồn tại
    const room = await this.roomModel
      .findOne({ joinCode: code, status: RoomStatus.ACTIVE, deletedAt: null })
      .lean()
      .exec();
    if (!room) {
      throw new NotFoundException('Mã phòng không đúng hoặc phòng không còn hoạt động');
    }

    try {
      await this.memberModel.create({ roomId: room._id, userId, role: RoomRole.MEMBER });
    } catch (err) {
      if (!isDuplicateKey(err)) throw err;
      // Unique {roomId, userId} báo trùng → đã là thành viên, không tăng memberCount
      const member = await this.memberModel.findOne({ roomId: room._id, userId }).lean().exec();
      return toRoomResponse(room, member?.role ?? RoomRole.MEMBER);
    }

    await this.roomModel.updateOne({ _id: room._id }, { $inc: { memberCount: 1 } }).exec();
    return toRoomResponse({ ...room, memberCount: (room.memberCount ?? 0) + 1 }, RoomRole.MEMBER);
  }

  // Đếm số lần gọi trong cửa sổ 60s bằng Redis — đúng cả khi request rơi vào instance khác
  private async checkRateLimit(key: string, limit: number, message: string) {
    const count = await this.redis.incr(key);
    if (count === 1) {
      await this.redis.expire(key, RATE_WINDOW_SECONDS);
    }
    if (count > limit) {
      throw new HttpException(message, HttpStatus.TOO_MANY_REQUESTS);
    }
  }
```

- [ ] **Step 5: Chạy test, xác nhận pass**

Run: `npm test -- src/modules/rooms/rooms.service.spec.ts`
Expected: PASS 10/10.

- [ ] **Step 6: Thêm route**

Trong `rooms.controller.ts`, đổi import:
```ts
import { Body, Controller, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
import { JoinRoomDto } from './dto/join-room.dto.js';
```
Thêm method sau `create`:
```ts
  // POST /rooms/join  { code } — link /join/:code ở frontend gọi cùng API này
  @Post('join')
  @HttpCode(200)
  join(@Req() req: any, @Body() dto: JoinRoomDto) {
    return this.roomsService.joinRoom(req.user.id, dto.code);
  }
```

- [ ] **Step 7: Build**

Run: `npm run build` — Expected: không lỗi.

- [ ] **Step 8: Tài liệu — thêm vào mục `## Rooms` của `docs/api/endpoint.md`**

```markdown
### POST /rooms/join
Tham gia phòng bằng mã (link `/join/:code` ở frontend gọi cùng API).

| Body | Kiểu | Ràng buộc |
|---|---|---|
| code | string | 8 ký tự A–Z, 2–7 (không phân biệt hoa thường) |

- Response `200`: room response. Đã là thành viên thì trả luôn, không tính thêm.
- `404`: sai mã **hoặc** phòng đã giải tán (cùng thông báo).
- `429`: quá 10 lần/phút mỗi user (Redis `ratelimit:join:{userId}`).
```

- [ ] **Step 9: Commit (khi user cho phép)**

```bash
git add backend/src/modules/rooms docs/api/endpoint.md docs/progress.md
git commit -m "feat: tham gia phòng bằng mã, rate limit trong Redis"
```

---

### Task 4: Xem + sửa phòng — `GET /rooms`, `GET /rooms/:roomId`, `PATCH /rooms/:roomId`, `GET /rooms/:roomId/members`

**Files:**
- Create: `backend/src/modules/rooms/dto/list-rooms-query.dto.ts`
- Create: `backend/src/modules/rooms/dto/update-room.dto.ts`
- Modify: `backend/src/modules/rooms/rooms.service.ts`
- Modify: `backend/src/modules/rooms/rooms.service.spec.ts`
- Modify: `backend/src/modules/rooms/rooms.controller.ts`
- Modify: `docs/api/endpoint.md`

**Interfaces:**
- Consumes: `access.assertRoomAccess`, `access.assertRoomPermission`, `RoomAction.UPDATE_ROOM` (Task 1).
- Produces:
  - `listMyRooms(userId: string, page: number, limit: number): Promise<{ items: RoomResponse[]; page: number; limit: number; hasMore: boolean }>`
  - `getRoom(userId: string, roomId: string): Promise<RoomResponse>`
  - `updateRoom(userId: string, roomId: string, dto: UpdateRoomDto): Promise<RoomResponse>`
  - `listMembers(userId: string, roomId: string): Promise<{ userId: string; displayName: string; avatarUrl: string | null; role: RoomRole; joinedAt: Date }[]>`
  - `private findMembersWithUser(roomId: string, userFields: string): Promise<PopulatedMember[]>` — Task 8 dùng lại.
  - `type PopulatedMember = { userId: { _id: unknown; email?: string; displayName?: string; avatarUrl?: string | null } | null; role: RoomRole; joinedAt: Date }`

- [ ] **Step 1: Viết DTO**

`backend/src/modules/rooms/dto/list-rooms-query.dto.ts`:
```ts
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class ListRoomsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit: number = 20;
}
```

`backend/src/modules/rooms/dto/update-room.dto.ts`:
```ts
import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

// Gửi field nào sửa field đó; phải có ít nhất 1 field (kiểm trong service)
export class UpdateRoomDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(1, { message: 'Tên phòng không được để trống' })
  @MaxLength(100, { message: 'Tên phòng tối đa 100 ký tự' })
  name?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(500, { message: 'Mô tả tối đa 500 ký tự' })
  description?: string;
}
```

- [ ] **Step 2: Viết test (fail)**

Trong `rooms.service.spec.ts`, đổi dòng import `@nestjs/common` thành:
```ts
import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
```

Thêm vào cuối file:
```ts
describe('listMyRooms', () => {
  it('lọc theo userId dạng ObjectId, lấy dư 1 bản ghi để biết còn trang sau', async () => {
    const { service, memberModel } = build();
    const rows = [1, 2, 3].map(() => ({
      role: RoomRole.MEMBER,
      room: fakeRoom({ _id: new Types.ObjectId() }),
    }));
    memberModel.aggregate.mockReturnValue(query(rows));

    const res = await service.listMyRooms(userId, 2, 2);

    const pipeline = memberModel.aggregate.mock.calls[0][0];
    expect(pipeline[0]).toEqual({ $match: { userId: new Types.ObjectId(userId) } });
    expect(pipeline).toContainEqual({ $match: { 'room.status': RoomStatus.ACTIVE, 'room.deletedAt': null } });
    expect(pipeline).toContainEqual({ $skip: 2 });
    expect(pipeline).toContainEqual({ $limit: 3 });
    expect(res).toMatchObject({ page: 2, limit: 2, hasMore: true });
    expect(res.items).toHaveLength(2);
    expect(res.items[0].myRole).toBe(RoomRole.MEMBER);
  });

  it('trang cuối → hasMore false', async () => {
    const { service, memberModel } = build();
    memberModel.aggregate.mockReturnValue(query([{ role: RoomRole.HOST, room: fakeRoom() }]));

    const res = await service.listMyRooms(userId, 1, 20);

    expect(res.hasMore).toBe(false);
    expect(res.items[0]).toMatchObject({ id: roomId, myRole: RoomRole.HOST });
  });
});

describe('getRoom', () => {
  it('trả room kèm role của người gọi', async () => {
    const { service, roomModel, access } = build();
    roomModel.findById.mockReturnValue(query(fakeRoom()));

    const res = await service.getRoom(userId, roomId);

    expect(access.assertRoomAccess).toHaveBeenCalledWith(userId, roomId);
    expect(res).toMatchObject({ id: roomId, myRole: RoomRole.MEMBER, joinCode: 'ABCDEFGH' });
  });
});

describe('updateRoom', () => {
  it('không có quyền → 403, không ghi DB', async () => {
    const { service, roomModel, access } = build();
    access.assertRoomPermission.mockRejectedValue(new ForbiddenException());

    await expect(service.updateRoom(userId, roomId, { name: 'Mới' })).rejects.toBeInstanceOf(ForbiddenException);
    expect(roomModel.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('body không có field nào → 400', async () => {
    const { service } = build();
    await expect(service.updateRoom(userId, roomId, {})).rejects.toBeInstanceOf(BadRequestException);
  });

  it('chỉ $set field được gửi, trả room đã sửa', async () => {
    const { service, roomModel } = build();
    roomModel.findOneAndUpdate.mockReturnValue(query(fakeRoom({ name: 'Mới' })));

    const res = await service.updateRoom(userId, roomId, { name: 'Mới', description: undefined });

    expect(roomModel.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: roomId, status: RoomStatus.ACTIVE },
      { $set: { name: 'Mới' } },
      { returnDocument: 'after' },
    );
    expect(res).toMatchObject({ name: 'Mới', myRole: RoomRole.HOST });
  });
});

describe('listMembers', () => {
  it('HOST đứng đầu, map userId/displayName, bỏ bản ghi có user đã bị xoá', async () => {
    const { service, memberModel } = build();
    const joinedAt = new Date('2026-09-26T00:00:00Z');
    const hostUser = { _id: new Types.ObjectId(userId), displayName: 'Chủ phòng', avatarUrl: null };
    const find = query([
      { userId: hostUser, role: RoomRole.HOST, joinedAt },
      { userId: null, role: RoomRole.MEMBER, joinedAt },
    ]);
    memberModel.find.mockReturnValue(find);

    const res = await service.listMembers(userId, roomId);

    expect(memberModel.find).toHaveBeenCalledWith({ roomId });
    expect(find.sort).toHaveBeenCalledWith({ role: 1, joinedAt: 1 });
    expect(find.populate).toHaveBeenCalledWith('userId', 'displayName avatarUrl');
    expect(res).toEqual([
      { userId, displayName: 'Chủ phòng', avatarUrl: null, role: RoomRole.HOST, joinedAt },
    ]);
  });
});
```

- [ ] **Step 3: Chạy test, xác nhận fail**

Run: `npm test -- src/modules/rooms/rooms.service.spec.ts`
Expected: FAIL 7 test mới — `service.listMyRooms is not a function` v.v.

- [ ] **Step 4: Viết code service**

Trong `rooms.service.ts`:

Đổi import `@nestjs/common` thành:
```ts
import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
```
Đổi import mongoose thành:
```ts
import { Model, Types } from 'mongoose';
```
Thêm import:
```ts
import { RoomAction } from '../../shared/permissions.js';
import { UpdateRoomDto } from './dto/update-room.dto.js';
```

Thêm type dưới `RoomResponse`:
```ts
// room_members sau khi populate('userId', ...) — userId = null nếu user đã bị xoá
type PopulatedMember = {
  userId: { _id: unknown; email?: string; displayName?: string; avatarUrl?: string | null } | null;
  role: RoomRole;
  joinedAt: Date;
};
```

Thêm các method vào class (sau `joinRoom`, trước `checkRateLimit`):
```ts
  // GET /rooms — phòng của tôi (chỉ phòng ACTIVE), mới tham gia trước
  async listMyRooms(userId: string, page: number, limit: number) {
    const rows = await this.memberModel
      .aggregate([
        // aggregate không tự ép kiểu như find → phải đổi sang ObjectId
        { $match: { userId: new Types.ObjectId(userId) } },
        { $sort: { joinedAt: -1 } },
        { $lookup: { from: 'rooms', localField: 'roomId', foreignField: '_id', as: 'room' } },
        { $unwind: '$room' },
        { $match: { 'room.status': RoomStatus.ACTIVE, 'room.deletedAt': null } },
        { $skip: (page - 1) * limit },
        // Lấy dư 1 bản ghi để biết còn trang sau, khỏi phải đếm tổng
        { $limit: limit + 1 },
      ])
      .exec();

    return {
      items: rows.slice(0, limit).map((row) => toRoomResponse(row.room, row.role)),
      page,
      limit,
      hasMore: rows.length > limit,
    };
  }

  // GET /rooms/:roomId — chỉ thành viên
  async getRoom(userId: string, roomId: string) {
    const member = await this.access.assertRoomAccess(userId, roomId);
    const room = await this.roomModel.findById(roomId).lean().exec();
    if (!room) {
      throw new NotFoundException('Room không tồn tại');
    }
    return toRoomResponse(room, member.role);
  }

  // PATCH /rooms/:roomId — chỉ HOST
  async updateRoom(userId: string, roomId: string, dto: UpdateRoomDto) {
    const member = await this.access.assertRoomPermission(userId, roomId, RoomAction.UPDATE_ROOM);

    // Chỉ $set field thật sự được gửi (tránh ghi đè bằng undefined)
    const update: { name?: string; description?: string } = {};
    if (dto.name !== undefined) update.name = dto.name;
    if (dto.description !== undefined) update.description = dto.description;
    if (Object.keys(update).length === 0) {
      throw new BadRequestException('Cần gửi ít nhất một trường để sửa');
    }

    const room = await this.roomModel
      .findOneAndUpdate({ _id: roomId, status: RoomStatus.ACTIVE }, { $set: update }, { returnDocument: 'after' })
      .lean()
      .exec();
    if (!room) {
      throw new NotFoundException('Room không tồn tại');
    }
    return toRoomResponse(room, member.role);
  }

  // GET /rooms/:roomId/members — chỉ thành viên, không phân trang (phòng học nhóm nhỏ)
  async listMembers(userId: string, roomId: string) {
    await this.access.assertRoomAccess(userId, roomId);
    const members = await this.findMembersWithUser(roomId, 'displayName avatarUrl');
    return members
      .filter((m) => m.userId !== null)
      .map((m) => ({
        userId: String(m.userId!._id),
        displayName: m.userId!.displayName ?? '',
        avatarUrl: m.userId!.avatarUrl ?? null,
        role: m.role,
        joinedAt: m.joinedAt,
      }));
  }

  // Thành viên kèm thông tin user. Sort role tăng dần → 'HOST' < 'MEMBER' nên HOST đứng đầu
  private async findMembersWithUser(roomId: string, userFields: string) {
    const members = await this.memberModel
      .find({ roomId })
      .sort({ role: 1, joinedAt: 1 })
      .populate('userId', userFields)
      .lean()
      .exec();
    return members as unknown as PopulatedMember[];
  }
```

- [ ] **Step 5: Chạy test, xác nhận pass**

Run: `npm test -- src/modules/rooms/rooms.service.spec.ts`
Expected: PASS 17/17.

- [ ] **Step 6: Thêm route**

Trong `rooms.controller.ts`, đổi import thành:
```ts
import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RoomsService } from './rooms.service.js';
import { CreateRoomDto } from './dto/create-room.dto.js';
import { JoinRoomDto } from './dto/join-room.dto.js';
import { ListRoomsQueryDto } from './dto/list-rooms-query.dto.js';
import { UpdateRoomDto } from './dto/update-room.dto.js';
```
Thêm method sau `join`:
```ts
  // GET /rooms?page=1&limit=20 — phòng của tôi
  @Get()
  list(@Req() req: any, @Query() query: ListRoomsQueryDto) {
    return this.roomsService.listMyRooms(req.user.id, query.page, query.limit);
  }

  // GET /rooms/:roomId
  @Get(':roomId')
  get(@Req() req: any, @Param('roomId') roomId: string) {
    return this.roomsService.getRoom(req.user.id, roomId);
  }

  // PATCH /rooms/:roomId  { name?, description? } — chỉ HOST
  @Patch(':roomId')
  update(@Req() req: any, @Param('roomId') roomId: string, @Body() dto: UpdateRoomDto) {
    return this.roomsService.updateRoom(req.user.id, roomId, dto);
  }

  // GET /rooms/:roomId/members
  @Get(':roomId/members')
  members(@Req() req: any, @Param('roomId') roomId: string) {
    return this.roomsService.listMembers(req.user.id, roomId);
  }
```

- [ ] **Step 7: Build**

Run: `npm run build` — Expected: không lỗi.

- [ ] **Step 8: Tài liệu — thêm vào mục `## Rooms`**

```markdown
### GET /rooms
Phòng của tôi (chỉ phòng đang hoạt động), mới tham gia trước.

| Query | Kiểu | Mặc định | Ghi chú |
|---|---|---|---|
| page | number | 1 | ≥ 1 |
| limit | number | 20 | 1–50 |

Response `200`: `{ items: RoomResponse[], page, limit, hasMore }`.

### GET /rooms/:roomId
Chi tiết phòng. Quyền: thành viên. Mọi thành viên đều thấy `joinCode` để chia sẻ.
Response `200`: room response. `404` phòng không tồn tại / đã giải tán; `403` không phải thành viên.

### PATCH /rooms/:roomId
Sửa phòng. Quyền: HOST.

| Body | Kiểu | Ràng buộc |
|---|---|---|
| name | string | tuỳ chọn, 1–100 ký tự |
| description | string | tuỳ chọn, ≤ 500 ký tự |

Phải có ít nhất 1 field (không thì `400`). Response `200`: room response.

### GET /rooms/:roomId/members
Danh sách thành viên, HOST đứng đầu rồi theo thời gian vào phòng. Quyền: thành viên.
Response `200`: `[{ userId, displayName, avatarUrl, role, joinedAt }]`.
```

- [ ] **Step 9: Commit (khi user cho phép)**

```bash
git add backend/src/modules/rooms docs/api/endpoint.md docs/progress.md
git commit -m "feat: xem danh sách, chi tiết, thành viên và sửa phòng"
```

---

### Task 5: Kick thành viên — `DELETE /rooms/:roomId/members/:userId`

**Files:**
- Modify: `backend/src/modules/rooms/rooms.service.ts`
- Modify: `backend/src/modules/rooms/rooms.service.spec.ts`
- Modify: `backend/src/modules/rooms/rooms.controller.ts`
- Modify: `docs/api/endpoint.md`

**Interfaces:**
- Consumes: `access.assertRoomPermission`, `RoomAction.KICK_MEMBER`.
- Produces:
  - `kickMember(hostId: string, roomId: string, targetUserId: string): Promise<void>`
  - `private removeMember(roomId: string, userId: string): Promise<boolean>` — `true` nếu thật sự xoá được 1 bản ghi (đã giảm `memberCount`). Task 6 dùng lại.

- [ ] **Step 1: Viết test (fail)**

Thêm vào cuối `rooms.service.spec.ts`:
```ts
describe('kickMember', () => {
  const targetId = new Types.ObjectId().toString();

  it('userId sai định dạng → 400, không kiểm quyền', async () => {
    const { service, access } = build();
    await expect(service.kickMember(userId, roomId, 'abc')).rejects.toBeInstanceOf(BadRequestException);
    expect(access.assertRoomPermission).not.toHaveBeenCalled();
  });

  it('MEMBER gọi → 403, không xoá', async () => {
    const { service, access, memberModel } = build();
    access.assertRoomPermission.mockRejectedValue(new ForbiddenException());

    await expect(service.kickMember(userId, roomId, targetId)).rejects.toBeInstanceOf(ForbiddenException);
    expect(memberModel.deleteOne).not.toHaveBeenCalled();
  });

  it('tự kick chính mình (HOST) → 400', async () => {
    const { service, memberModel } = build();
    await expect(service.kickMember(userId, roomId, userId)).rejects.toBeInstanceOf(BadRequestException);
    expect(memberModel.deleteOne).not.toHaveBeenCalled();
  });

  it('người không có trong phòng → 404, không giảm memberCount', async () => {
    const { service, memberModel, roomModel } = build();
    memberModel.deleteOne.mockReturnValue(query({ deletedCount: 0 }));

    await expect(service.kickMember(userId, roomId, targetId)).rejects.toBeInstanceOf(NotFoundException);
    expect(roomModel.updateOne).not.toHaveBeenCalled();
  });

  it('kick thành công → xoá bản ghi, giảm memberCount 1', async () => {
    const { service, memberModel, roomModel, access } = build();

    await service.kickMember(userId, roomId, targetId);

    expect(access.assertRoomPermission).toHaveBeenCalledWith(userId, roomId, 'KICK_MEMBER');
    expect(memberModel.deleteOne).toHaveBeenCalledWith({ roomId, userId: targetId });
    expect(roomModel.updateOne).toHaveBeenCalledWith({ _id: roomId }, { $inc: { memberCount: -1 } });
  });
});
```

- [ ] **Step 2: Chạy test, xác nhận fail**

Run: `npm test -- src/modules/rooms/rooms.service.spec.ts`
Expected: FAIL 5 test — `service.kickMember is not a function`.

- [ ] **Step 3: Viết code**

Thêm vào class `RoomsService` (sau `listMembers`):
```ts
  // DELETE /rooms/:roomId/members/:userId — chỉ HOST. Kick = xoá bản ghi, không ban (ADR-020)
  async kickMember(hostId: string, roomId: string, targetUserId: string) {
    if (!Types.ObjectId.isValid(targetUserId)) {
      throw new BadRequestException('userId không hợp lệ');
    }
    await this.access.assertRoomPermission(hostId, roomId, RoomAction.KICK_MEMBER);

    // Phòng chỉ có 1 HOST là chính mình → chặn tự kick cũng là chặn kick HOST
    if (targetUserId === hostId) {
      throw new BadRequestException('Không thể tự mời mình ra khỏi phòng');
    }

    const removed = await this.removeMember(roomId, targetUserId);
    if (!removed) {
      throw new NotFoundException('Người này không có trong phòng');
    }
    // TODO(chat gateway): thu hồi socket của người bị kick khỏi kênh room:{roomId}
  }

  // Xoá thành viên; chỉ giảm memberCount khi thật sự xoá được → 2 request cùng lúc không trừ 2 lần
  private async removeMember(roomId: string, userId: string) {
    const result = await this.memberModel.deleteOne({ roomId, userId }).exec();
    if (result.deletedCount !== 1) {
      return false;
    }
    await this.roomModel.updateOne({ _id: roomId }, { $inc: { memberCount: -1 } }).exec();
    return true;
  }
```

> Ghi chú: `TODO(chat gateway)` là chỗ nối cho task chat gateway sau, được ghi trong spec §5 — giữ nguyên, không làm trong plan này.

- [ ] **Step 4: Chạy test, xác nhận pass**

Run: `npm test -- src/modules/rooms/rooms.service.spec.ts`
Expected: PASS 22/22.

- [ ] **Step 5: Thêm route**

Trong `rooms.controller.ts`, thêm `Delete` vào import `@nestjs/common`. Thêm method sau `members`:
```ts
  // DELETE /rooms/:roomId/members/:userId — HOST kick thành viên
  @Delete(':roomId/members/:userId')
  @HttpCode(204)
  kick(@Req() req: any, @Param('roomId') roomId: string, @Param('userId') userId: string) {
    return this.roomsService.kickMember(req.user.id, roomId, userId);
  }
```

- [ ] **Step 6: Build**

Run: `npm run build` — Expected: không lỗi.

- [ ] **Step 7: Tài liệu — thêm vào mục `## Rooms`**

```markdown
### DELETE /rooms/:roomId/members/:userId
Kick thành viên (xoá khỏi phòng, người đó nhập lại mã vẫn vào được — ADR-020). Quyền: HOST.
- Response `204`.
- `400`: `userId` sai định dạng, hoặc tự kick chính mình.
- `403`: không phải HOST. `404`: người đó không có trong phòng.
```

- [ ] **Step 8: Commit (khi user cho phép)**

```bash
git add backend/src/modules/rooms docs/api/endpoint.md docs/progress.md
git commit -m "feat: HOST kick thành viên khỏi phòng"
```

---

### Task 6: Rời phòng — `DELETE /rooms/:roomId/members/me`

**Files:**
- Modify: `backend/src/modules/rooms/rooms.service.ts`
- Modify: `backend/src/modules/rooms/rooms.service.spec.ts`
- Modify: `backend/src/modules/rooms/rooms.controller.ts`
- Modify: `docs/api/endpoint.md`

**Interfaces:**
- Consumes: `access.assertRoomAccess`, `removeMember` (Task 5).
- Produces: `leaveRoom(userId: string, roomId: string): Promise<void>`

- [ ] **Step 1: Viết test (fail)**

Thêm vào cuối `rooms.service.spec.ts`:
```ts
describe('leaveRoom', () => {
  it('HOST → 400, không xoá', async () => {
    const { service, access, memberModel } = build();
    access.assertRoomAccess.mockResolvedValue({ role: RoomRole.HOST });

    await expect(service.leaveRoom(userId, roomId)).rejects.toBeInstanceOf(BadRequestException);
    expect(memberModel.deleteOne).not.toHaveBeenCalled();
  });

  it('MEMBER → xoá bản ghi của mình, giảm memberCount 1', async () => {
    const { service, memberModel, roomModel } = build();

    await service.leaveRoom(userId, roomId);

    expect(memberModel.deleteOne).toHaveBeenCalledWith({ roomId, userId });
    expect(roomModel.updateOne).toHaveBeenCalledWith({ _id: roomId }, { $inc: { memberCount: -1 } });
  });
});
```

- [ ] **Step 2: Chạy test, xác nhận fail**

Run: `npm test -- src/modules/rooms/rooms.service.spec.ts`
Expected: FAIL 2 test — `service.leaveRoom is not a function`.

- [ ] **Step 3: Viết code**

Thêm vào class `RoomsService` (sau `kickMember`):
```ts
  // DELETE /rooms/:roomId/members/me — MEMBER tự rời. HOST không rời được, chỉ giải tán (ADR-020)
  async leaveRoom(userId: string, roomId: string) {
    const member = await this.access.assertRoomAccess(userId, roomId);
    if (member.role === RoomRole.HOST) {
      throw new BadRequestException('Host không thể rời phòng, hãy giải tán phòng');
    }
    await this.removeMember(roomId, userId);
    // TODO(chat gateway): thu hồi socket của người vừa rời khỏi kênh room:{roomId}
  }
```

- [ ] **Step 4: Chạy test, xác nhận pass**

Run: `npm test -- src/modules/rooms/rooms.service.spec.ts`
Expected: PASS 24/24.

- [ ] **Step 5: Thêm route — đặt TRƯỚC route kick**

Trong `rooms.controller.ts`, chèn method này **ngay trước** method `kick` (Express khớp route theo thứ tự khai báo, `members/me` phải đứng trước `members/:userId`):
```ts
  // DELETE /rooms/:roomId/members/me — tự rời phòng. Phải khai báo trước members/:userId
  @Delete(':roomId/members/me')
  @HttpCode(204)
  leave(@Req() req: any, @Param('roomId') roomId: string) {
    return this.roomsService.leaveRoom(req.user.id, roomId);
  }
```

- [ ] **Step 6: Build**

Run: `npm run build` — Expected: không lỗi.

- [ ] **Step 7: Tài liệu — thêm vào mục `## Rooms` (trước mục kick)**

```markdown
### DELETE /rooms/:roomId/members/me
Tự rời phòng. Quyền: thành viên không phải HOST.
- Response `204`.
- `400`: HOST gọi — HOST không rời được, chỉ giải tán (ADR-020).
```

- [ ] **Step 8: Commit (khi user cho phép)**

```bash
git add backend/src/modules/rooms docs/api/endpoint.md docs/progress.md
git commit -m "feat: thành viên tự rời phòng"
```

---

### Task 7: Giải tán phòng — `POST /rooms/:roomId/dissolve`

**Files:**
- Modify: `backend/src/modules/rooms/rooms.service.ts`
- Modify: `backend/src/modules/rooms/rooms.service.spec.ts`
- Modify: `backend/src/modules/rooms/rooms.controller.ts`
- Modify: `docs/api/endpoint.md`

**Interfaces:**
- Consumes: `access.assertRoomPermission`, `RoomAction.DISSOLVE_ROOM`.
- Produces: `dissolveRoom(hostId: string, roomId: string): Promise<void>`

- [ ] **Step 1: Viết test (fail)**

Thêm vào cuối `rooms.service.spec.ts`:
```ts
describe('dissolveRoom', () => {
  it('không phải HOST → 403, không ghi DB', async () => {
    const { service, access, roomModel } = build();
    access.assertRoomPermission.mockRejectedValue(new ForbiddenException());

    await expect(service.dissolveRoom(userId, roomId)).rejects.toBeInstanceOf(ForbiddenException);
    expect(roomModel.updateOne).not.toHaveBeenCalled();
  });

  it('HOST → status DISSOLVED + dissolvedAt, giữ nguyên room_members', async () => {
    const { service, access, roomModel, memberModel } = build();

    await service.dissolveRoom(userId, roomId);

    expect(access.assertRoomPermission).toHaveBeenCalledWith(userId, roomId, 'DISSOLVE_ROOM');
    expect(roomModel.updateOne).toHaveBeenCalledWith(
      { _id: roomId, status: RoomStatus.ACTIVE },
      { $set: { status: RoomStatus.DISSOLVED, dissolvedAt: expect.any(Date) } },
    );
    expect(memberModel.deleteOne).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Chạy test, xác nhận fail**

Run: `npm test -- src/modules/rooms/rooms.service.spec.ts`
Expected: FAIL 2 test — `service.dissolveRoom is not a function`.

- [ ] **Step 3: Viết code**

Thêm vào class `RoomsService` (sau `leaveRoom`):
```ts
  // POST /rooms/:roomId/dissolve — chỉ HOST. Giữ room_members làm lịch sử.
  // Sau đó assertRoomAccess trả 404 cho mọi truy cập, join bằng mã cũng 404.
  async dissolveRoom(hostId: string, roomId: string) {
    await this.access.assertRoomPermission(hostId, roomId, RoomAction.DISSOLVE_ROOM);
    await this.roomModel
      .updateOne(
        { _id: roomId, status: RoomStatus.ACTIVE },
        { $set: { status: RoomStatus.DISSOLVED, dissolvedAt: new Date() } },
      )
      .exec();
    // TODO(module meeting): kết thúc meeting ACTIVE của room với EndReason.ROOM_DISSOLVED
  }
```

- [ ] **Step 4: Chạy test, xác nhận pass**

Run: `npm test -- src/modules/rooms/rooms.service.spec.ts`
Expected: PASS 26/26.

- [ ] **Step 5: Thêm route**

Trong `rooms.controller.ts`, thêm method cuối class:
```ts
  // POST /rooms/:roomId/dissolve — HOST giải tán phòng
  @Post(':roomId/dissolve')
  @HttpCode(204)
  dissolve(@Req() req: any, @Param('roomId') roomId: string) {
    return this.roomsService.dissolveRoom(req.user.id, roomId);
  }
```

- [ ] **Step 6: Chạy toàn bộ test + build**

Run: `npm test` — Expected: PASS toàn bộ (permissions 2, room-access 12, rooms 26).
Run: `npm run build` — Expected: không lỗi.

- [ ] **Step 7: Tài liệu — thêm vào mục `## Rooms`**

```markdown
### POST /rooms/:roomId/dissolve
Giải tán phòng: `status = DISSOLVED`, `dissolvedAt = now`. Quyền: HOST.
- Response `204`.
- Sau khi giải tán: mọi endpoint theo `roomId` trả `404`, join bằng mã trả `404`. `room_members` được giữ làm lịch sử.
- Chưa làm: kết thúc meeting đang diễn ra (chờ module meeting).
```

- [ ] **Step 8: Commit (khi user cho phép)**

```bash
git add backend/src/modules/rooms docs/api/endpoint.md docs/progress.md
git commit -m "feat: HOST giải tán phòng"
```

---

### Task 9a: `chore` — thống nhất npm, backend thành dự án npm độc lập (ADR-021) `[phát sinh kỹ thuật]`

> **User chốt 2026-09-27 (ADR-021):** cả project chỉ dùng npm; bỏ npm workspace ở gốc → backend chỉ còn một lockfile `backend/package-lock.json` dùng chung cho máy dev và Docker. File pnpm (`backend/pnpm-lock.yaml`, `frontend/pnpm-lock.yaml`, `frontend/pnpm-workspace.yaml`) **giữ nguyên, không dùng**. `.npmrc` ở gốc **để nguyên** (hiện không có tác dụng). Việc chung toàn project, đặt ở đây vì Task 9b (cài shadcn) cần npm. **Phiên riêng, commit riêng.** Không sửa `src/`, `Dockerfile`, `docker-compose.yml`.
>
> **Hiện trạng (rà soát + chạy thử 2026-09-27):**
> - Gốc repo là npm workspace chứa `backend`. Gốc có `node_modules` do npm tạo; `backend/node_modules` do **pnpm** tạo (symlink); `frontend/node_modules` do npm tạo, còn sót `.pnpm/`.
> - `package-lock.json` gốc thiếu `class-transformer`; `backend/package-lock.json` (Docker dùng) thiếu 6 package (`@nestjs/platform-socket.io`, `class-transformer`, `class-validator`, `@types/validator`, `libphonenumber-js`, `validator`) → `npm ci` fail ở cả hai. Nguyên nhân: `class-transformer` thêm bằng pnpm (commit `a0ce5e8`), và trong workspace `npm install` chỉ cập nhật lockfile gốc.
> - Cài kiểu Dockerfile từ lockfile cũ ra `@nestjs/platform-socket.io` **12.1.0**, máy dev đang 12.0.3.
> - `frontend/package-lock.json` khớp (`npm ci` qua).

**Files:**
- Modify: `package.json` (gốc) — bỏ `workspaces` + 5 script (`install:all`, `build`, `start`, `start:dev`, `test` — đều dựa vào workspace, không còn chạy được), thêm `packageManager`
- Delete: `package-lock.json` (gốc)
- Modify: `backend/package.json` (thêm `packageManager`), `backend/package-lock.json` (sinh lại cho khớp)
- Modify: `frontend/package.json` (thêm `packageManager`)

**Interfaces:**
- Produces: `"packageManager": "npm@<bản npm>"` trong 3 `package.json` → CLI shadcn (Task 9b, Task 8) chọn npm dù còn file pnpm. Đã đọc mã nguồn shadcn 4.21.0: thấy lockfile thì nó vẫn đọc `package.json`, có `packageManager` thì dùng field này thay vì đoán theo lockfile.
- Lệnh cài backend từ nay: `Set-Location backend; npm install --legacy-peer-deps` (cùng cờ với Dockerfile, vì `.npmrc` không có tác dụng).

- [ ] **Step 1: Kiểm trước**

`git status` sạch. Không chạy `npm run start:dev` native hay container backend đang mount `node_modules` (Windows khoá file khi xoá). Ghi bản npm: `npm --version` (lúc rà soát: `10.9.2`).

- [ ] **Step 2: Gốc repo — bỏ workspace**

`package.json` (gốc) thành:
```json
{
  "name": "datn2627",
  "version": "1.0.0",
  "description": "",
  "private": true,
  "packageManager": "npm@10.9.2"
}
```
Xoá lockfile gốc: `git rm package-lock.json`.

- [ ] **Step 3: Khai báo npm ở backend + frontend**

Thêm `"packageManager": "npm@10.9.2"` (đúng bản ở Step 1) ngay sau dòng `"private": true,` trong `backend/package.json` và `frontend/package.json`.

- [ ] **Step 4: Xoá `node_modules` cũ (chỉ ở máy, đã gitignore)**

Run (PowerShell, ở gốc repo):
```powershell
cmd /c "rmdir /s /q node_modules"
cmd /c "rmdir /s /q backend\node_modules"
cmd /c "rmdir /s /q frontend\node_modules"
```
(`rmdir` xoá cả symlink/junction của pnpm mà không đụng vào kho `J:\.pnpm-store`.)

- [ ] **Step 5: Cài lại backend như một dự án độc lập**

Run: `Set-Location backend; npm install --legacy-peer-deps`
Expected: `backend/package-lock.json` được bổ sung các package còn thiếu; **không** sinh `package-lock.json` / `node_modules` ở gốc. Ghi vào progress bản `@nestjs/platform-socket.io` sau khi cài (dự kiến 12.1.0 — bằng bản Docker đang nhận).
Kiểm lockfile đã khớp: `cmd /c "rmdir /s /q node_modules"; npm ci --legacy-peer-deps` → exit 0.
Run: `npm test` → pass hết (lúc rà soát: 58/58). Run: `npm run build` → exit 0.
Kiểm: `Test-Path node_modules/.pnpm` → `False`.

- [ ] **Step 6: Cài lại frontend**

Run: `Set-Location frontend; npm ci` → exit 0. `Test-Path node_modules/.pnpm` → `False`.
Run: `npm run lint` → chỉ còn **2 lỗi có sẵn** ở `src/context/auth.context.tsx` (setState trong effect, dùng biến trước khi khai báo) + 3 cảnh báo — giống lúc rà soát, không sửa.
Run: `npm run build` → **fail đúng lỗi có sẵn**: `useSearchParams() should be wrapped in a suspense boundary at page "/auth/callback"` (Task 9 Step 5 sửa). Không có lỗi khác.

- [ ] **Step 7: Kiểm phạm vi thay đổi**

`git status` chỉ có: `package.json` (gốc), `package-lock.json` (gốc, deleted), `backend/package.json`, `backend/package-lock.json`, `frontend/package.json`. File pnpm, `.npmrc`, `Dockerfile` **không** đổi.
Nếu Docker Desktop chạy được: `docker compose build backend` → build xong (Dockerfile vẫn `npm install --legacy-peer-deps` trên `backend/package*.json`).

- [ ] **Step 8: Progress + báo bạn cùng nhóm + commit (khi user cho phép)**

Progress: task 9a, output Step 5–6, bản `platform-socket.io`, lỗi có sẵn ở frontend. Nhắn bạn cùng nhóm: sau khi pull, xoá `node_modules` ở gốc và `backend/`, rồi `Set-Location backend; npm install --legacy-peer-deps`; không dùng pnpm.
```bash
git add package.json package-lock.json backend/package.json backend/package-lock.json frontend/package.json docs/progress.md
git commit -m "chore: thống nhất npm, backend thành dự án npm độc lập"
```

---

### Task 9b: `chore` — cài shadcn/ui

> **User chốt 2026-09-27:** frontend dùng shadcn/ui (đúng tech stack trong `CLAUDE.md`). Task riêng, **phiên riêng, commit riêng**, làm **sau Task 9a**, trước Task 9. Chỉ cài + add component, **không sửa trang nào**.
>
> **Hai bẫy đã biết trước:**
> - `frontend/` vẫn giữ `pnpm-lock.yaml` + `pnpm-workspace.yaml`, máy dev có pnpm 12.4.1. Chỉ nhờ field `packageManager` (Task 9a) mà CLI shadcn chọn npm; thiếu field này nó sẽ chạy `pnpm add` và `package-lock.json` không được cập nhật.
> - `shadcn init` viết lại `app/globals.css` → có thể làm hỏng khai báo font (`--font-sans` tự trỏ vòng `var(--font-sans)`).

**Files:**
- Create: `frontend/components.json`, `frontend/src/lib/utils.ts`, `frontend/src/components/ui/{button,input,textarea,card,badge,alert}.tsx`
- Modify: `frontend/app/globals.css`, `frontend/package.json`, `frontend/package-lock.json`

**Interfaces:**
- Produces: `Button`, `Input`, `Textarea`, `Card` (+ `CardHeader`, `CardTitle`, `CardContent`, …), `Badge`, `Alert` (+ `AlertDescription`) import từ `@/components/ui/<tên>`; `cn()` từ `@/lib/utils`. Task 9 và Task 8 dùng lại.

- [ ] **Step 1: Kiểm Task 9a đã xong**

`frontend/package.json` có `"packageManager": "npm@..."`; `Test-Path frontend/node_modules/.pnpm` → `False`. Chưa có → dừng, làm Task 9a trước. File pnpm giữ nguyên, **không xoá** (ADR-021).

- [ ] **Step 2: Init**

Run (PowerShell, trong `frontend`): `npx shadcn@latest init -d -b radix`
(`-d` = dùng mặc định, không hỏi tương tác. **Sửa 2026-09-27 khi làm:** ở shadcn 4.21.0 `-d` = `--preset=base-nova` → base mặc định là **Base UI**, không phải Radix → phải thêm `-b radix`.)
Expected: tạo `components.json`, `src/lib/utils.ts`, sửa `app/globals.css`, cài `cn` (thay `clsx` + `tailwind-merge`), `class-variance-authority`, `lucide-react`, `radix-ui`, …
Kiểm `components.json`:
- `tailwind.css` = `app/globals.css` — **không** phải `src/app/...` (có thư mục rỗng `src/app/.gitkeep`, CLI dễ đoán nhầm).
- `aliases.ui` = `@/components/ui`, `aliases.utils` = `@/lib/utils` (khớp `@/*` → `./src/*` trong `tsconfig.json`).

- [ ] **Step 3: Add component Task 9 cần**

Run: `npx shadcn@latest add button input textarea card badge alert`
Expected: 6 file trong `src/components/ui/`. **Không** add thêm component khác (Task 8 tự add `dialog`).

- [ ] **Step 4: Kiểm package manager + font**

- `git status` trong `frontend`: `package-lock.json` phải đổi, `pnpm-lock.yaml` **không** đổi. Nếu ngược lại → CLI đã dùng pnpm (field `packageManager` không có tác dụng) → dừng, `git checkout pnpm-lock.yaml`, chạy `npm install` để `package-lock.json` khớp `package.json`, ghi vào progress.
- `app/globals.css`: nếu `--font-sans` / `--font-mono` trong `@theme inline` thành `var(--font-sans)` / `var(--font-mono)` (tự trỏ vòng) → sửa lại `var(--font-geist-sans)` / `var(--font-geist-mono)` như bản gốc. `layout.tsx` đã gắn class font ở `<html>` → không sửa.

- [ ] **Step 5: Lint + build + nhìn lại trang cũ**

Run: `npm run lint` → không có lỗi mới ở file CLI sinh ra (2 lỗi có sẵn ở `auth.context.tsx` vẫn còn — không sửa).
Run: `npm run build` → chỉ fail đúng lỗi có sẵn ở `/auth/callback` (Task 9 Step 5 sửa); không có lỗi mới, nhất là không có lỗi từ `globals.css` / `src/components/ui`.
Run: `npm run dev` → mở `/login`, `/dashboard`: vẫn dùng được (các class Tailwind cũ không đổi; màu nền/font có thể đổi nhẹ do `globals.css` mới — ghi lại, không sửa trang).

- [ ] **Step 6: Progress + commit (khi user cho phép)**

Progress: task 9b, CLI đã dùng npm hay không, `globals.css` đổi gì, output lint/build.
```bash
git add frontend/components.json frontend/src/lib/utils.ts frontend/src/components/ui frontend/package.json frontend/package-lock.json frontend/app/globals.css docs/progress.md
git commit -m "chore: cài shadcn/ui"
```

---

### Task 9: Frontend — danh sách, tạo, nhập mã, link `/join/:code`, chi tiết phòng

> Làm **sau** Task 9a (npm) và Task 9b (cài shadcn), **trước** Task 8 (theo thứ tự task list).
>
> **Quyết định — user chốt 2026-09-27:**
> 1. **Dùng shadcn/ui** (cài ở Task 9b). Bản nháp các trang ở Step 6–8 viết bằng class Tailwind thuần từ trước khi chốt → khi làm, thay khung/nút/ô nhập/nhãn/thông báo bằng `Card`, `Button`, `Input`, `Textarea`, `Badge`, `Alert` từ `@/components/ui/*`. Logic, state, gọi API, `run`/`reloadKey` giữ nguyên. Vẫn dùng `confirm()` của trình duyệt (không thêm AlertDialog). Trang login/callback/dashboard chỉ sửa đúng các dòng ở Step 4, 5, 9 — không chuyển sang shadcn.
> 2. **Nút HOST ẩn/hiện theo `room.myRole === 'HOST'`**, task này **không** import `shared/permissions.ts`. Lý do: build context Docker của backend là `./backend`, frontend chưa chạy trong Docker. **Để lại:** user dự định đưa frontend vào Docker để cả project chạy một lượt bằng `docker compose` → lúc đó đặt build context ở gốc repo và chuyển frontend sang import bảng quyền dùng chung (§15). Ghi progress mục "lệch khỏi tài liệu": lệch §15 tạm thời.
> 3. **`safeReturnUrl` phân tích bằng `new URL` rồi so origin**, thay cho kiểm chuỗi `startsWith` của bản nháp cũ. Bản cũ bị vượt qua bằng `/login?returnUrl=/%09/evil.com`: trình duyệt tự bỏ tab/xuống dòng trong URL → thành `//evil.com`. Đã thử bằng Node (bộ phân tích URL chuẩn WHATWG, giống trình duyệt): `"/\t/evil.com"` và `"/\n/evil.com"` qua được kiểm chuỗi nhưng ra `http://evil.com/`.
> 4. **Test `safeReturnUrl` bằng script tạm, dùng xong xoá** — frontend chưa có công cụ test, không thêm vitest (Step 3). Page UI vẫn không test tự động.
>
> Kiểm page UI bằng `npm run lint`, `npm run build` và chạy tay ở Task 10.

**Files:**
- Create: `frontend/src/types/room.ts`
- Create: `frontend/src/services/room.service.ts`
- Create: `frontend/src/lib/return-url.ts`
- Create: `frontend/app/rooms/page.tsx`
- Create: `frontend/app/rooms/[roomId]/page.tsx`
- Create: `frontend/app/join/[code]/page.tsx`
- Modify: `frontend/app/login/page.tsx`
- Modify: `frontend/app/auth/callback/page.tsx`
- Modify: `frontend/app/dashboard/page.tsx`

**Interfaces:**
- Consumes: API Task 2–7; `useAuth()` (`token`, `isLoading`) từ `@/context/auth.context`; `useProtectedRoute()` từ `@/hooks/useProtectedRoute`; component shadcn + `cn()` (Task 9b).
- Produces:
  - Types `RoomRole`, `Room`, `RoomListResponse`, `RoomMember`.
  - `request<T>(token, path, init?)` (nội bộ file service) và các hàm `listMyRooms`, `createRoom`, `joinRoom`, `getRoom`, `updateRoom`, `listMembers`, `kickMember`, `leaveRoom`, `dissolveRoom`.
  - `safeReturnUrl(value: string | null): string`.
  - Trang chi tiết có state `reloadKey` + hàm `run(action, after)` — Task 8 dùng lại.

- [ ] **Step 1: Types**

`frontend/src/types/room.ts`:
```ts
// Kiểu dữ liệu khớp response của backend (docs/api/endpoint.md — Rooms)
export type RoomRole = 'HOST' | 'MEMBER';

export interface Room {
  id: string;
  name: string;
  description: string;
  joinCode: string;
  ownerId: string;
  status: 'ACTIVE' | 'DISSOLVED';
  memberCount: number;
  createdAt: string;
  myRole: RoomRole;
}

export interface RoomListResponse {
  items: Room[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface RoomMember {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  role: RoomRole;
  joinedAt: string;
}
```

- [ ] **Step 2: Service gọi API**

`frontend/src/services/room.service.ts`:
```ts
import type { Room, RoomListResponse, RoomMember } from '@/types/room';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// Gọi API kèm token; lỗi thì ném Error với message backend trả về
async function request<T>(token: string, path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...init.headers,
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    // Lỗi validate của class-validator trả message dạng mảng
    const message = Array.isArray(body.message) ? body.message.join(', ') : body.message;
    throw new Error(message || `Lỗi ${res.status}`);
  }
  // 204 không có body
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const listMyRooms = (token: string, page = 1) =>
  request<RoomListResponse>(token, `/rooms?page=${page}&limit=20`);

export const createRoom = (token: string, data: { name: string; description?: string }) =>
  request<Room>(token, '/rooms', { method: 'POST', body: JSON.stringify(data) });

export const joinRoom = (token: string, code: string) =>
  request<Room>(token, '/rooms/join', { method: 'POST', body: JSON.stringify({ code }) });

export const getRoom = (token: string, roomId: string) => request<Room>(token, `/rooms/${roomId}`);

export const updateRoom = (token: string, roomId: string, data: { name?: string; description?: string }) =>
  request<Room>(token, `/rooms/${roomId}`, { method: 'PATCH', body: JSON.stringify(data) });

export const listMembers = (token: string, roomId: string) =>
  request<RoomMember[]>(token, `/rooms/${roomId}/members`);

export const kickMember = (token: string, roomId: string, userId: string) =>
  request<void>(token, `/rooms/${roomId}/members/${userId}`, { method: 'DELETE' });

export const leaveRoom = (token: string, roomId: string) =>
  request<void>(token, `/rooms/${roomId}/members/me`, { method: 'DELETE' });

export const dissolveRoom = (token: string, roomId: string) =>
  request<void>(token, `/rooms/${roomId}/dissolve`, { method: 'POST' });
```

- [ ] **Step 3: `safeReturnUrl` (test trước bằng script tạm — quyết định 3, 4)**

**3a. Viết script kiểm** ở scratchpad của phiên (không để trong repo, **không commit**), đặt tên `return-url-check.mjs`:
```js
// Dùng xong xoá, KHÔNG commit. Chạy: node --experimental-strip-types return-url-check.mjs <đường dẫn return-url.ts>
import { pathToFileURL } from 'node:url';

globalThis.window = { location: { origin: 'http://localhost:3000' } }; // giả lập trình duyệt
const { safeReturnUrl } = await import(pathToFileURL(process.argv[2]).href);

const BS = String.fromCharCode(92); // dấu "\"
const cases = [
  [null, '/dashboard'],
  ['/join/ABCD2345', '/join/ABCD2345'],
  ['/rooms/abc?x=1#y', '/rooms/abc?x=1#y'],
  ['//evil.com', '/dashboard'],
  ['/' + BS + 'evil.com', '/dashboard'],
  ['/\t/evil.com', '/dashboard'],
  ['/\n/evil.com', '/dashboard'],
  ['https://evil.com', '/dashboard'],
  ['javascript:alert(1)', '/dashboard'],
  // Thêm sau code review (2026-09-28): dấu chấm bị bỏ nhưng "//" còn lại → pathname "//evil.com"
  ['/.//evil.com', '/dashboard'],
  ['/join/..//evil.com', '/dashboard'],
  ['/./' + BS + 'evil.com', '/dashboard'],
];
let fail = 0;
for (const [input, expected] of cases) {
  const got = safeReturnUrl(input);
  if (got !== expected) fail++;
  console.log(got === expected ? 'PASS' : 'FAIL', JSON.stringify(input), '->', got);
}
console.log(fail ? `${fail} FAIL` : 'ALL PASS');
process.exit(fail ? 1 : 0);
```

**3b. Thấy fail trước:** tạm tạo `frontend/src/lib/return-url.ts` bằng bản nháp cũ (kiểm chuỗi):
```ts
export function safeReturnUrl(value: string | null): string {
  if (value && value.startsWith('/') && !value.startsWith('//') && !value.startsWith('/\\')) {
    return value;
  }
  return '/dashboard';
}
```
Run (Node 22): `node --experimental-strip-types return-url-check.mjs "<gốc repo>/frontend/src/lib/return-url.ts"`
Expected: `2 FAIL` — dòng `"/\t/evil.com"` và `"/\n/evil.com"` (đã thử lúc review plan 2026-09-27, ra đúng như vậy).

**3c. Thay bằng bản chốt** `frontend/src/lib/return-url.ts`:
```ts
// Chỉ nhận đường dẫn nội bộ như "/join/ABCD2345", còn lại về /dashboard (chống open redirect).
// Không tự kiểm chuỗi bằng startsWith: trình duyệt tự bỏ tab/xuống dòng và coi "\" như "/",
// nên "/\t/evil.com" vẫn thành "//evil.com". Dùng chính bộ phân tích URL của trình duyệt rồi so origin.
// Chỉ gọi phía trình duyệt (cần window) — trong event handler / useEffect.
export function safeReturnUrl(value: string | null): string {
  if (!value) return '/dashboard';
  try {
    const url = new URL(value, window.location.origin);
    // "/.//evil.com" vẫn cùng origin nhưng pathname = "//evil.com" → trình duyệt hiểu là domain khác
    if (url.origin === window.location.origin && !url.pathname.startsWith('//')) {
      return url.pathname + url.search + url.hash;
    }
  } catch {
    // Không phân tích được thành URL → coi như không hợp lệ
  }
  return '/dashboard';
}
```
Run lại script. Expected: `ALL PASS`. Dán output 3b + 3c vào progress, rồi xoá script.
(**Sửa 2026-09-28 khi làm:** bản `new URL` ban đầu chỉ so origin, bị code review vượt qua bằng `/.//evil.com` → thêm điều kiện `!url.pathname.startsWith('//')` và 3 case cuối trong script. Chi tiết ở progress Task 9.)

- [ ] **Step 4: Login đọc `returnUrl` (§4: chưa đăng nhập → `/login?returnUrl=...` → đăng nhập xong quay lại)**

Trong `frontend/app/login/page.tsx`:

Thêm import:
```ts
import { safeReturnUrl } from '@/lib/return-url';
```
Thêm hàm trong component, ngay trên `handleSubmit`:
```ts
  // Trang cần quay lại sau khi đăng nhập (vd /join/:code), mặc định /dashboard
  const getReturnUrl = () => safeReturnUrl(new URLSearchParams(window.location.search).get('returnUrl'));
```
Trong `handleSubmit` đổi `router.push('/dashboard');` thành:
```ts
      router.push(getReturnUrl());
```
Đổi `handleGoogleLogin` thành:
```ts
  const handleGoogleLogin = () => {
    setIsLoading(true);
    // Google redirect đi rồi quay về /auth/callback → cất returnUrl lại để callback đọc
    sessionStorage.setItem('returnUrl', getReturnUrl());
    loginWithGoogle();
  };
```

- [ ] **Step 5: Callback Google quay về `returnUrl`**

`frontend/app/auth/callback/page.tsx` thay toàn bộ bằng:
```tsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { safeReturnUrl } from '@/lib/return-url';

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    // Đọc query trực tiếp thay vì useSearchParams → không cần bọc Suspense khi build
    const token = new URLSearchParams(window.location.search).get('token');
    if (token) {
      localStorage.setItem('accessToken', token);
      // returnUrl do trang login cất trước khi chuyển sang Google.
      // Không removeItem: dev Strict Mode chạy effect 2 lần, lần 2 đọc null sẽ ghi đè bằng /dashboard.
      // Để lại vô hại: nút Google ở /login luôn ghi đè trước mỗi lần đăng nhập. (Sửa 2026-09-28 theo code review)
      const returnUrl = safeReturnUrl(sessionStorage.getItem('returnUrl'));
      // Tải lại cả trang: AuthProvider chỉ đọc token từ localStorage lúc khởi tạo,
      // router.replace (chuyển trang phía client) sẽ giữ token = null
      window.location.replace(returnUrl);
    } else {
      router.replace('/login?error=google_auth_failed');
    }
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
        <p className="text-lg text-gray-700">Đang xử lý đăng nhập...</p>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Trang `/join/:code`**

`frontend/app/join/[code]/page.tsx`:
```tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth.context';
import { joinRoom } from '@/services/room.service';

// Vào phòng bằng đường dẫn chia sẻ. Chưa đăng nhập → sang /login, xong quay lại đây (§4)
export default function JoinByLinkPage() {
  const { code } = useParams<{ code: string }>();
  const { token, isLoading } = useAuth();
  const router = useRouter();
  const [error, setError] = useState('');

  useEffect(() => {
    if (isLoading) return;
    if (!token) {
      router.replace(`/login?returnUrl=${encodeURIComponent(`/join/${code}`)}`);
      return;
    }
    // API idempotent: đã là thành viên thì vẫn trả phòng
    joinRoom(token, code)
      .then((room) => router.replace(`/rooms/${room.id}`))
      .catch((err: Error) => setError(err.message));
  }, [isLoading, token, code, router]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="bg-white rounded-lg shadow-lg p-8 text-center space-y-4">
        {error ? (
          <>
            <p className="text-red-700">{error}</p>
            <Link href="/rooms" className="text-blue-600 hover:text-blue-700 font-semibold">
              ← Về danh sách phòng
            </Link>
          </>
        ) : (
          <p className="text-lg text-gray-700">Đang vào phòng...</p>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 7: Trang `/rooms`**

`frontend/app/rooms/page.tsx`:
```tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth.context';
import { useProtectedRoute } from '@/hooks/useProtectedRoute';
import { createRoom, joinRoom, listMyRooms } from '@/services/room.service';
import type { Room } from '@/types/room';

const inputClass =
  'w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent';
const buttonClass =
  'bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition duration-200 disabled:opacity-50';

// Trang "Phòng của tôi": tạo phòng, nhập mã tham gia, danh sách phòng
export default function RoomsPage() {
  const { token } = useAuth();
  const { isLoading } = useProtectedRoute();
  const router = useRouter();

  const [rooms, setRooms] = useState<Room[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) return;
    listMyRooms(token, page)
      .then((res) => {
        setRooms(res.items);
        setHasMore(res.hasMore);
      })
      .catch((err: Error) => setError(err.message));
  }, [token, page]);

  // Tạo phòng / nhập mã xong thì chuyển sang trang chi tiết phòng
  const run = async (action: () => Promise<Room>) => {
    setError('');
    setBusy(true);
    try {
      const room = await action();
      router.push(`/rooms/${room.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Có lỗi xảy ra');
      setBusy(false);
    }
  };

  if (isLoading || !token) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-lg text-gray-600">Đang tải...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-gray-900">Phòng của tôi</h1>
          <Link href="/dashboard" className="text-blue-600 hover:text-blue-700 font-semibold">
            Tài khoản
          </Link>
        </div>

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              run(() => createRoom(token, { name, description: description || undefined }));
            }}
            className="bg-white rounded-lg shadow p-6 space-y-3"
          >
            <h2 className="text-lg font-semibold text-gray-900">Tạo phòng mới</h2>
            <input
              className={inputClass}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Tên phòng"
              maxLength={100}
              required
            />
            <textarea
              className={inputClass}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Mô tả (không bắt buộc)"
              maxLength={500}
              rows={2}
            />
            <button type="submit" disabled={busy} className={buttonClass}>
              Tạo phòng
            </button>
          </form>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              run(() => joinRoom(token, code));
            }}
            className="bg-white rounded-lg shadow p-6 space-y-3"
          >
            <h2 className="text-lg font-semibold text-gray-900">Tham gia bằng mã</h2>
            <input
              className={`${inputClass} font-mono tracking-widest uppercase`}
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="VD: ABCD2345"
              maxLength={8}
              required
            />
            <button type="submit" disabled={busy} className={buttonClass}>
              Tham gia
            </button>
          </form>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          {rooms.length === 0 ? (
            <p className="text-gray-600">Bạn chưa ở trong phòng nào.</p>
          ) : (
            <ul className="divide-y divide-gray-200">
              {rooms.map((room) => (
                <li key={room.id}>
                  <Link
                    href={`/rooms/${room.id}`}
                    className="flex justify-between items-center py-3 px-2 rounded hover:bg-gray-50"
                  >
                    <div>
                      <p className="font-semibold text-gray-900">{room.name}</p>
                      <p className="text-sm text-gray-500">{room.memberCount} thành viên</p>
                    </div>
                    {room.myRole === 'HOST' && (
                      <span className="text-xs font-semibold bg-indigo-100 text-indigo-700 px-2 py-1 rounded">
                        HOST
                      </span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <div className="flex justify-between mt-4">
            <button
              disabled={page === 1}
              onClick={() => setPage(page - 1)}
              className="text-blue-600 disabled:text-gray-400"
            >
              ← Trang trước
            </button>
            <button
              disabled={!hasMore}
              onClick={() => setPage(page + 1)}
              className="text-blue-600 disabled:text-gray-400"
            >
              Trang sau →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 8: Trang `/rooms/[roomId]`**

`frontend/app/rooms/[roomId]/page.tsx`:
```tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth.context';
import { useProtectedRoute } from '@/hooks/useProtectedRoute';
import {
  dissolveRoom,
  getRoom,
  kickMember,
  leaveRoom,
  listMembers,
  updateRoom,
} from '@/services/room.service';
import type { Room, RoomMember } from '@/types/room';

const inputClass =
  'w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent';
const buttonClass =
  'bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition duration-200';
const dangerClass =
  'bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-lg transition duration-200';

// Chi tiết phòng. Nút của HOST chỉ ẩn/hiện theo myRole — backend mới là nơi kiểm quyền.
export default function RoomDetailPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const { token } = useAuth();
  const { isLoading } = useProtectedRoute();
  const router = useRouter();

  const [room, setRoom] = useState<Room | null>(null);
  const [members, setMembers] = useState<RoomMember[]>([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  // Tăng lên để tải lại phòng + thành viên sau mỗi thao tác
  const [reloadKey, setReloadKey] = useState(0);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (!token) return;
    Promise.all([getRoom(token, roomId), listMembers(token, roomId)])
      .then(([roomData, memberData]) => {
        setRoom(roomData);
        setMembers(memberData);
      })
      .catch((err: Error) => setError(err.message));
  }, [token, roomId, reloadKey]);

  // Chạy một thao tác; lỗi thì hiện thông báo, thành công thì gọi after()
  const run = async (action: () => Promise<unknown>, after: () => void) => {
    setError('');
    setNotice('');
    try {
      await action();
      after();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Có lỗi xảy ra');
    }
  };
  const reload = () => setReloadKey((k) => k + 1);

  if (isLoading || !token) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-lg text-gray-600">Đang tải...</p>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        {error ? <p className="text-red-700">{error}</p> : <p className="text-lg text-gray-600">Đang tải...</p>}
        <Link href="/rooms" className="text-blue-600 hover:text-blue-700 font-semibold">
          ← Về danh sách phòng
        </Link>
      </div>
    );
  }

  const isHost = room.myRole === 'HOST';
  const joinLink = `${window.location.origin}/join/${room.joinCode}`;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        <Link href="/rooms" className="text-blue-600 hover:text-blue-700 font-semibold">
          ← Phòng của tôi
        </Link>

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        )}
        {notice && (
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-green-800 text-sm">{notice}</p>
          </div>
        )}

        {/* Thông tin phòng + sửa (HOST) */}
        <div className="bg-white rounded-lg shadow p-6 space-y-3">
          {editing ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                run(() => updateRoom(token, roomId, { name, description }), () => {
                  setEditing(false);
                  reload();
                });
              }}
              className="space-y-3"
            >
              <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} maxLength={100} required />
              <textarea
                className={inputClass}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={500}
                rows={2}
              />
              <div className="flex gap-3">
                <button type="submit" className={buttonClass}>Lưu</button>
                <button type="button" onClick={() => setEditing(false)} className="text-gray-600">Huỷ</button>
              </div>
            </form>
          ) : (
            <>
              <div className="flex justify-between items-start">
                <h1 className="text-3xl font-bold text-gray-900">{room.name}</h1>
                {isHost && (
                  <button
                    onClick={() => {
                      setName(room.name);
                      setDescription(room.description);
                      setEditing(true);
                    }}
                    className="text-blue-600 hover:text-blue-700 font-semibold"
                  >
                    Sửa
                  </button>
                )}
              </div>
              {room.description && <p className="text-gray-600">{room.description}</p>}
            </>
          )}
        </div>

        {/* Chia sẻ mã / đường dẫn */}
        <div className="bg-white rounded-lg shadow p-6 space-y-3">
          <h2 className="text-lg font-semibold text-gray-900">Mời người khác vào phòng</h2>
          <div className="flex items-center gap-3">
            <span className="font-mono text-2xl tracking-widest text-gray-900">{room.joinCode}</span>
            <button onClick={() => navigator.clipboard.writeText(room.joinCode)} className="text-blue-600 hover:text-blue-700">
              Sao chép mã
            </button>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-600 break-all">{joinLink}</span>
            <button onClick={() => navigator.clipboard.writeText(joinLink)} className="text-blue-600 hover:text-blue-700 shrink-0">
              Sao chép link
            </button>
          </div>
        </div>

        {/* Thành viên */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Thành viên ({members.length})</h2>
          <ul className="divide-y divide-gray-200">
            {members.map((m) => (
              <li key={m.userId} className="flex justify-between items-center py-3">
                <div>
                  <p className="font-semibold text-gray-900">{m.displayName}</p>
                  <p className="text-sm text-gray-500">Vào phòng {new Date(m.joinedAt).toLocaleDateString('vi-VN')}</p>
                </div>
                <div className="flex items-center gap-3">
                  {m.role === 'HOST' && (
                    <span className="text-xs font-semibold bg-indigo-100 text-indigo-700 px-2 py-1 rounded">HOST</span>
                  )}
                  {/* Phòng chỉ có 1 HOST là mình → HOST thấy nút kick ở mọi MEMBER */}
                  {isHost && m.role === 'MEMBER' && (
                    <button
                      onClick={() =>
                        confirm(`Mời ${m.displayName} ra khỏi phòng?`) &&
                        run(() => kickMember(token, roomId, m.userId), reload)
                      }
                      className="text-red-600 hover:text-red-700 text-sm font-semibold"
                    >
                      Mời ra
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Rời / giải tán */}
        <div className="flex justify-end">
          {isHost ? (
            <button
              onClick={() =>
                confirm('Giải tán phòng? Không ai vào lại được phòng này nữa.') &&
                run(() => dissolveRoom(token, roomId), () => router.push('/rooms'))
              }
              className={dangerClass}
            >
              Giải tán phòng
            </button>
          ) : (
            <button
              onClick={() =>
                confirm('Rời khỏi phòng này?') && run(() => leaveRoom(token, roomId), () => router.push('/rooms'))
              }
              className={dangerClass}
            >
              Rời phòng
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 9: Link từ dashboard sang `/rooms`**

Trong `frontend/app/dashboard/page.tsx`, trong khối `<div className="flex gap-4">` cuối trang, thêm **trước** nút "Đăng Xuất":
```tsx
            <Link
              href="/rooms"
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition duration-200 text-center"
            >
              Phòng của tôi
            </Link>
```

- [ ] **Step 10: Lint + build**

Run (PowerShell, trong `frontend`): `npm run lint`
Expected: không có lỗi ở các file vừa tạo/sửa. (Lỗi có sẵn ở file khác thì ghi lại, không sửa.)
Run: `npm run build`
Expected: build xong; danh sách route có `/rooms`, `/rooms/[roomId]`, `/join/[code]`.

- [ ] **Step 11: Commit (khi user cho phép)**

```bash
git add frontend/src/types/room.ts frontend/src/services/room.service.ts frontend/src/lib/return-url.ts frontend/app/rooms frontend/app/join frontend/app/login/page.tsx frontend/app/auth/callback/page.tsx frontend/app/dashboard/page.tsx docs/progress.md
git commit -m "feat: frontend danh sách phòng, tạo, nhập mã, link join và chi tiết phòng"
```

---

### Task 8a: HOST thêm 1 thành viên bằng email — `POST /rooms/:roomId/members` (đã làm 2026-09-28)

> User chốt 2026-09-28: phải có API thêm 1 thành viên trước, import (Task 8) là bản hàng loạt của nó. Trace: đề cương §5.4 "Chủ phòng có quyền quản lý thành viên", `role.md` "Quản lý / kick member".

- Backend: `RoomAction.ADD_MEMBER` (bảng quyền); `dto/add-member.dto.ts` (trim + chữ thường, `@IsEmail`); `RoomsService.addMember(hostId, roomId, email)` = `assertRoomPermission(ADD_MEMBER)` → `userModel.findOne({ email })` không thấy → 404 → `memberModel.create({ roomId, userId, role: MEMBER, invitedBy: hostId })` trùng unique → 409 → `$inc memberCount: 1` → 201 `{ userId, displayName, avatarUrl, role, joinedAt }`. Constructor thêm `userModel` ở cuối; `rooms.module.ts` đăng ký model `User`. Route `POST :roomId/members` ngay sau `GET :roomId/members`.
- Test (viết trước): 4 test `addMember` — MEMBER → 403; email chưa đăng ký → 404; đã ở trong phòng → 409, không tăng count; thành công → tạo MEMBER + `invitedBy`, count +1, đúng response. Helper `build()` có thêm `userModel = { findOne: q(null) }`.
- Frontend: `addMember(token, roomId, email)` trong `room.service.ts`; trang chi tiết: HOST thấy ô email + nút "Thêm" trong khung "Thành viên", xong thì `reload()`.

---

### Task 8: Import / export thành viên `[GVHD-verbal]` (§13) — **HOÃN**

> **HOÃN — user chốt 2026-09-28:** làm sau, dùng "thêm thành viên bằng email" (Task 8a) trước. Chỉ hoãn, không bỏ: yêu cầu GVHD (§13), PROJECT_CONTEXT §3 để trong phạm vi, `role.md` có dòng "Import members / Export" → phải làm trước khi bảo vệ. Đã rà (2026-09-28): hoãn không ảnh hưởng DB hay code khác — không cần collection/field mới; route `POST :roomId/members/import`, `GET :roomId/members/export` không đè route hiện có; `IMPORT_MEMBERS`/`EXPORT_MEMBERS` đã có trong bảng quyền; không module nào phụ thuộc. Khi làm lại: state `notice` ở `app/rooms/[roomId]/page.tsx` đã bị xoá (thừa khi chưa có import) → thêm lại để hiện kết quả import; cân nhắc làm CSV export chung với export chat/meeting/whiteboard (ADR-010).
>
> **Cập nhật 2026-09-28 (sau Task 8a) — cần xem lại trước khi làm:** Task 8a đã làm sẵn phần constructor `userModel` (ở cuối), đăng ký model `User` trong `rooms.module.ts`, import `User`/`UserDocument` trong service, `userModel` trong helper `build()` của test (hiện chỉ có `findOne`) → Step 2 chỉ cần thêm `find: q([])` vào `userModel`, Step 4 bỏ phần đổi constructor + import `User`, Step 5 bỏ hẳn. User muốn Task 8 **gọn lại**, dùng lại logic của `addMember` thay vì thiết kế riêng — thiết kế bên dưới (dryRun, `bulkWrite` upsert, rate limit, CSV) viết trước Task 8a, **chốt lại với user khi bắt đầu Task 8**. Số test: `rooms.service.spec` hiện 40 (không phải 24 như lúc viết plan).

> Chi tiết chốt trong plan này (spec §5 để lại "chốt khi làm Task 8"):
> - **Định dạng import:** file `.csv` hoặc `.txt`, mỗi dòng một email (lấy cột đầu tiên), dòng đầu có thể là tiêu đề `email`, tối đa 200 dòng. File export dùng lại để import được.
> - **Đọc file ở frontend**, gửi mảng email lên backend. Backend validate **từng dòng** (định dạng email, trùng trong file, chưa có tài khoản, đã là thành viên).
> - **Bước review:** cùng endpoint với `dryRun: true` → backend chỉ kiểm, trả kết quả từng dòng; user xác nhận → gọi lại với `dryRun: false`.
> - **Idempotent:** upsert theo unique `{roomId, userId}` → import lại không tạo bản ghi thứ hai; `memberCount` tăng đúng số bản ghi thật sự thêm (`upsertedCount`).
> - Rate limit import 10 lần/phút/user trong Redis (§16 có liệt kê "import").
> - **Export:** CSV `email,displayName,role,joinedAt`, UTF-8 có BOM (Excel đọc đúng tiếng Việt), chặn CSV injection (ô bắt đầu bằng `= + - @` thêm `'` phía trước).
> - **UI dùng shadcn** (user chốt 2026-09-27, cài ở Task 9b): trước Step 10 chạy `npx shadcn@latest add dialog` (PowerShell, trong `frontend`; kiểm lại package manager như Task 9b Step 4). `ImportMembersDialog` dùng `Dialog` của shadcn thay khung `fixed inset-0` tự vẽ trong bản nháp Step 10; nút/bảng dùng component shadcn. Logic giữ nguyên.

**Files:**
- Create: `backend/src/modules/rooms/dto/import-members.dto.ts`
- Modify: `backend/src/modules/rooms/rooms.service.ts`
- Modify: `backend/src/modules/rooms/rooms.service.spec.ts`
- Modify: `backend/src/modules/rooms/rooms.controller.ts`
- Modify: `backend/src/modules/rooms/rooms.module.ts`
- Modify: `frontend/src/types/room.ts`
- Modify: `frontend/src/services/room.service.ts`
- Create: `frontend/src/features/rooms/ImportMembersDialog.tsx`
- Create: `frontend/src/components/ui/dialog.tsx` (CLI shadcn sinh ra, kèm sửa `package.json` / `package-lock.json`)
- Modify: `frontend/app/rooms/[roomId]/page.tsx`
- Modify: `docs/api/endpoint.md`

**Interfaces:**
- Consumes: `checkRateLimit` (Task 3), `findMembersWithUser` + `PopulatedMember` (Task 4), `access.assertRoomPermission`, `RoomAction.IMPORT_MEMBERS` / `EXPORT_MEMBERS`; trang chi tiết: `run`, `reload`, `setNotice` (Task 9).
- Produces:
  - `type ImportRowStatus = 'OK' | 'INVALID_EMAIL' | 'DUPLICATE_IN_FILE' | 'NOT_REGISTERED' | 'ALREADY_MEMBER'`
  - `importMembers(hostId: string, roomId: string, emails: string[], dryRun: boolean): Promise<{ rows: { row: number; email: string; status: ImportRowStatus }[]; addedCount: number }>`
  - `exportMembersCsv(hostId: string, roomId: string): Promise<string>`
  - `csvCell(value: string): string` (export để test)
  - Constructor `RoomsService` thêm `userModel` ở **cuối**.

- [ ] **Step 1: DTO**

`backend/src/modules/rooms/dto/import-members.dto.ts`:
```ts
import { ArrayMaxSize, ArrayNotEmpty, IsArray, IsBoolean, IsString, MaxLength } from 'class-validator';

export class ImportMembersDto {
  // Không dùng @IsEmail ở đây: email sai định dạng được báo theo từng dòng ở bước review,
  // không làm hỏng cả request
  @IsArray()
  @ArrayNotEmpty({ message: 'Danh sách email trống' })
  @ArrayMaxSize(200, { message: 'Tối đa 200 email mỗi lần import' })
  @IsString({ each: true })
  @MaxLength(320, { each: true })
  emails!: string[];

  // true = chỉ kiểm tra (bước review), false = thêm thật
  @IsBoolean()
  dryRun!: boolean;
}
```

- [ ] **Step 2: Sửa helper test cho constructor mới + viết test (fail)**

Trong `rooms.service.spec.ts`:

Đổi dòng import service thành:
```ts
import { RoomsService, csvCell, generateJoinCode } from './rooms.service.js';
```

Trong `build()`, thêm `bulkWrite` vào `memberModel`:
```ts
    bulkWrite: vi.fn().mockResolvedValue({ upsertedCount: 0 }),
```
thêm `userModel` trước dòng `const service = ...`:
```ts
  const userModel = { find: q([]) };
```
đổi dòng tạo service và return thành:
```ts
  const service = new RoomsService(
    roomModel as any,
    memberModel as any,
    access as any,
    redis as any,
    userModel as any,
  );
  return { service, roomModel, memberModel, access, redis, userModel };
```

Thêm vào cuối file:
```ts
describe('importMembers', () => {
  const a = { _id: new Types.ObjectId(), email: 'a@x.com' }; // có tài khoản, chưa ở trong phòng
  const b = { _id: new Types.ObjectId(), email: 'b@x.com' }; // có tài khoản, đã là thành viên

  function setup() {
    const ctx = build();
    ctx.userModel.find.mockReturnValue(query([a, b]));
    ctx.memberModel.find.mockReturnValue(query([{ userId: b._id }]));
    return ctx;
  }
  const emails = ['a@x.com', ' A@X.com ', 'khong-phai-email', 'b@x.com', 'c@x.com'];

  it('phân loại từng dòng (chuẩn hoá trim + chữ thường)', async () => {
    const { service } = setup();

    const res = await service.importMembers(userId, roomId, emails, true);

    expect(res.rows).toEqual([
      { row: 1, email: 'a@x.com', status: 'OK' },
      { row: 2, email: 'a@x.com', status: 'DUPLICATE_IN_FILE' },
      { row: 3, email: 'khong-phai-email', status: 'INVALID_EMAIL' },
      { row: 4, email: 'b@x.com', status: 'ALREADY_MEMBER' },
      { row: 5, email: 'c@x.com', status: 'NOT_REGISTERED' },
    ]);
  });

  it('dryRun → không ghi DB, addedCount 0', async () => {
    const { service, memberModel, roomModel } = setup();

    const res = await service.importMembers(userId, roomId, emails, true);

    expect(res.addedCount).toBe(0);
    expect(memberModel.bulkWrite).not.toHaveBeenCalled();
    expect(roomModel.updateOne).not.toHaveBeenCalled();
  });

  it('xác nhận → upsert chỉ dòng OK, tăng memberCount theo số bản ghi thật sự thêm', async () => {
    const { service, memberModel, roomModel } = setup();
    memberModel.bulkWrite.mockResolvedValue({ upsertedCount: 1 });

    const res = await service.importMembers(userId, roomId, emails, false);

    const ops = memberModel.bulkWrite.mock.calls[0][0];
    expect(ops).toHaveLength(1);
    expect(ops[0].updateOne.filter).toEqual({ roomId: new Types.ObjectId(roomId), userId: a._id });
    expect(ops[0].updateOne.upsert).toBe(true);
    expect(ops[0].updateOne.update.$setOnInsert.role).toBe(RoomRole.MEMBER);
    expect(roomModel.updateOne).toHaveBeenCalledWith({ _id: roomId }, { $inc: { memberCount: 1 } });
    expect(res.addedCount).toBe(1);
  });

  it('không có quyền → 403, không đọc users', async () => {
    const { service, access, userModel } = setup();
    access.assertRoomPermission.mockRejectedValue(new ForbiddenException());

    await expect(service.importMembers(userId, roomId, emails, true)).rejects.toBeInstanceOf(ForbiddenException);
    expect(userModel.find).not.toHaveBeenCalled();
  });

  it('quá 10 lần/phút → 429', async () => {
    const { service, redis } = setup();
    redis.incr.mockResolvedValue(11);

    const err = await service.importMembers(userId, roomId, emails, true).catch((e) => e);

    expect(err.getStatus()).toBe(429);
    expect(redis.incr).toHaveBeenCalledWith(`ratelimit:import:${userId}`);
  });
});

describe('exportMembersCsv', () => {
  it('có BOM + tiêu đề, mỗi thành viên một dòng, bỏ user đã bị xoá', async () => {
    const { service, memberModel, access } = build();
    const joinedAt = new Date('2026-09-26T00:00:00Z');
    const find = query([
      { userId: { _id: new Types.ObjectId(), email: 'a@x.com', displayName: 'An' }, role: RoomRole.HOST, joinedAt },
      { userId: null, role: RoomRole.MEMBER, joinedAt },
    ]);
    memberModel.find.mockReturnValue(find);

    const csv = await service.exportMembersCsv(userId, roomId);

    expect(access.assertRoomPermission).toHaveBeenCalledWith(userId, roomId, 'EXPORT_MEMBERS');
    expect(find.populate).toHaveBeenCalledWith('userId', 'email displayName');
    expect(csv).toBe('﻿email,displayName,role,joinedAt\r\n"a@x.com","An","HOST","2026-09-26T00:00:00.000Z"');
  });
});

describe('csvCell', () => {
  it('bọc ngoặc kép, nhân đôi dấu " bên trong', () => {
    expect(csvCell('a "b"')).toBe('"a ""b"""');
  });

  it('chặn CSV injection: ô bắt đầu bằng = + - @ thêm \' phía trước', () => {
    expect(csvCell('=HYPERLINK("x")')).toBe('"\'=HYPERLINK(""x"")"');
    expect(csvCell('@cmd')).toBe('"\'@cmd"');
  });
});
```

- [ ] **Step 3: Chạy test, xác nhận fail**

Run: `npm test -- src/modules/rooms/rooms.service.spec.ts`
Expected: FAIL — `csvCell` không được export / `service.importMembers is not a function`.

- [ ] **Step 4: Viết code service**

Trong `rooms.service.ts`:

Thêm import:
```ts
import { isEmail } from 'class-validator';
import { User } from '../users/schemas/user.schema.js';
import type { UserDocument } from '../users/schemas/user.schema.js';
```

Thêm hằng số dưới `RATE_WINDOW_SECONDS`:
```ts
// Giới hạn import hàng loạt (§16)
const IMPORT_RATE_LIMIT = 10;
```

Thêm dưới `PopulatedMember`:
```ts
// Kết quả kiểm tra từng dòng khi import
export type ImportRowStatus = 'OK' | 'INVALID_EMAIL' | 'DUPLICATE_IN_FILE' | 'NOT_REGISTERED' | 'ALREADY_MEMBER';

// Một ô CSV: bọc "..." và nhân đôi dấu " bên trong.
// Ô bắt đầu bằng = + - @ thêm ' phía trước để Excel không chạy như công thức (CSV injection).
export function csvCell(value: string): string {
  const safe = /^[=+\-@]/.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}
```

Đổi constructor thành:
```ts
  constructor(
    @InjectModel(Room.name) private roomModel: Model<RoomDocument>,
    @InjectModel(RoomMember.name) private memberModel: Model<RoomMemberDocument>,
    private access: RoomAccessService,
    private redis: RedisService,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {}
```

Thêm vào class (sau `dissolveRoom`):
```ts
  // POST /rooms/:roomId/members/import — chỉ HOST (GVHD §13).
  // dryRun = true: chỉ kiểm từng dòng cho bước review; false: thêm thật.
  async importMembers(hostId: string, roomId: string, emails: string[], dryRun: boolean) {
    await this.access.assertRoomPermission(hostId, roomId, RoomAction.IMPORT_MEMBERS);
    await this.checkRateLimit(
      `ratelimit:import:${hostId}`,
      IMPORT_RATE_LIMIT,
      'Bạn import quá nhiều lần, vui lòng đợi 1 phút',
    );

    const normalized = emails.map((e) => e.trim().toLowerCase());
    const validEmails = normalized.filter((e) => isEmail(e));

    // Tra user theo email, rồi xem ai đã ở trong phòng
    const users = await this.userModel
      .find({ email: { $in: validEmails } })
      .select('_id email')
      .lean()
      .exec();
    const userIdByEmail = new Map(users.map((u) => [u.email, u._id]));
    const members = await this.memberModel
      .find({ roomId, userId: { $in: users.map((u) => u._id) } })
      .select('userId')
      .lean()
      .exec();
    const memberIds = new Set(members.map((m) => String(m.userId)));

    // Kiểm từng dòng theo thứ tự trong file
    const seen = new Set<string>();
    const rows = normalized.map((email, i) => {
      const userId = userIdByEmail.get(email);
      let status: ImportRowStatus;
      if (!isEmail(email)) status = 'INVALID_EMAIL';
      else if (seen.has(email)) status = 'DUPLICATE_IN_FILE';
      else if (!userId) status = 'NOT_REGISTERED';
      else if (memberIds.has(String(userId))) status = 'ALREADY_MEMBER';
      else status = 'OK';
      seen.add(email);
      return { row: i + 1, email, status };
    });

    if (dryRun) {
      return { rows, addedCount: 0 };
    }

    // Upsert theo unique {roomId, userId}: ai đã vào bằng mã trong lúc review thì không bị thêm lần 2
    const ops = rows
      .filter((r) => r.status === 'OK')
      .map((r) => ({
        updateOne: {
          filter: { roomId: new Types.ObjectId(roomId), userId: userIdByEmail.get(r.email)! },
          update: {
            $setOnInsert: {
              role: RoomRole.MEMBER,
              invitedBy: new Types.ObjectId(hostId),
              joinedAt: new Date(),
            },
          },
          upsert: true,
        },
      }));

    let addedCount = 0;
    if (ops.length > 0) {
      const result = await this.memberModel.bulkWrite(ops);
      addedCount = result.upsertedCount;
      if (addedCount > 0) {
        await this.roomModel.updateOne({ _id: roomId }, { $inc: { memberCount: addedCount } }).exec();
      }
    }
    return { rows, addedCount };
  }

  // GET /rooms/:roomId/members/export — chỉ HOST. CSV có BOM để Excel đọc đúng tiếng Việt
  async exportMembersCsv(hostId: string, roomId: string) {
    await this.access.assertRoomPermission(hostId, roomId, RoomAction.EXPORT_MEMBERS);
    const members = await this.findMembersWithUser(roomId, 'email displayName');
    const lines = members
      .filter((m) => m.userId !== null)
      .map((m) =>
        [m.userId!.email ?? '', m.userId!.displayName ?? '', m.role, new Date(m.joinedAt).toISOString()]
          .map(csvCell)
          .join(','),
      );
    return '﻿' + ['email,displayName,role,joinedAt', ...lines].join('\r\n');
  }
```

> `Map`/`Set` ở đây là biến cục bộ trong một lần gọi hàm, không giữ state giữa các request → không vi phạm ràng buộc 5.

- [ ] **Step 5: Đăng ký model `User` trong `rooms.module.ts`**

Thêm import:
```ts
import { User, UserSchema } from '../users/schemas/user.schema.js';
```
Thêm vào mảng `forFeature`:
```ts
      // Import thành viên tra user theo email
      { name: User.name, schema: UserSchema },
```

- [ ] **Step 6: Chạy test, xác nhận pass**

Run: `npm test -- src/modules/rooms/rooms.service.spec.ts`
Expected: PASS 34/34.

- [ ] **Step 7: Thêm route**

Trong `rooms.controller.ts`, thêm `Header` vào import `@nestjs/common`, thêm:
```ts
import { ImportMembersDto } from './dto/import-members.dto.js';
```
Thêm method sau `members`:
```ts
  // POST /rooms/:roomId/members/import  { emails, dryRun } — HOST
  @Post(':roomId/members/import')
  @HttpCode(200)
  importMembers(@Req() req: any, @Param('roomId') roomId: string, @Body() dto: ImportMembersDto) {
    return this.roomsService.importMembers(req.user.id, roomId, dto.emails, dto.dryRun);
  }

  // GET /rooms/:roomId/members/export — HOST, tải file CSV
  @Get(':roomId/members/export')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="members.csv"')
  exportMembers(@Req() req: any, @Param('roomId') roomId: string) {
    return this.roomsService.exportMembersCsv(req.user.id, roomId);
  }
```

- [ ] **Step 8: Test toàn bộ + build backend**

Run: `npm test` — Expected: PASS toàn bộ (permissions 2, room-access 12, rooms 34).
Run: `npm run build` — Expected: không lỗi.

- [ ] **Step 9: Frontend — types + service**

Thêm vào cuối `frontend/src/types/room.ts`:
```ts
export type ImportRowStatus = 'OK' | 'INVALID_EMAIL' | 'DUPLICATE_IN_FILE' | 'NOT_REGISTERED' | 'ALREADY_MEMBER';

export interface ImportRow {
  row: number;
  email: string;
  status: ImportRowStatus;
}

export interface ImportResult {
  rows: ImportRow[];
  addedCount: number;
}
```

Trong `frontend/src/services/room.service.ts`, đổi dòng import types thành:
```ts
import type { ImportResult, Room, RoomListResponse, RoomMember } from '@/types/room';
```
Thêm vào cuối file:
```ts
// dryRun = true: backend chỉ kiểm tra từng dòng (bước review), chưa thêm ai
export const importMembers = (token: string, roomId: string, emails: string[], dryRun: boolean) =>
  request<ImportResult>(token, `/rooms/${roomId}/members/import`, {
    method: 'POST',
    body: JSON.stringify({ emails, dryRun }),
  });

// Export trả file CSV, không phải JSON → không dùng request()
export async function exportMembersCsv(token: string, roomId: string): Promise<Blob> {
  const res = await fetch(`${API_URL}/rooms/${roomId}/members/export`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Xuất danh sách thất bại');
  return res.blob();
}
```

- [ ] **Step 10: Frontend — dialog import**

`frontend/src/features/rooms/ImportMembersDialog.tsx`:
```tsx
'use client';

import { useState } from 'react';
import { importMembers } from '@/services/room.service';
import type { ImportRow, ImportRowStatus } from '@/types/room';

const MAX_ROWS = 200;

const STATUS_LABEL: Record<ImportRowStatus, string> = {
  OK: 'Sẽ thêm',
  INVALID_EMAIL: 'Email không hợp lệ',
  DUPLICATE_IN_FILE: 'Trùng trong file',
  NOT_REGISTERED: 'Chưa có tài khoản',
  ALREADY_MEMBER: 'Đã là thành viên',
};

// Lấy cột đầu tiên mỗi dòng; bỏ BOM, dấu ", dòng trống và dòng tiêu đề "email"
function parseEmailFile(text: string): string[] {
  const emails = text
    .replace(/^﻿/, '')
    .split(/\r?\n/)
    .map((line) => line.split(',')[0].replace(/"/g, '').trim())
    .filter(Boolean);
  if (emails[0]?.toLowerCase() === 'email') emails.shift();
  return emails;
}

interface Props {
  token: string;
  roomId: string;
  onClose: () => void;
  onImported: (addedCount: number) => void;
}

// Dialog import thành viên (GVHD §13): ghi rõ định dạng → chọn file → review từng dòng → xác nhận
export function ImportMembersDialog({ token, roomId, onClose, onImported }: Props) {
  const [emails, setEmails] = useState<string[]>([]);
  const [rows, setRows] = useState<ImportRow[] | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const handleFile = async (file: File) => {
    setError('');
    setRows(null);
    const parsed = parseEmailFile(await file.text());
    if (parsed.length === 0) {
      setError('File không có email nào');
      return;
    }
    if (parsed.length > MAX_ROWS) {
      setError(`Tối đa ${MAX_ROWS} dòng, file có ${parsed.length} dòng`);
      return;
    }
    setBusy(true);
    try {
      // Bước review: backend chỉ kiểm tra, chưa thêm ai
      const result = await importMembers(token, roomId, parsed, true);
      setEmails(parsed);
      setRows(result.rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kiểm tra file thất bại');
    } finally {
      setBusy(false);
    }
  };

  const handleConfirm = async () => {
    setBusy(true);
    try {
      const result = await importMembers(token, roomId, emails, false);
      onImported(result.addedCount);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import thất bại');
      setBusy(false);
    }
  };

  const okCount = rows?.filter((r) => r.status === 'OK').length ?? 0;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold text-gray-900">Import thành viên</h2>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-900 space-y-1">
          <p className="font-semibold">Định dạng file</p>
          <p>• File .csv hoặc .txt, mỗi dòng một email (chỉ đọc cột đầu tiên).</p>
          <p>• Dòng đầu có thể là tiêu đề &quot;email&quot;. Tối đa {MAX_ROWS} dòng.</p>
          <p>• Chỉ thêm được người đã có tài khoản. File tải về từ nút &quot;Export CSV&quot; dùng lại được.</p>
          <pre className="font-mono text-xs bg-white rounded p-2 mt-2">{'email\nan@example.com\nbinh@example.com'}</pre>
        </div>

        <input
          type="file"
          accept=".csv,.txt"
          disabled={busy}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        )}

        {rows && (
          <>
            <p className="text-sm text-gray-700">
              {okCount} / {rows.length} dòng sẽ được thêm.
            </p>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500">
                  <th className="py-1">Dòng</th>
                  <th>Email</th>
                  <th>Kết quả</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.row} className="border-t border-gray-200">
                    <td className="py-1">{r.row}</td>
                    <td className="break-all">{r.email}</td>
                    <td className={r.status === 'OK' ? 'text-green-700' : 'text-red-600'}>{STATUS_LABEL[r.status]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        <div className="flex justify-end gap-3">
          <button onClick={onClose} disabled={busy} className="text-gray-600 px-4 py-2">
            Huỷ
          </button>
          <button
            onClick={handleConfirm}
            disabled={busy || okCount === 0}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg disabled:opacity-50"
          >
            Xác nhận thêm {okCount} người
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 11: Gắn vào trang chi tiết phòng**

Trong `frontend/app/rooms/[roomId]/page.tsx`:

Thêm `exportMembersCsv` vào import từ `@/services/room.service`, và thêm:
```ts
import { ImportMembersDialog } from '@/features/rooms/ImportMembersDialog';
```
Thêm state dưới `description`:
```ts
  const [importing, setImporting] = useState(false);
```
Thêm hàm dưới `reload`:
```ts
  // Tải file CSV thành viên về máy
  const handleExport = () =>
    run(
      async () => {
        const blob = await exportMembersCsv(token!, roomId);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `thanh-vien-${room?.joinCode ?? roomId}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      },
      () => {},
    );
```
Trong khối "Thành viên", đổi dòng tiêu đề `<h2 ...>Thành viên ({members.length})</h2>` thành:
```tsx
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-lg font-semibold text-gray-900">Thành viên ({members.length})</h2>
            {isHost && (
              <div className="flex gap-4">
                <button onClick={() => setImporting(true)} className="text-blue-600 hover:text-blue-700 font-semibold">
                  Import
                </button>
                <button onClick={handleExport} className="text-blue-600 hover:text-blue-700 font-semibold">
                  Export CSV
                </button>
              </div>
            )}
          </div>
```
Thêm ngay trước thẻ `</div>` đóng ngoài cùng của component (cuối JSX):
```tsx
      {importing && (
        <ImportMembersDialog
          token={token}
          roomId={roomId}
          onClose={() => setImporting(false)}
          onImported={(addedCount) => {
            setImporting(false);
            setNotice(`Đã thêm ${addedCount} thành viên`);
            reload();
          }}
        />
      )}
```

- [ ] **Step 12: Lint + build frontend**

Run (PowerShell, trong `frontend`): `npm run lint` — Expected: không lỗi ở file vừa tạo/sửa.
Run: `npm run build` — Expected: build xong.

- [ ] **Step 13: Tài liệu — thêm vào mục `## Rooms`**

```markdown
### POST /rooms/:roomId/members/import  `[GVHD-verbal]` (§13)
Import thành viên theo email. Quyền: HOST. Rate limit 10 lần/phút/user (`ratelimit:import:{userId}`).

| Body | Kiểu | Ràng buộc |
|---|---|---|
| emails | string[] | 1–200 phần tử, mỗi phần tử ≤ 320 ký tự |
| dryRun | boolean | `true` = chỉ kiểm (bước review), `false` = thêm thật |

Response `200`: `{ rows: [{ row, email, status }], addedCount }`.
`status` ∈ `OK` (sẽ thêm) · `INVALID_EMAIL` · `DUPLICATE_IN_FILE` · `NOT_REGISTERED` · `ALREADY_MEMBER`.
Import lại cùng danh sách không tạo bản ghi thứ hai (upsert theo unique `{roomId, userId}`).

Định dạng file (frontend đọc rồi gửi mảng email): `.csv`/`.txt`, mỗi dòng một email ở cột đầu, dòng đầu có thể là `email`.

### GET /rooms/:roomId/members/export
Tải CSV thành viên. Quyền: HOST.
Response `200` `text/csv` (UTF-8 có BOM): `email,displayName,role,joinedAt`. File này import lại được.
```

- [ ] **Step 14: Commit (khi user cho phép)**

```bash
git add backend/src/modules/rooms frontend/src/types/room.ts frontend/src/services/room.service.ts frontend/src/features/rooms frontend/app/rooms docs/api/endpoint.md docs/progress.md
git commit -m "feat: import/export thành viên phòng có bước review"
```

---

### Task 10a: `fix` — field tham chiếu trong schema đang là Mixed, không phải ObjectId `[phát sinh kỹ thuật]` (thêm 2026-10-01)

> Tìm ra ở Task 10 Step 2 (lần đầu chạy app thật). User chốt 2026-10-01: dừng Task 10, sửa ở phiên riêng, xong mới làm lại Task 10. Chi tiết bằng chứng: `docs/progress.md` mục "2026-10-01 — Module room: Task 10".

**Lỗi:** `@Prop({ type: Types.ObjectId })` → `@nestjs/mongoose` 12 (`dist/factories/definitions.factory.js`, `inspectTypeDefinition`) coi class BSON `ObjectId` là "class schema lồng nhau" (`isMongooseSchemaType` = false, khớp `/^class\s/`) → `createForClass(ObjectId)` = `{}` → path kiểu **Mixed** → không ép kiểu: `userId`/`ownerId` truyền string bị lưu string; query bằng `roomId` string không khớp ObjectId đã lưu. `@Prop({ type: Schema.Types.ObjectId })` → `ObjectId` (đã thử). Unit test không bắt được vì model bị mock.

**Phạm vi:** 23 field / 9 file — chốt lại với user đầu phiên (cả 9 file hay chỉ module room). (Lúc hỏi user 2026-10-01 nói nhầm "8 file".)
`ai-assistant/schemas/ai-request.schema.ts` (3), `auth/schemas/refresh-token.schema.ts` (1), `chat/schemas/message.schema.ts` (4), `meetings/schemas/meeting-participant.schema.ts` (2), `meetings/schemas/meeting.schema.ts` (3), `room-members/schemas/room-member.schema.ts` (3), `rooms/schemas/file.schema.ts` (3), `rooms/schemas/room.schema.ts` (1), `whiteboard/schemas/whiteboard.schema.ts` (3). Lệnh liệt kê: `grep -rn "type: *\[*Types\.ObjectId" backend/src`.

**Đã chốt (2026-10-01):**
- Sửa: chỉ đổi `type: Types.ObjectId` → `type: Schema.Types.ObjectId` (import `Schema` từ `mongoose` — trùng tên decorator `Schema` của `@nestjs/mongoose`, đặt alias, vd `import { Schema as MongooseSchema, Types } from 'mongoose'`). Kiểu TS của field giữ `Types.ObjectId`.
- Dữ liệu dev (Docker): sau khi sửa schema, **xoá** `rooms`, `room_members`, `refresh_tokens` (`deleteMany({})`) — dữ liệu thử lưu sai kiểu (lúc tìm ra: 1 room, 2 room_members, 3 refresh_tokens). Giữ `users`; ai đang đăng nhập phải đăng nhập lại.
- Test: **không** thêm spec schema (CLAUDE.md). Bước tái hiện = smoke test Task 10 Step 2 (đang fail) → sửa → chạy lại phải đúng từng dòng. Kiểm thêm: `RoomMemberSchema.path('userId').instance === 'ObjectId'` bằng lệnh `node` đồ bỏ trên `dist/`.

**Kiểm sau khi sửa:** `npm test`, `npm run build`; `docker compose up -d --build`; smoke test Step 2; mongosh đếm `{ userId: { $type: 'string' } }` = 0 trên `room_members` sau smoke test.

> **Đã làm 2026-10-01** (chi tiết: `docs/progress.md` mục "Task 10a"). User chốt phạm vi: **cả 9 file**. Lệch so với mục "Đã chốt": dùng `SchemaTypes.ObjectId` (named export của mongoose, `=== Schema.Types`) thay cho alias `Schema as MongooseSchema` — cùng hành vi, không trùng tên decorator. Thêm: sửa 23 mẫu code trong `docs/database/DB_DESIGN.md` + 1 ghi chú đầu Phần C. **Chưa xoá** dữ liệu dev (auto-mode chặn `deleteMany`) → user tự xoá; kiểm mongosh làm trên bản ghi của phòng mới tạo thay vì đếm cả collection.

### Task 10: Chạy thật qua Docker + chốt tài liệu

> **Dừng giữa chừng 2026-10-01** ở Step 2 (lỗi schema → Task 10a). Đã làm: Step 1 đạt sau khi sửa `rooms.module.ts` (thêm `PassportModule.register({ session: false })` — trước đó app không khởi động); sửa script Step 2 (`$hAuth`/`$mAuth`). Làm lại từ Step 1 sau Task 10a.
> **Làm lại 2026-10-01 — xong** (Step 1–2 đạt, Step 3 user test tay báo ok, trừ đăng nhập Google vì chưa có credentials). Phát sinh: sửa form đăng ký gửi `displayName`. Chi tiết: `docs/progress.md`.
> Sau 10a (2026-10-01): Step 2 đã chạy lại đúng 9/9 dòng trên container đã sửa. Đầu phiên kiểm dữ liệu dev đã xoá chưa (`rooms`, `room_members`, `refresh_tokens` có `$type: 'string'` = 0) — 10a không xoá được.

> Progress trước ghi "app chưa boot qua docker compose". Task này là lần đầu chạy module room trên app thật — kết quả dán vào progress, không nói "chạy được" khi chưa chạy.

**Files:**
- Modify: `docs/progress.md`
- Modify: `docs/api/endpoint.md` (chỉ nếu phát hiện lệch khi chạy)

- [ ] **Step 1: Khởi động**

Run (PowerShell, ở gốc repo — **không** chạy song song `npm run start:dev`, ADR-016):
```powershell
docker compose up -d --build
docker compose logs backend --tail 50
```
Expected: log có `Redis connected` và `Nest application successfully started`, có dòng map route `/rooms`.

- [ ] **Step 2: Smoke test API**

Run (PowerShell, ở gốc repo):
```powershell
$api = 'http://localhost:3001'
$n = Get-Random
# 2 user: $h làm HOST, $m làm MEMBER ($host là biến có sẵn của PowerShell, không dùng)
# Header đặt tên $hAuth/$mAuth: biến PowerShell KHÔNG phân biệt hoa thường → $H sẽ ghi đè $h (sửa 2026-10-01, Task 10)
$h = Invoke-RestMethod -Method Post "$api/auth/register" -ContentType 'application/json' -Body (@{ email = "h$n@test.com"; username = "h$n"; displayName = 'Host'; password = '123456' } | ConvertTo-Json)
$m = Invoke-RestMethod -Method Post "$api/auth/register" -ContentType 'application/json' -Body (@{ email = "m$n@test.com"; username = "m$n"; displayName = 'Member'; password = '123456' } | ConvertTo-Json)
$hAuth = @{ Authorization = "Bearer $($h.accessToken)" }
$mAuth = @{ Authorization = "Bearer $($m.accessToken)" }

$room = Invoke-RestMethod -Method Post "$api/rooms" -Headers $hAuth -ContentType 'application/json' -Body '{"name":"Nhom test"}'
$room                                                                  # có id, joinCode 8 ký tự, myRole HOST
Invoke-RestMethod -Method Post "$api/rooms/join" -Headers $mAuth -ContentType 'application/json' -Body (@{ code = $room.joinCode.ToLower() } | ConvertTo-Json)   # myRole MEMBER
Invoke-RestMethod "$api/rooms" -Headers $mAuth                         # items có phòng vừa vào
Invoke-RestMethod "$api/rooms/$($room.id)/members" -Headers $hAuth     # HOST đứng đầu
try { Invoke-RestMethod -Method Post "$api/rooms/$($room.id)/dissolve" -Headers $mAuth } catch { $_.Exception.Response.StatusCode }   # Forbidden
Invoke-RestMethod -Method Delete "$api/rooms/$($room.id)/members/$($m.user.id)" -Headers $hAuth   # kick
try { Invoke-RestMethod "$api/rooms/$($room.id)" -Headers $mAuth } catch { $_.Exception.Response.StatusCode }   # Forbidden (đã bị kick)
Invoke-RestMethod -Method Post "$api/rooms/$($room.id)/dissolve" -Headers $hAuth
try { Invoke-RestMethod "$api/rooms/$($room.id)" -Headers $hAuth } catch { $_.Exception.Response.StatusCode }   # NotFound
```
Expected: mỗi dòng ra đúng như comment. Dòng nào khác → dừng, dùng superpowers:systematic-debugging.

- [ ] **Step 3: Chạy tay frontend**

Run (PowerShell): `Set-Location frontend; npm run dev`
Kiểm bằng trình duyệt ở `http://localhost:3000`:
1. Đăng nhập user A → Dashboard → "Phòng của tôi" → tạo phòng → sang trang chi tiết, thấy mã + link.
2. Cửa sổ ẩn danh, **chưa đăng nhập**, mở link `/join/<mã>` → bị chuyển sang `/login?returnUrl=...` → đăng nhập user B → tự vào phòng.
3. User A: thấy B trong danh sách, nút "Mời ra" → B biến mất. User B không thấy nút Sửa / Giải tán / ô "Thêm" thành viên.
4. User A: nhập email của B vào ô "Thêm" → B xuất hiện lại trong danh sách. Nhập lại email đó → báo "Người này đã ở trong phòng". Nhập email chưa đăng ký → báo "Email này chưa đăng ký tài khoản". (Sửa 2026-09-28: Task 8 import/export hoãn, thay bằng kiểm Task 8a.)
5. User A: Giải tán → quay về `/rooms`, phòng không còn trong danh sách.

- [ ] **Step 4: Cập nhật `docs/progress.md`**

Trong mục "2026-09-26 — Module room" ghi:
- Task 1–10 xong, commit từng task (hoặc "chưa commit").
- Output `npm test` (số test pass) và kết quả smoke test Step 2 (dán nguyên).
- **Lệch khỏi tài liệu:** frontend không import bảng quyền `shared/` (dùng `myRole`) — lệch §15 tạm thời, chuyển sang bảng dùng chung khi đưa frontend vào Docker (build context gốc repo).
- **Sửa ngoài phạm vi room nhưng cần cho luồng join:** callback Google đổi sang `window.location.replace` (trước đó token không được AuthProvider đọc sau khi chuyển trang); login đọc `returnUrl`.
- **Để lại task sau:** thu hồi socket khi kick/rời (chat gateway, `TODO(chat gateway)` trong `rooms.service.ts`); kết thúc meeting khi giải tán (`TODO(module meeting)`); mời qua email (spec §6).
- Bảng "Code hiện có" đầu file: đổi dòng Rooms/room-members thành "Rooms: REST đầy đủ + frontend; chưa có realtime".

- [ ] **Step 5: Commit (khi user cho phép)**

```bash
git add docs/progress.md docs/api/endpoint.md
git commit -m "docs: cập nhật progress module room"
```
