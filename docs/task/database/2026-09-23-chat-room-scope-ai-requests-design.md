# Design — Chat thuộc Room + collection `ai_requests`

**Version:** v1 · 2026-09-23 · **Trạng thái:** đã duyệt thiết kế, có thể chỉnh khi phát sinh trong lúc code (ghi thay đổi vào mục Changelog cuối file)

**Task gốc:** `docs/task/database/update_message.md`, `docs/task/database/add_colection_airequest.md`

**Truy vết về đề cương (`docs/DATN_decuong.md`):**

| Nội dung | Nguồn |
|---|---|
| Room lâu dài, nhiều meeting, kết thúc phiên chỉ ENDED meeting | Đề cương §6.1. §6.6 ("phòng chuyển sang trạng thái kết thúc") được hiểu là *meeting* kết thúc — user chốt 2026-09-23 |
| Chat thuộc Room, `meetingId` là tag; người ngoài meeting đọc được | Đề cương §6.3 |
| Khung chat trong meeting là khung **riêng** (chỉ tin của meeting) | Đề cương §6.3 ("một khung chat riêng trong màn hình video") |
| `ai_requests` phục vụ đánh giá trợ lý AI | Đề cương §5.9 |
| Chủ phòng quản lý thành viên | Đề cương §5.4 |
---

## 1. Quyết định đã chốt

| # | Quyết định | Lựa chọn |
|---|---|---|
| D1 | Room có chat khi không có meeting ACTIVE? | **Có** — room có kênh chat luôn mở |
| D2 | Khung chat trong meeting hiển thị gì? | **Chỉ tin có tag meeting đó**. Trang room hiển thị tất cả, tin trong họp có badge `[Trong cuộc họp: "<title>"]` |
| D3 | Ai gắn `meetingId`? | **Server xác minh**, client không tự khai được meeting mình không tham gia |
| D4 | Fan-out realtime | **Một kênh `room:{roomId}`**, emit một lần; client lọc theo `meetingId` cho khung meeting |
| D5 | Lưu prompt AI? | **Có**, cắt 1000 ký tự |
| D6 | TTL `ai_requests` | **Không** — giữ dữ liệu cho benchmark/báo cáo |
| D7 | Phạm vi plan triển khai | **S1** — nền tảng (schema, enum, hàm check quyền dùng chung + test, tài liệu). Gateway chat, REST history, kick thực thi ở task chat / room-members theo spec này |

---

## 2. Schema `messages` (sửa)

```ts
@Schema({ timestamps: true, collection: 'messages' })
export class Message {
  @Prop({ type: Types.ObjectId, ref: 'Room', required: true })
  roomId!: Types.ObjectId;                 // khoá sở hữu chính

  @Prop({ type: Types.ObjectId, ref: 'Meeting', default: null })
  meetingId?: Types.ObjectId | null;       // tag — chỉ server gắn sau khi xác minh (D3)

  // senderId, senderName, type, content, fileId, clientMsgId, deletedAt: giữ nguyên
}
```

**Index:**

| Index | Mục đích |
|---|---|
| `{ roomId: 1, createdAt: -1 }` | Luồng chat room — query nóng nhất |
| `{ roomId: 1, clientMsgId: 1 }` **unique** | Idempotent khi reconnect (thay `{meetingId, clientMsgId}` — không còn đúng khi `meetingId` null) |
| `{ meetingId: 1, createdAt: -1 }` partial `{ meetingId: { $type: 'objectId' } }` | Khung chat meeting + `meeting:snapshot.recentMessages`; chỉ index tin có tag |

- Bỏ index `{ meetingId: 1, clientMsgId: 1 }` và `index: true` đơn lẻ trên `meetingId`.
- `meetings.messageCount` giữ nguyên — đếm tin có tag meeting đó.
- Chưa có dữ liệu thật → không cần migration; khi deploy phải **drop index cũ** (`syncIndexes()` hoặc drop tay).

---

## 3. Realtime contract (thay đổi §9 PROJECT_CONTEXT)

### 3.1 Kênh Socket.IO

| Kênh | Ai vào | Khi nào |
|---|---|---|
| `user:{userId}` | mọi socket của user | server tự join sau handshake hợp lệ |
| `room:{roomId}` | thành viên đang xem room hoặc đang trong meeting của room | `room:subscribe`, hoặc server tự join khi `meeting:join` thành công |
| `meeting:{meetingId}` | participant | như hiện tại |

Tên kênh sinh từ một helper duy nhất, không ghép chuỗi rải rác.

### 3.2 Event

| Hướng | Event | Payload |
|---|---|---|
| C→S | `room:subscribe` | `{ roomId }` |
| C→S | `room:unsubscribe` | `{ roomId }` |
| C→S | `chat:send` | `{ roomId, clientMsgId, content, fileId?, meetingId? }` |
| S→C | `chat:new` | `{ message }` → emit tới `room:{roomId}` |
| S→C | `room:access_revoked` | `{ roomId, reason: 'KICKED' \| 'BANNED' \| 'DISSOLVED' }` |

Envelope bổ sung `roomId`; `meetingId` được phép `null`.

### 3.3 Kiểm tra quyền

**Hàm dùng chung `assertRoomAccess(userId, roomId)`** — dùng cho `room:subscribe`, `chat:send`, REST history:

1. `roomId` là ObjectId hợp lệ → sai: 400
2. Room tồn tại, `status = ACTIVE`, `deletedAt = null` → sai: 404
3. Có `room_members {roomId, userId}` và `isBanned = false` → sai: 403

Lỗi ở `room:subscribe` → emit `error`, **không** join kênh.

**`chat:send`** — luôn chạy `assertRoomAccess` (đọc Mongo), **không** tin việc socket đang ở trong kênh `room:{roomId}`: user có thể vừa bị kick ở instance khác. Không cache kết quả (cache chính là khe hở cần đóng). Chi phí: 1 query theo unique index `{roomId, userId}`.

Nếu có `meetingId`, thêm `assertMeetingTag(userId, roomId, meetingId)`:
- meeting tồn tại, `status = ACTIVE`
- `meeting.roomId === roomId`
- `userId ∈ presence:{meetingId}` (Redis)
- sai bất kỳ → 403
---

## 4. REST — lịch sử chat

`GET /rooms/:roomId/messages?before=<messageId>&limit=50&meetingId=<id>`

- Cursor theo `(createdAt, _id)` — không `skip`. `limit` mặc định 50, tối đa 100 (DTO class-validator)
- Không có `meetingId` → luồng room đầy đủ; có → chỉ tin của meeting đó, kiểm tra `meeting.roomId === roomId`
- Quyền: `assertRoomAccess`
- Response: `id` không `_id`. Tin có tag kèm `meetingTitle`, lấy bằng **một** query `meetings.find({ _id: { $in: ids } })` cho cả trang — không populate từng tin, không denormalize title vào message (meeting có thể đổi tên)
- `meeting:snapshot.recentMessages` = 50 tin gần nhất có tag meeting đó

---

## 5. Schema `ai_requests` (mới) — `backend/src/modules/ai-assistant/schemas/ai-request.schema.ts`

```ts
@Schema({ timestamps: { createdAt: true, updatedAt: false }, collection: 'ai_requests' })
export class AiRequest {
  @Prop({ required: true, maxlength: 64 })          requestId!: string;   // từ ai:generate
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })    userId!: Types.ObjectId;
  @Prop({ type: Types.ObjectId, ref: 'Room', required: true })    roomId!: Types.ObjectId;
  @Prop({ type: Types.ObjectId, ref: 'Meeting', required: true }) meetingId!: Types.ObjectId;
  @Prop({ type: String, enum: AiRequestKind, required: true })    kind!: AiRequestKind;
  @Prop({ required: true, maxlength: 1000 })        prompt!: string;      // service cắt trước khi lưu
  @Prop({ type: String, enum: AiRequestStatus, required: true })  status!: AiRequestStatus;
  @Prop({ type: String, default: null, maxlength: 64 }) errorCode?: string | null; // mã ngắn, không stack trace
  @Prop({ required: true, min: 0 })                 latencyMs!: number;
  @Prop({ required: true })                         model!: string;
  @Prop({ type: Number, default: null })            inputTokens?: number | null;
  @Prop({ type: Number, default: null })            outputTokens?: number | null;
  @Prop({ default: 0, min: 0 })                     elementCount?: number;
}
```

Enum mới trong `shared/enums.ts`:

```ts
export enum AiRequestKind   { DIAGRAM = 'DIAGRAM', MINDMAP = 'MINDMAP', FLOWCHART = 'FLOWCHART' }   // đề cương §4.2
export enum AiRequestStatus { SUCCESS = 'SUCCESS', PROVIDER_ERROR = 'PROVIDER_ERROR', INVALID_OUTPUT = 'INVALID_OUTPUT', TIMEOUT = 'TIMEOUT', RATE_LIMITED = 'RATE_LIMITED' }
```

**Index:** `{ createdAt: -1 }`, `{ meetingId: 1, createdAt: -1 }`, `{ status: 1, createdAt: -1 }`, `{ userId: 1, requestId: 1 }` **unique**.

**Ghi:** insert-only, **đúng một lần khi request kết thúc** (thành công hoặc lỗi). Không `PENDING`, không update → không tranh chấp. Đánh đổi: instance chết giữa chừng thì mất bản ghi request đó — chấp nhận vì đây là dữ liệu đo. `INVALID_OUTPUT` = output AI không qua validate (ràng buộc #3).

**Số liệu báo cáo lấy được (§5.9):** tỷ lệ thành công theo `kind`, p50/p95 `latencyMs`, phân bố lỗi theo `status`/`errorCode`, token trung bình, kích thước sơ đồ.

---

## 6. Phạm vi triển khai (S1)

**Trong plan này:**
1. Sửa `message.schema.ts` + index (mục 2)
2. Thêm `ai-request.schema.ts` + enum (mục 5), đăng ký schema trong `ai-assistant` module
4. `assertRoomAccess`, `assertMeetingTag` + unit test (test trước)
5. Cập nhật tài liệu (mục 7)

**Ngoài plan này** (task chat / room-members, tham chiếu spec này): chat gateway, REST history,helper tên kênh, emit qua publisher.

---

## 7. Tài liệu phải cập nhật

- `docs/database/DB_DESIGN.md`: §B.2 (`rooms 1:N messages`), §C.7, thêm §C.10 `ai_requests`, bảng index phần D, enum §C.0
- `docs/PROJECT_CONTEXT.md`: §4 domain model, §9 event catalog + envelope + kênh
- `docs/api/endpoint.md`: `GET /rooms/:roomId/messages`
- `docs/decisions.md`: (a) room lâu dài theo §6.1, (b) chat thuộc room
- `docs/task/database/add_colection_airequest.md`: sửa "Mục 5.9 DB_DESIGN.md" → "đề cương §5.9"
- `CLAUDE.md`: đường dẫn đề cương `docs/DE_CUONG.md` → `docs/DATN_decuong.md`
- `docs/progress.md`

---

## 8. Test

Test trước cho logic thật:

| Đơn vị | Case |
|---|---|
| `assertRoomAccess` | roomId sai định dạng (400) · room không tồn tại (404) · DISSOLVED (404) · deletedAt ≠ null (404) · không phải member (403) · bị ban (403) · hợp lệ |
| `assertMeetingTag` | meeting không tồn tại · ENDED · thuộc room khác · user không trong presence · hợp lệ |

Schema thuần không test (CLAUDE.md).

---

## Changelog

- v1 (2026-09-23): bản đầu.
- v1.1 (2026-09-25, user duyệt khi chốt plan):
  - `assertMeetingTag` trả **400** khi `meetingId` sai định dạng (tránh Mongoose CastError → 500); các trường hợp còn lại vẫn 403.
  - Thêm `backend/src/common/redis.module.ts` (`@Global`) — `RedisService` trước chỉ nằm ở `AppModule` nên module con không inject được; khai báo lại ở từng module sẽ mở thêm kết nối Redis.
  - `assertMeetingTag` cũng trả 400 khi `roomId` sai định dạng (fix review, commit 2e0cbf2).
