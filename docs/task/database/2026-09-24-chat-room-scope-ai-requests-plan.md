# Chat thuộc Room + `ai_requests` — Implementation Plan (S1)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Đổi `messages` sang "chat thuộc room, meetingId là tag", thêm collection `ai_requests`, và viết 2 hàm kiểm tra quyền dùng chung `assertRoomAccess` / `assertMeetingTag` (có test) — phần nền cho task chat gateway sau này.

**Architecture:** Sửa schema tại chỗ. Hai hàm kiểm tra quyền nằm trong một service nhỏ `RoomAccessService` ở module `room-members` (module sở hữu membership), đọc Mongo + Redis presence. Không có gateway / REST trong plan này.

**Tech Stack:** NestJS · ESM · Mongoose 9 · redis 4.7 (`sIsMember` trả `boolean`) · vitest 4

**Spec:** `docs/task/database/2026-09-23-chat-room-scope-ai-requests-design.md`

## Global Constraints

- Import tương đối kết thúc bằng `.js` (ESM).
- Lệnh `npm` / `npx` chạy bằng **PowerShell**, trong thư mục `backend`.
- Không thêm dependency.
- Không `Map`/`Set`/biến module giữ state theo user/room.
- Ghi chú code ngắn, tiếng Việt, dễ hiểu.
- Commit: `<type>: <mô tả>`, type ∈ `feat fix refactor test docs chore`, kết thúc bằng `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Không đụng `MeetingMode` — đã tách sang `docs/task/database/remove_meeting_mode.md` (session khác).
- `docs/task/` bị `.gitignore` — spec và plan này **không commit**, đúng ý user.

---

## File map

| File | Việc |
|---|---|
| `backend/src/modules/chat/schemas/message.schema.ts` | Sửa `meetingId` + index |
| `backend/src/shared/enums.ts` | Thêm `AiRequestKind`, `AiRequestStatus` |
| `backend/src/modules/ai-assistant/schemas/ai-request.schema.ts` | **Tạo** |
| `backend/src/modules/ai-assistant/ai-assistant.module.ts` | **Tạo** — đăng ký schema |
| `backend/src/app.module.ts` | Import `AiAssistantModule`, `RedisModule` |
| `backend/src/common/services/redis.service.ts` | Thêm `sismember` |
| `backend/src/common/redis.module.ts` | **Tạo** — `@Global` để module khác inject được `RedisService` (xem ghi chú Task 3) |
| `backend/src/modules/room-members/room-access.service.ts` | **Tạo** |
| `backend/src/modules/room-members/room-access.service.spec.ts` | **Tạo** — test |
| `backend/src/modules/room-members/room-members.module.ts` | Đăng ký Room, Meeting model + provider |
| `docs/...` | Task 4 |

---

### Task 1: Schema `messages` — chat thuộc room

**Files:**
- Modify: `backend/src/modules/chat/schemas/message.schema.ts`

**Interfaces:**
- Produces: `Message.meetingId: Types.ObjectId | null` (mặc định `null`), `Message.roomId` bắt buộc.

Schema thuần → không viết test (CLAUDE.md).

- [ ] **Step 1: Sửa field `meetingId` và `roomId`**

Thay đoạn:

```ts
  @Prop({ type: Types.ObjectId, ref: 'Meeting', required: true, index: true })
  meetingId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Room', required: true })
  roomId!: Types.ObjectId;
```

bằng:

```ts
  // Chat thuộc về room — đây là khoá sở hữu chính
  @Prop({ type: Types.ObjectId, ref: 'Room', required: true })
  roomId!: Types.ObjectId;

  // Tag meeting: chỉ server gắn khi tin được gửi từ khung chat trong họp, còn lại null
  @Prop({ type: Types.ObjectId, ref: 'Meeting', default: null })
  meetingId?: Types.ObjectId | null;
```

- [ ] **Step 2: Thay 3 dòng index cuối file**

Thay:

```ts
MessageSchema.index({ meetingId: 1, createdAt: -1 });
MessageSchema.index({ meetingId: 1, clientMsgId: 1 }, { unique: true });
MessageSchema.index({ roomId: 1, createdAt: -1 });
```

bằng:

```ts
// Luồng chat của room — query dùng nhiều nhất
MessageSchema.index({ roomId: 1, createdAt: -1 });
// Chống gửi trùng khi client reconnect gửi lại
MessageSchema.index({ roomId: 1, clientMsgId: 1 }, { unique: true });
// Khung chat trong meeting — chỉ index tin có tag meeting
MessageSchema.index(
  { meetingId: 1, createdAt: -1 },
  { partialFilterExpression: { meetingId: { $type: 'objectId' } } },
);
```

- [ ] **Step 3: Build**

Run (PowerShell, trong `backend`): `npm run build`
Expected: build xong, không lỗi TypeScript.

- [ ] **Step 4: Commit**

```bash
git add backend/src/modules/chat/schemas/message.schema.ts
git commit -m "feat: messages thuộc room, meetingId thành tag tuỳ chọn"
```

> Lưu ý deploy: nếu DB dev đã có index cũ `meetingId_1_clientMsgId_1` thì phải drop tay (`db.messages.dropIndex('meetingId_1_clientMsgId_1')`), Mongoose không tự xoá index cũ.

---

### Task 2: Enum + schema `ai_requests`

**Files:**
- Modify: `backend/src/shared/enums.ts`
- Create: `backend/src/modules/ai-assistant/schemas/ai-request.schema.ts`
- Create: `backend/src/modules/ai-assistant/ai-assistant.module.ts`
- Modify: `backend/src/app.module.ts`

**Interfaces:**
- Produces: `enum AiRequestKind`, `enum AiRequestStatus` (từ `shared/enums.js`); class `AiRequest`, `AiRequestSchema`, type `AiRequestDocument`; `AiAssistantModule`.

Schema thuần → không test.

- [ ] **Step 1: Thêm enum vào cuối `backend/src/shared/enums.ts`**

```ts
// Loại nội dung AI sinh ra (đề cương §4.2)
export enum AiRequestKind {
  DIAGRAM = 'DIAGRAM',
  MINDMAP = 'MINDMAP',
  FLOWCHART = 'FLOWCHART',
}

// Kết quả một lần gọi AI — dùng để thống kê trong báo cáo (đề cương §5.9)
export enum AiRequestStatus {
  SUCCESS = 'SUCCESS',
  PROVIDER_ERROR = 'PROVIDER_ERROR',
  INVALID_OUTPUT = 'INVALID_OUTPUT', // output AI không qua validate
  TIMEOUT = 'TIMEOUT',
  RATE_LIMITED = 'RATE_LIMITED',
}
```

- [ ] **Step 2: Tạo `backend/src/modules/ai-assistant/schemas/ai-request.schema.ts`**

```ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { AiRequestKind, AiRequestStatus } from '../../../shared/enums.js';

export type AiRequestDocument = AiRequest & Document;

// Log mỗi lần gọi AI. Chỉ insert một lần khi request kết thúc, không update.
@Schema({ timestamps: { createdAt: true, updatedAt: false }, collection: 'ai_requests' })
export class AiRequest {
  // Do client sinh trong ai:generate — chống ghi trùng khi gửi lại
  @Prop({ required: true, maxlength: 64 })
  requestId!: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Room', required: true })
  roomId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Meeting', required: true })
  meetingId!: Types.ObjectId;

  @Prop({ type: String, enum: AiRequestKind, required: true })
  kind!: AiRequestKind;

  // Service cắt còn 1000 ký tự trước khi lưu
  @Prop({ required: true, maxlength: 1000 })
  prompt!: string;

  @Prop({ type: String, enum: AiRequestStatus, required: true })
  status!: AiRequestStatus;

  // Mã lỗi ngắn, không lưu stack trace
  @Prop({ type: String, default: null, maxlength: 64 })
  errorCode?: string | null;

  @Prop({ required: true, min: 0 })
  latencyMs!: number;

  @Prop({ required: true })
  model!: string;

  // null nếu provider không trả số token
  @Prop({ type: Number, default: null })
  inputTokens?: number | null;

  @Prop({ type: Number, default: null })
  outputTokens?: number | null;

  // Số element sinh ra; 0 nếu thất bại
  @Prop({ default: 0, min: 0 })
  elementCount?: number;
}

export const AiRequestSchema = SchemaFactory.createForClass(AiRequest);

AiRequestSchema.index({ createdAt: -1 });
AiRequestSchema.index({ meetingId: 1, createdAt: -1 });
AiRequestSchema.index({ status: 1, createdAt: -1 });
AiRequestSchema.index({ userId: 1, requestId: 1 }, { unique: true });
```

- [ ] **Step 3: Tạo `backend/src/modules/ai-assistant/ai-assistant.module.ts`**

```ts
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AiRequest, AiRequestSchema } from './schemas/ai-request.schema.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AiRequest.name, schema: AiRequestSchema },
    ]),
  ],
})
export class AiAssistantModule {}
```

- [ ] **Step 4: Đăng ký trong `backend/src/app.module.ts`**

Thêm import sau dòng `RealtimeModule`:

```ts
import { AiAssistantModule } from './modules/ai-assistant/ai-assistant.module.js';
```

và thêm `AiAssistantModule,` vào mảng `imports` ngay sau `RealtimeModule,`.

- [ ] **Step 5: Build**

Run (PowerShell, trong `backend`): `npm run build`
Expected: không lỗi.

- [ ] **Step 6: Commit**

```bash
git add backend/src/shared/enums.ts backend/src/modules/ai-assistant backend/src/app.module.ts
git commit -m "feat: thêm collection ai_requests để đo trợ lý AI"
```

---

### Task 3: `RoomAccessService` — `assertRoomAccess` + `assertMeetingTag` (TDD)

**Files:**
- Modify: `backend/src/common/services/redis.service.ts`
- Create: `backend/src/common/redis.module.ts`
- Modify: `backend/src/app.module.ts`
- Create: `backend/src/modules/room-members/room-access.service.ts`
- Test: `backend/src/modules/room-members/room-access.service.spec.ts`
- Modify: `backend/src/modules/room-members/room-members.module.ts`

**Interfaces:**
- Consumes: `RoomStatus`, `MeetingStatus` từ `shared/enums.js`; model `Room`, `RoomMember`, `Meeting`.
- Produces (task chat sau này dùng):
  - `RoomAccessService.assertRoomAccess(userId: string, roomId: string): Promise<RoomMember>` — ném `BadRequestException` (400) / `NotFoundException` (404) / `ForbiddenException` (403)
  - `RoomAccessService.assertMeetingTag(userId: string, roomId: string, meetingId: string): Promise<void>` — ném `BadRequestException` (400, sai định dạng id) / `ForbiddenException` (403)
  - `RedisService.sismember(key: string, member: string): Promise<boolean>`
  - `RoomAccessService` được export từ `RoomMembersModule`

> **Vì sao cần `RedisModule`:** hiện `RedisService` chỉ khai báo trong `providers` của `AppModule`, nên module con (`RoomMembersModule`) **không inject được**. Khai báo lại trong module con sẽ mở thêm một kết nối Redis mỗi module. Một module `@Global` 8 dòng là cách nhỏ nhất để dùng chung một kết nối.
>
> **Lệch nhỏ so với spec:** spec ghi "sai bất kỳ → 403" cho `assertMeetingTag`; plan thêm kiểm tra định dạng `meetingId` → 400 (giống `assertRoomAccess`), vì id sai định dạng sẽ làm Mongoose ném CastError thành 500. Ghi vào Changelog của spec ở Task 4.

- [ ] **Step 1: Thêm `sismember` vào `RedisService`** (sau hàm `srem`)

```ts
  // Kiểm tra member có trong Set không (dùng cho presence:{meetingId})
  async sismember(key: string, member: string): Promise<boolean> {
    return this.client.sIsMember(key, member);
  }
```

- [ ] **Step 2: Tạo `backend/src/common/redis.module.ts`**

```ts
import { Global, Module } from '@nestjs/common';
import { RedisService } from './services/redis.service.js';

// Global để mọi module inject RedisService mà dùng chung một kết nối
@Global()
@Module({
  providers: [RedisService],
  exports: [RedisService],
})
export class RedisModule {}
```

- [ ] **Step 3: Sửa `backend/src/app.module.ts`**

- Thay dòng `import { RedisService } from './common/services/redis.service.js';` bằng `import { RedisModule } from './common/redis.module.js';`
- Thêm `RedisModule,` vào mảng `imports` ngay sau `ConfigModule.forRoot({ isGlobal: true }),`
- Xoá hai dòng `providers: [RedisService],` và `exports: [RedisService],`

- [ ] **Step 4: Viết test fail — `backend/src/modules/room-members/room-access.service.spec.ts`**

```ts
import { describe, it, expect, vi } from 'vitest';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { RoomAccessService } from './room-access.service.js';
import { MeetingStatus, RoomStatus } from '../../shared/enums.js';

// Giả lập chuỗi Mongoose: model.findOne(filter).lean().exec() → result
function mockModel(result: unknown) {
  const exec = vi.fn().mockResolvedValue(result);
  const findOne = vi.fn().mockReturnValue({ lean: () => ({ exec }) });
  return { findOne };
}

function mockRedis(isMember: boolean) {
  return { sismember: vi.fn().mockResolvedValue(isMember) };
}

const userId = new Types.ObjectId().toString();
const roomId = new Types.ObjectId().toString();
const meetingId = new Types.ObjectId().toString();

function build(opts: { room?: unknown; member?: unknown; meeting?: unknown; online?: boolean }) {
  const roomModel = mockModel(opts.room ?? null);
  const memberModel = mockModel(opts.member ?? null);
  const meetingModel = mockModel(opts.meeting ?? null);
  const redis = mockRedis(opts.online ?? false);
  const service = new RoomAccessService(
    roomModel as any,
    memberModel as any,
    meetingModel as any,
    redis as any,
  );
  return { service, roomModel, memberModel, meetingModel, redis };
}

describe('assertRoomAccess', () => {
  it('roomId sai định dạng → 400, không query DB', async () => {
    const { service, roomModel } = build({});
    await expect(service.assertRoomAccess(userId, 'abc')).rejects.toBeInstanceOf(BadRequestException);
    expect(roomModel.findOne).not.toHaveBeenCalled();
  });

  it('room không tồn tại / DISSOLVED / đã xoá → 404 (lọc ngay trong query)', async () => {
    const { service, roomModel } = build({ room: null });
    await expect(service.assertRoomAccess(userId, roomId)).rejects.toBeInstanceOf(NotFoundException);
    expect(roomModel.findOne).toHaveBeenCalledWith({
      _id: roomId,
      status: RoomStatus.ACTIVE,
      deletedAt: null,
    });
  });

  it('không phải thành viên hoặc bị ban → 403 (lọc ngay trong query)', async () => {
    const { service, memberModel } = build({ room: { _id: roomId }, member: null });
    await expect(service.assertRoomAccess(userId, roomId)).rejects.toBeInstanceOf(ForbiddenException);
    expect(memberModel.findOne).toHaveBeenCalledWith({ roomId, userId, isBanned: false });
  });

  it('hợp lệ → trả về membership', async () => {
    const member = { roomId, userId, role: 'MEMBER' };
    const { service } = build({ room: { _id: roomId }, member });
    await expect(service.assertRoomAccess(userId, roomId)).resolves.toEqual(member);
  });
});

describe('assertMeetingTag', () => {
  it('meetingId sai định dạng → 400', async () => {
    const { service, meetingModel } = build({});
    await expect(service.assertMeetingTag(userId, roomId, 'xyz')).rejects.toBeInstanceOf(BadRequestException);
    expect(meetingModel.findOne).not.toHaveBeenCalled();
  });

  it('meeting không tồn tại / ENDED / thuộc room khác → 403 (lọc ngay trong query)', async () => {
    const { service, meetingModel, redis } = build({ meeting: null });
    await expect(service.assertMeetingTag(userId, roomId, meetingId)).rejects.toBeInstanceOf(ForbiddenException);
    expect(meetingModel.findOne).toHaveBeenCalledWith({
      _id: meetingId,
      roomId,
      status: MeetingStatus.ACTIVE,
    });
    expect(redis.sismember).not.toHaveBeenCalled();
  });

  it('user không có trong presence của meeting → 403', async () => {
    const { service, redis } = build({ meeting: { _id: meetingId }, online: false });
    await expect(service.assertMeetingTag(userId, roomId, meetingId)).rejects.toBeInstanceOf(ForbiddenException);
    expect(redis.sismember).toHaveBeenCalledWith(`presence:${meetingId}`, userId);
  });

  it('hợp lệ → không ném lỗi', async () => {
    const { service } = build({ meeting: { _id: meetingId }, online: true });
    await expect(service.assertMeetingTag(userId, roomId, meetingId)).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 5: Chạy test, xác nhận fail**

Run (PowerShell, trong `backend`): `npx vitest run src/modules/room-members/room-access.service.spec.ts`
Expected: FAIL — không resolve được `./room-access.service.js`.

- [ ] **Step 6: Viết `backend/src/modules/room-members/room-access.service.ts`**

```ts
import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Room } from '../rooms/schemas/room.schema.js';
import type { RoomDocument } from '../rooms/schemas/room.schema.js';
import { RoomMember } from './schemas/room-member.schema.js';
import type { RoomMemberDocument } from './schemas/room-member.schema.js';
import { Meeting } from '../meetings/schemas/meeting.schema.js';
import type { MeetingDocument } from '../meetings/schemas/meeting.schema.js';
import { RedisService } from '../../common/services/redis.service.js';
import { MeetingStatus, RoomStatus } from '../../shared/enums.js';

// Kiểm tra quyền dùng chung cho room:subscribe, chat:send, REST lịch sử chat.
// Luôn đọc Mongo/Redis, không cache — để user vừa bị kick ở instance khác cũng bị chặn ngay.
@Injectable()
export class RoomAccessService {
  constructor(
    @InjectModel(Room.name) private roomModel: Model<RoomDocument>,
    @InjectModel(RoomMember.name) private memberModel: Model<RoomMemberDocument>,
    @InjectModel(Meeting.name) private meetingModel: Model<MeetingDocument>,
    private redis: RedisService,
  ) {}

  // User phải là thành viên (không bị ban) của một room còn hoạt động
  async assertRoomAccess(userId: string, roomId: string) {
    if (!Types.ObjectId.isValid(roomId)) {
      throw new BadRequestException('roomId không hợp lệ');
    }

    // Room đã giải tán hoặc đã xoá coi như không tồn tại
    const room = await this.roomModel
      .findOne({ _id: roomId, status: RoomStatus.ACTIVE, deletedAt: null })
      .lean()
      .exec();
    if (!room) {
      throw new NotFoundException('Room không tồn tại');
    }

    const member = await this.memberModel
      .findOne({ roomId, userId, isBanned: false })
      .lean()
      .exec();
    if (!member) {
      throw new ForbiddenException('Bạn không phải thành viên room này');
    }

    return member;
  }

  // Chỉ cho gắn tag meeting khi meeting đang diễn ra, thuộc đúng room, và user đang ở trong meeting
  async assertMeetingTag(userId: string, roomId: string, meetingId: string) {
    if (!Types.ObjectId.isValid(meetingId)) {
      throw new BadRequestException('meetingId không hợp lệ');
    }

    const meeting = await this.meetingModel
      .findOne({ _id: meetingId, roomId, status: MeetingStatus.ACTIVE })
      .lean()
      .exec();
    if (!meeting) {
      throw new ForbiddenException('Meeting không hợp lệ');
    }

    // presence:{meetingId} là Set userId đang online trong meeting (DB_DESIGN phần E)
    const online = await this.redis.sismember(`presence:${meetingId}`, userId);
    if (!online) {
      throw new ForbiddenException('Bạn không ở trong meeting này');
    }
  }
}
```

- [ ] **Step 7: Chạy test, xác nhận pass**

Run: `npx vitest run src/modules/room-members/room-access.service.spec.ts`
Expected: 8 test PASS.

- [ ] **Step 8: Đăng ký trong `backend/src/modules/room-members/room-members.module.ts`**

```ts
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { RoomMember, RoomMemberSchema } from './schemas/room-member.schema.js';
import { Room, RoomSchema } from '../rooms/schemas/room.schema.js';
import { Meeting, MeetingSchema } from '../meetings/schemas/meeting.schema.js';
import { RoomAccessService } from './room-access.service.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: RoomMember.name, schema: RoomMemberSchema },
      // Room và Meeting cần cho RoomAccessService
      { name: Room.name, schema: RoomSchema },
      { name: Meeting.name, schema: MeetingSchema },
    ]),
  ],
  providers: [RoomAccessService],
  exports: [RoomAccessService],
})
export class RoomMembersModule {}
```

- [ ] **Step 9: Build + lint + toàn bộ test**

Run (PowerShell, trong `backend`): `npm run build; npm run lint; npm test`
Expected: build pass; lint không có lỗi mới; 8 test pass.

- [ ] **Step 10: Chạy app thật để chắc DI đúng**

Run: `docker compose up -d --build` (ở gốc repo) rồi `docker compose logs backend --tail 50`
Expected: có `Redis connected`, `Nest application successfully started`, không có lỗi `Nest can't resolve dependencies of the RoomAccessService`.

- [ ] **Step 11: Commit**

```bash
git add backend/src/common backend/src/app.module.ts backend/src/modules/room-members
git commit -m "feat: RoomAccessService kiểm tra quyền room và tag meeting"
```

---

### Task 4: Cập nhật tài liệu

**Files:**
- Modify: `docs/database/DB_DESIGN.md`, `docs/PROJECT_CONTEXT.md`, `docs/api/endpoint.md`, `docs/decisions.md`, `docs/progress.md`, `CLAUDE.md`
- Modify (không commit — bị ignore): `docs/task/database/add_colection_airequest.md`, spec (Changelog)

- [ ] **Step 1: `DB_DESIGN.md`**
  - §B.1: thêm dòng `| 10 | ai_requests | Log gọi AI để đo (đề cương §5.9) | nhỏ–trung bình |`
  - §B.2: chuyển `messages` khỏi nhánh `meetings`, thêm `rooms ──1:N──► messages (meetingId = tag tuỳ chọn)` và `meetings ──1:N──► ai_requests`
  - §C.0: thêm 2 enum `AiRequestKind`, `AiRequestStatus` (copy từ Task 2)
  - §C.7: thay code schema bằng bản Task 1; thay phần **Index** bằng 3 index Task 1; thêm ghi chú: "Chat thuộc room (đề cương §6.3). `meetingId` chỉ server gắn sau khi `assertMeetingTag` pass."
  - Thêm §C.10 `ai_requests`: code schema Task 2 + 4 index + câu "Insert-only một lần khi request kết thúc; không TTL."
  - Phần D: thay 3 dòng `messages` bằng 3 index mới; thêm 4 dòng `ai_requests`

- [ ] **Step 2: `PROJECT_CONTEXT.md` §9**
  - Dòng **Room**: `meeting:${meetingId}` → `user:${userId}` · `room:${roomId}` · `meeting:${meetingId}`
  - Envelope: thêm `"roomId": "665d...",` và ghi chú `meetingId` có thể `null`
  - Bảng Client → Server: thêm `room:subscribe { roomId }`, `room:unsubscribe { roomId }`; sửa `chat:send` thành `{ roomId, clientMsgId, content, fileId?, meetingId? }`
  - Bảng Server → Client: `chat:new` ghi "emit tới `room:{roomId}`; client lọc theo `meetingId` cho khung chat meeting"
  - Thêm 1 dòng dưới bảng: "Quyền: `room:subscribe`, `chat:send` luôn gọi `RoomAccessService.assertRoomAccess`; có `meetingId` thì thêm `assertMeetingTag`. Chi tiết: spec chat-room-scope."

- [ ] **Step 3: `docs/api/endpoint.md`** — thêm nhóm **Chat** (ghi rõ *chưa code, thiết kế theo spec*):

```md
## Chat (thiết kế — chưa code)

### GET /rooms/:roomId/messages
Lấy lịch sử chat của room, mới nhất trước.

| Query | Kiểu | Mặc định | Ghi chú |
|---|---|---|---|
| before | messageId | — | cursor: lấy tin cũ hơn tin này |
| limit | number | 50 | tối đa 100 |
| meetingId | ObjectId | — | có thì chỉ lấy tin của meeting đó |

Quyền: thành viên room, không bị ban.
Response: `{ items: [{ id, roomId, meetingId, meetingTitle?, senderId, senderName, type, content, fileId, createdAt }], nextCursor }`
```

- [ ] **Step 4: `docs/decisions.md`** — thêm cuối file:

```md
## ADR-018 — Room lâu dài, kết thúc phiên chỉ kết thúc meeting
**Decision:** Kết thúc phiên học chỉ đặt `meeting.status = ENDED`; room vẫn `ACTIVE` tới khi host giải tán.
**Reason:** Đề cương §6.1 (một phòng mở nhiều meeting, lưu lịch sử). Câu "phòng chuyển sang trạng thái kết thúc" ở §6.6 được hiểu là meeting kết thúc — user chốt 2026-09-23.
**Status:** CONFIRMED.

## ADR-019 — Chat thuộc room, meeting chỉ là tag
**Decision:** `messages.roomId` là khoá sở hữu; `meetingId` tuỳ chọn, chỉ server gắn sau khi xác minh. Realtime phát một lần tới `room:{roomId}`, khung chat meeting lọc theo `meetingId`.
**Reason:** Đề cương §6.3 — tin trong họp vẫn nằm trong luồng chat chung của room, người ngoài họp đọc được.
**Alternatives:** chat chỉ trong meeting; phát riêng hai kênh room/meeting.
**Rejected because:** trái §6.3; phát hai kênh phải khử trùng cho người ở cả hai nơi.
**Status:** CONFIRMED.
```

- [ ] **Step 5: `CLAUDE.md`** — bảng "Nguồn sự thật" dòng 1: `docs/DE_CUONG.md` → `docs/DATN_decuong.md`

- [ ] **Step 6: File trong `docs/task/` (không commit)**
  - `add_colection_airequest.md`: "Mục 5.9 trong DB_DESIGN.md" → "Mục 5.9 trong đề cương (`docs/DATN_decuong.md`)"
  - Spec, mục Changelog: thêm `- v1.1 (2026-09-24): assertMeetingTag trả 400 khi meetingId sai định dạng (tránh CastError → 500).`

- [ ] **Step 7: `docs/progress.md`** — thêm mục ngày 2026-09-24: tên task, 3 commit của Task 1–3, lệch khỏi spec (400 cho meetingId sai định dạng; thêm `RedisModule` global), việc còn lại (chat gateway, REST history theo spec).

- [ ] **Step 8: Commit**

```bash
git add docs/database/DB_DESIGN.md docs/PROJECT_CONTEXT.md docs/api/endpoint.md docs/decisions.md docs/progress.md CLAUDE.md
git commit -m "docs: cập nhật tài liệu chat thuộc room + ai_requests"
```
