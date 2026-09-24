# DECISIONS + DATABASE DESIGN
**Trạng thái:** đang thực hiện và có thể chỉnh sửa( /superpower:brainstorm  rõ ràng lại) nếu có thay đổi

---
# PHẦN B — TỔNG QUAN DATABASE

## B.1 Danh sách collection

| # | Collection | Vai trò | Kích thước dự kiến |
|---|---|---|---|
| 1 | `users` | Tài khoản | nhỏ |
| 2 | `refresh_tokens` | Refresh token (hash) | nhỏ, tự hết hạn |
| 3 | `rooms` | Phòng học (lâu dài) | nhỏ |
| 4 | `room_members` | Thành viên + role trong room | trung bình |
| 5 | `meetings` | Phiên học trong room | trung bình |
| 6 | `meeting_participants` | Log tham gia từng meeting | trung bình |
| 7 | `messages` | Chat | lớn nhất |
| 8 | `whiteboards` | Snapshot bảng vẽ (1–1 meeting) | trung bình, doc lớn |
| 9 | `files` | Metadata file trên object storage | nhỏ |

## B.2 Quan hệ

```
users ──1:N──► rooms (ownerId)
  │
  └──N:M──► rooms  qua  room_members  (role, joinedAt)

rooms ──1:N──► meetings
                 │
                 ├──1:N──► meeting_participants ──N:1──► users
                 ├──1:N──► messages             ──N:1──► users
                 ├──1:1──► whiteboards
                 └──1:N──► files
```

## B.3 Nguyên tắc thiết kế đã áp dụng

| Nguyên tắc | Áp dụng ở đâu |
|---|---|
| **Không embed mảng không giới hạn** | `messages`, `room_members`, `meeting_participants` đều là collection riêng |
| **Embed mảng có giới hạn** | `meeting_participants.sessions[]` (một user join/leave vài lần mỗi meeting) |
| **Denormalize snapshot** | `messages.senderName` — tin nhắn hiển thị tên **tại thời điểm gửi**, tránh populate N+1 |
| **Counter thay đổi liên tục KHÔNG để trong Mongo** | Số người đang online nằm ở Redis; Mongo chỉ lưu `peakParticipants` khi meeting kết thúc |
| **Soft delete** | `deletedAt` ở `rooms`, `messages` |
| **Không lưu file vào Mongo** | Chỉ lưu metadata trỏ tới object storage (bắt buộc vì stateless) |

---

# PHẦN C — SCHEMA CHI TIẾT

> Dùng `@nestjs/mongoose`. Enum đặt ở `shared/src/enums.ts` để frontend dùng chung.

## C.0 Enum dùng chung

```ts
// shared/src/enums.ts
export enum RoomStatus    { ACTIVE = 'ACTIVE', DISSOLVED = 'DISSOLVED' }
export enum RoomRole      { HOST = 'HOST', MEMBER = 'MEMBER' }   // chỉ 2 role, xem docs/rule/role.md
export enum MeetingStatus { ACTIVE = 'ACTIVE', ENDED = 'ENDED' }
export enum EndReason     { HOST_ENDED = 'HOST_ENDED', AUTO_EMPTY = 'AUTO_EMPTY', ROOM_DISSOLVED = 'ROOM_DISSOLVED' }
export enum MessageType   { TEXT = 'TEXT', FILE = 'FILE', SYSTEM = 'SYSTEM' }
export enum FilePurpose   { CHAT_ATTACHMENT = 'CHAT_ATTACHMENT', AVATAR = 'AVATAR', WHITEBOARD_IMAGE = 'WHITEBOARD_IMAGE' }
```
hiện tại enums.ts đang ở backend, chưa di chuyển sang thư mục dùng chung
---

## C.1 `users`

```ts
@Schema({ timestamps: true, collection: 'users' })
export class User {
  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email: string;

  @Prop({ required: true, select: false })   // select:false → không rò ra query thường
  passwordHash: string;

  @Prop({ required: true, trim: true, maxlength: 60 })
  displayName: string;

  @Prop({ default: null })
  avatarUrl: string | null;

  @Prop({ default: null })
  lastLoginAt: Date | null;
}
```

**Index:** `{ email: 1 }` unique.

**Ghi chú:** không có `systemRole` vì không có admin. Nếu sau này cần, thêm field mới là đủ — không phá schema.

---

## C.2 `refresh_tokens`

```ts
@Schema({ timestamps: true, collection: 'refresh_tokens' })
export class RefreshToken {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ required: true, unique: true })
  tokenHash: string;          // SHA-256 của token, KHÔNG lưu token gốc

  @Prop({ required: true })
  expiresAt: Date;

  @Prop({ default: null })
  revokedAt: Date | null;

  @Prop({ default: null })
  replacedByTokenHash: string | null;   // truy vết rotation chain

  @Prop({ default: null })
  userAgent: string | null;
}
```

**Index:** `{ tokenHash: 1 }` unique · `{ userId: 1 }` · **TTL index** `{ expiresAt: 1 }, { expireAfterSeconds: 0 }` — Mongo tự xoá token hết hạn, không cần cron.

**Vì sao cần collection này:** backend stateless đa instance, refresh token phải verify được ở bất kỳ instance nào → không giữ trong RAM.

---

## C.3 `rooms`

```ts
@Schema({ timestamps: true, collection: 'rooms' })
export class Room {
  @Prop({ required: true, trim: true, maxlength: 100 })
  name: string;

  @Prop({ default: '', maxlength: 500 })
  description: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  ownerId: Types.ObjectId;

  @Prop({ required: true, unique: true, uppercase: true })
  joinCode: string;           // 8 ký tự base32, sinh ngẫu nhiên, không tuần tự

  @Prop({ type: String, enum: RoomStatus, default: RoomStatus.ACTIVE, index: true })
  status: RoomStatus;

  @Prop({ default: 0 })
  memberCount: number;        // cập nhật bằng $inc khi add/remove member

  @Prop({ default: 0 })
  meetingCount: number;       // $inc khi tạo meeting

  @Prop({ default: null })
  dissolvedAt: Date | null;

  @Prop({ default: null })
  deletedAt: Date | null;
}
```

**Index:** `{ joinCode: 1 }` unique · `{ ownerId: 1, status: 1 }` · `{ status: 1, updatedAt: -1 }`

**Ghi chú:** `memberCount` và `meetingCount` thay đổi **không thường xuyên** nên denormalize an toàn với `$inc` (atomic). Ngược lại số người đang online thay đổi liên tục → để Redis (xem Phần E).

---

## C.4 `room_members`

```ts
@Schema({ timestamps: true, collection: 'room_members' })
export class RoomMember {
  @Prop({ type: Types.ObjectId, ref: 'Room', required: true, index: true })
  roomId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ type: String, enum: RoomRole, default: RoomRole.MEMBER })
  role: RoomRole;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  invitedBy: Types.ObjectId | null;   // dùng cho import hàng loạt

  @Prop({ default: false })
  isBanned: boolean;

  @Prop({ default: Date.now })
  joinedAt: Date;
}
```

**Index:**
- `{ roomId: 1, userId: 1 }` **unique** ← chặn trùng, và là nền tảng cho import idempotent
- `{ userId: 1, joinedAt: -1 }` ← query "các room của tôi"
- `{ roomId: 1, role: 1 }` ← tìm host của room

**Vì sao là collection riêng chứ không embed vào `rooms`:** query "danh sách room của user X" là query chạy nhiều nhất trên trang chủ. Nếu embed `members[]` vào `rooms` thì phải scan toàn bộ rooms. Tách ra + index `userId` → query trực tiếp.

---

## C.5 `meetings`

```ts
@Schema({ timestamps: true, collection: 'meetings' })
export class Meeting {
  @Prop({ type: Types.ObjectId, ref: 'Room', required: true, index: true })
  roomId: Types.ObjectId;

  @Prop({ required: true, trim: true, maxlength: 100 })
  title: string;

  @Prop({ type: String, enum: MeetingStatus, default: MeetingStatus.ACTIVE })
  status: MeetingStatus;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  createdBy: Types.ObjectId;

  @Prop({ default: Date.now })
  startedAt: Date;

  @Prop({ default: null })
  endedAt: Date | null;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  endedBy: Types.ObjectId | null;

  @Prop({ type: String, enum: EndReason, default: null })
  endReason: EndReason | null;

  // --- thống kê, chỉ ghi khi meeting kết thúc ---
  @Prop({ default: 0 })  peakParticipants: number;
  @Prop({ default: 0 })  totalParticipants: number;   // số user DISTINCT từng vào
  @Prop({ default: 0 })  messageCount: number;
  @Prop({ default: 0 })  durationSeconds: number;
}
```

**Index:**
- `{ roomId: 1, startedAt: -1 }` ← lịch sử meeting của room
- **`{ roomId: 1 }` unique + partialFilterExpression `{ status: 'ACTIVE' }`** ← enforce "1 room chỉ 1 meeting ACTIVE" ở tầng DB, không phụ thuộc application logic

```ts
MeetingSchema.index(
  { roomId: 1 },
  { unique: true, partialFilterExpression: { status: MeetingStatus.ACTIVE } },
);
```

- `{ status: 1, startedAt: 1 }` ← job auto-end quét meeting ACTIVE

**Ghi chú quan trọng:** LiveKit room name = `meeting._id.toString()`. Không tạo field riêng, tránh lệch dữ liệu.

---

## C.6 `meeting_participants`

```ts
@Schema({ _id: false })
class ParticipantSession {
  @Prop({ required: true }) joinedAt: Date;
  @Prop({ default: null })  leftAt: Date | null;
}

@Schema({ timestamps: true, collection: 'meeting_participants' })
export class MeetingParticipant {
  @Prop({ type: Types.ObjectId, ref: 'Meeting', required: true, index: true })
  meetingId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ required: true, maxlength: 60 })
  displayName: string;              // snapshot tên lúc tham gia

  @Prop({ type: String, enum: RoomRole, required: true })
  roleAtJoin: RoomRole;             // role tại thời điểm join

  @Prop({ type: [ParticipantSession], default: [] })
  sessions: ParticipantSession[];   // mảng CÓ GIỚI HẠN, mỗi lần join/leave thêm 1 phần tử

  @Prop({ default: 0 })
  totalDurationSeconds: number;
}
```

**Index:** `{ meetingId: 1, userId: 1 }` **unique** · `{ meetingId: 1 }`

**Vì sao dùng `sessions[]` thay vì mỗi lần join là 1 document:** một user có thể rớt mạng và vào lại 3–5 lần trong một meeting — mảng nhỏ, có giới hạn thực tế. Gộp vào 1 doc giúp query "ai đã tham gia meeting này" chỉ trả về đúng số người, không phải group by.

**Ai ghi vào đây:** **LiveKit webhook**, không phải client. Client không được tự báo đã join.

---

## C.7 `messages`

```ts
@Schema({ timestamps: true, collection: 'messages' })
export class Message {
  @Prop({ type: Types.ObjectId, ref: 'Meeting', required: true, index: true })
  meetingId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Room', required: true })
  roomId: Types.ObjectId;           // denormalize để export theo room không cần join

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  senderId: Types.ObjectId;

  @Prop({ required: true, maxlength: 60 })
  senderName: string;               // SNAPSHOT — tên lúc gửi, không đổi khi user đổi tên

  @Prop({ type: String, enum: MessageType, default: MessageType.TEXT })
  type: MessageType;

  @Prop({ default: '', maxlength: 2000 })
  content: string;

  @Prop({ type: Types.ObjectId, ref: 'File', default: null })
  fileId: Types.ObjectId | null;    // khi type = FILE

  @Prop({ required: true })
  clientMsgId: string;              // do client sinh → chống gửi trùng khi reconnect

  @Prop({ default: null })
  deletedAt: Date | null;
}
```

**Index:**
- `{ meetingId: 1, createdAt: -1 }` ← load lịch sử chat (query nóng nhất)
- `{ meetingId: 1, clientMsgId: 1 }` **unique** ← **idempotent**: client gửi lại sau reconnect sẽ bị chặn ở tầng DB, không cần logic phức tạp
- `{ roomId: 1, createdAt: -1 }` ← export chat theo room

**Ghi chú:** `senderName` là snapshot có chủ đích — giống Slack/Discord, tin nhắn cũ giữ tên cũ. Tránh populate N+1 khi load 50 tin.

---

## C.8 `whiteboards`

```ts
@Schema({ timestamps: true, collection: 'whiteboards' })
export class Whiteboard {
  @Prop({ type: Types.ObjectId, ref: 'Meeting', required: true, unique: true })
  meetingId: Types.ObjectId;        // 1–1 với meeting

  @Prop({ type: Types.ObjectId, ref: 'Room', required: true, index: true })
  roomId: Types.ObjectId;

  @Prop({ type: Buffer, required: true })
  elementsGzip: Buffer;             // gzip(JSON.stringify(elements[]))

  @Prop({ default: 0 })
  elementCount: number;             // để hiển thị + check hard limit 5000

  @Prop({ default: 0 })
  rawSizeBytes: number;             // kích thước trước nén, để theo dõi tăng trưởng

  @Prop({ required: true, default: 0 })
  lastSeq: number;                  // seq cuối đã persist — GUARD chống ghi đè ngược

  @Prop({ type: Object, default: {} })
  appState: Record<string, any>;    // viewBackgroundColor, gridSize... (nhỏ)

  @Prop({ type: Types.ObjectId, ref: 'Meeting', default: null })
  clonedFrom: Types.ObjectId | null;

  @Prop({ default: null })
  lastPersistedAt: Date | null;
}
```

**Index:** `{ meetingId: 1 }` unique · `{ roomId: 1, updatedAt: -1 }`

**`lastSeq` là chi tiết quan trọng nhất ở đây.** Với nhiều backend instance, hai instance có thể cùng debounce-persist một board. Nếu ghi mù, bản cũ có thể đè bản mới. Guard bằng conditional update:

```ts
await this.model.updateOne(
  { meetingId, lastSeq: { $lt: incomingSeq } },   // chỉ ghi nếu mới hơn
  { $set: { elementsGzip, elementCount, lastSeq: incomingSeq, lastPersistedAt: new Date() } },
  { upsert: true },
);
```

**Vì sao gzip Buffer:** 5.000 element Excalidraw ≈ 3–6 MB JSON thô, gần trần 16 MB/document. Gzip giảm còn ~10–20%. Đánh đổi: không query được bên trong elements — chấp nhận được vì hệ thống không bao giờ cần query nội dung element.

---

## C.9 `files`

```ts
@Schema({ timestamps: true, collection: 'files' })
export class File {
  @Prop({ required: true, unique: true })
  storageKey: string;               // key trên MinIO/R2, vd: meetings/{meetingId}/{uuid}.pdf

  @Prop({ required: true, maxlength: 255 })
  originalName: string;

  @Prop({ required: true })
  mimeType: string;

  @Prop({ required: true })
  sizeBytes: number;

  @Prop({ type: String, enum: FilePurpose, required: true })
  purpose: FilePurpose;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  uploaderId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Meeting', default: null, index: true })
  meetingId: Types.ObjectId | null;

  @Prop({ type: Types.ObjectId, ref: 'Room', default: null })
  roomId: Types.ObjectId | null;

  @Prop({ default: null })
  deletedAt: Date | null;
}
```

**Index:** `{ storageKey: 1 }` unique · `{ meetingId: 1, createdAt: -1 }` · `{ uploaderId: 1 }`

**Quy tắc bắt buộc:** Mongo **chỉ lưu metadata**, file nằm ở object storage. URL tải về sinh bằng **presigned URL có hạn** (`[DEFAULT]` 15 phút), không public bucket — nếu public thì bất kỳ ai có link đều tải được, phá vỡ permission của room.

---

# PHẦN D — BẢNG INDEX TỔNG HỢP

| Collection | Index | Loại | Mục đích |
|---|---|---|---|
| users | `{ email: 1 }` | unique | login, chặn trùng |
| refresh_tokens | `{ tokenHash: 1 }` | unique | verify |
| refresh_tokens | `{ expiresAt: 1 }` | **TTL** | tự dọn rác |
| refresh_tokens | `{ userId: 1 }` | — | revoke all |
| rooms | `{ joinCode: 1 }` | unique | join bằng code |
| rooms | `{ ownerId: 1, status: 1 }` | — | room tôi sở hữu |
| room_members | `{ roomId: 1, userId: 1 }` | **unique** | chặn trùng + import idempotent |
| room_members | `{ userId: 1, joinedAt: -1 }` | — | danh sách room của tôi |
| meetings | `{ roomId: 1, startedAt: -1 }` | — | lịch sử meeting |
| meetings | `{ roomId: 1 }` + partial ACTIVE | **unique partial** | 1 meeting ACTIVE / room |
| meetings | `{ status: 1, startedAt: 1 }` | — | job auto-end |
| meeting_participants | `{ meetingId: 1, userId: 1 }` | **unique** | 1 doc / user / meeting |
| messages | `{ meetingId: 1, createdAt: -1 }` | — | load chat |
| messages | `{ meetingId: 1, clientMsgId: 1 }` | **unique** | chống gửi trùng |
| messages | `{ roomId: 1, createdAt: -1 }` | — | export |
| whiteboards | `{ meetingId: 1 }` | unique | 1–1 |
| files | `{ storageKey: 1 }` | unique | |
| files | `{ meetingId: 1, createdAt: -1 }` | — | file trong meeting |

> 4 unique index in đậm là **ràng buộc nghiệp vụ ở tầng DB**, không chỉ để tăng tốc. Chúng thay thế hàng chục dòng application logic và vẫn đúng khi chạy nhiều instance.

---

# PHẦN E — DỮ LIỆU KHÔNG NẰM Ở MONGO

Đây là phần trực tiếp phục vụ yêu cầu stateless của GVHD. Mọi thứ dưới đây **nếu để trong RAM là sai**.

| Key Redis | Kiểu | TTL | Nội dung |
|---|---|---|---|
| `wb:{meetingId}` | String (gzip) | 24h | Live state whiteboard |
| `wb:seq:{meetingId}` | String (INCR) | 24h | Bộ đếm seq |
| `wb:ops:{meetingId}` | List | 24h | Ring buffer 500 op gần nhất (LPUSH + LTRIM) |
| `presence:{meetingId}` | Set | 24h | userId đang online |
| `presence:peak:{meetingId}` | String | 24h | Đỉnh participant → ghi vào Mongo khi end |
| `lock:{jobName}` | String | 30s | Distributed lock cho cron (SET NX PX) |
| `rl:{scope}:{id}` | String | tuỳ | Rate limit counter |
| `socket.io#*` | (adapter tự quản) | — | Pub/Sub broadcast giữa instance |