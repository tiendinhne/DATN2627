# Database

MongoDB + Mongoose. ID = `ObjectId`, expose ra API/socket dưới dạng `id: string` (qua `TransformInterceptor`).
Trạng thái: 9 schema **[IMPLEMENTED]** (verified load 9/9, index đúng). Script `verify-schema.ts` **[PLANNED — chưa chạy thành công end-to-end]**.

## 1. Collection

| # | Collection | Vai trò |
|---|---|---|
| 1 | `users` | tài khoản |
| 2 | `refresh_tokens` | refresh token (hash) |
| 3 | `rooms` | phòng học lâu dài |
| 4 | `room_members` | thành viên + role trong room |
| 5 | `meetings` | phiên học |
| 6 | `meeting_participants` | log tham gia từng meeting |
| 7 | `messages` | chat |
| 8 | `whiteboards` | snapshot bảng vẽ (1–1 meeting) |
| 9 | `files` | metadata file trên object storage |

## 2. Nguyên tắc thiết kế đã áp dụng [CONFIRMED]

- **Không embed mảng không giới hạn** → `messages`, `room_members`, `meeting_participants` là collection riêng
- **Embed mảng có giới hạn** → `meeting_participants.sessions[]` (user rớt mạng vào lại vài lần)
- **Denormalize snapshot** → `messages.senderName` giữ tên tại thời điểm gửi, tránh populate N+1
- **Counter thay đổi liên tục KHÔNG để trong Mongo** → số người online ở Redis; Mongo chỉ nhận `peakParticipants` một lần khi meeting ENDED
- **Không lưu file vào Mongo**, chỉ metadata trỏ object storage (bắt buộc vì stateless)
- Soft delete bằng `deletedAt`

## 3. Bốn ràng buộc nghiệp vụ đẩy xuống tầng DB [CONFIRMED]

Thay thế hàng chục dòng application logic và vẫn đúng khi chạy nhiều instance:

| Index | Tác dụng |
|---|---|
| `meetings {roomId}` unique + partial `{status:'ACTIVE'}` | 1 room chỉ 1 meeting đang chạy |
| `messages {meetingId, clientMsgId}` unique | chống gửi trùng khi reconnect |
| `room_members {roomId, userId}` unique | import member idempotent |
| `whiteboards.lastSeq` + update có điều kiện | chống ghi đè ngược khi đa instance |

`refresh_tokens` có **TTL index** trên `expiresAt` → Mongo tự dọn, không cần cron.

## 4. Bảng index đầy đủ

| Collection | Index | Loại |
|---|---|---|
| users | `{email:1}` | unique (khai ở `@Prop`) |
| refresh_tokens | `{tokenHash:1}` | unique (`@Prop`) |
| refresh_tokens | `{expiresAt:1}` | **TTL** |
| refresh_tokens | `{userId:1}` | — |
| rooms | `{joinCode:1}` | unique (`@Prop`) |
| rooms | `{ownerId:1, status:1}` | compound |
| rooms | `{status:1, updatedAt:-1}` | compound |
| room_members | `{roomId:1, userId:1}` | **unique** |
| room_members | `{userId:1, joinedAt:-1}` | compound |
| room_members | `{roomId:1, role:1}` | compound |
| meetings | `{roomId:1, startedAt:-1}` | compound |
| meetings | `{status:1, startedAt:1}` | compound |
| meetings | `{roomId:1}` + partial ACTIVE | **unique partial** |
| meeting_participants | `{meetingId:1, userId:1}` | **unique** |
| meeting_participants | `{userId:1}` | — |
| messages | `{meetingId:1, createdAt:-1}` | compound |
| messages | `{meetingId:1, clientMsgId:1}` | **unique** |
| messages | `{roomId:1, createdAt:-1}` | compound |
| whiteboards | `{meetingId:1}` | unique (`@Prop`) |
| whiteboards | `{roomId:1, updatedAt:-1}` | compound |
| files | `{storageKey:1}` | unique (`@Prop`) |
| files | `{uploaderId:1}` | — |
| files | `{meetingId:1, createdAt:-1}` | compound |

**Quy tắc khai báo:** `unique` và single-field khai ở `@Prop`; chỉ dùng `Schema.index()` cho compound / partial / TTL. Khai cả hai chỗ sinh duplicate index warning.

## 5. Field quan trọng

**`meetings`** — `roomId, title, status, mode, createdBy, startedAt, endedAt, endedBy, endReason`, và thống kê chỉ ghi khi ENDED: `peakParticipants, totalParticipants, messageCount, durationSeconds`.

**`whiteboards`** — `meetingId (unique), roomId, elementsGzip (Buffer), elementCount, rawSizeBytes, lastSeq, appState, clonedFrom, lastPersistedAt`.

**`messages`** — `meetingId, roomId (denormalize để export), senderId, senderName (snapshot), type, content, fileId, clientMsgId, deletedAt`.

**`meeting_participants`** — `meetingId, userId, displayName (snapshot), roleAtJoin, sessions[{joinedAt, leftAt}], totalDurationSeconds`. Ghi bởi **LiveKit webhook**, không phải client.

**`users`** [CẦN HOÀ GIẢI] — nhánh đồng đội có `email, username, password, googleId (unique+sparse), avatar, providers[]`. Thiết kế chốt cần bổ sung `displayName`, `lastLoginAt`, và đổi `avatar` → `avatarUrl`.

## 6. Dữ liệu KHÔNG nằm ở Mongo [CONFIRMED]

Phục vụ trực tiếp yêu cầu stateless. Mọi thứ dưới đây nếu để trong RAM là sai.

| Key Redis | Kiểu | TTL | Nội dung |
|---|---|---|---|
| `wb:{meetingId}` | String (gzip) | 24h | live state whiteboard |
| `wb:seq:{meetingId}` | String (INCR) | 24h | bộ đếm seq |
| `wb:ops:{meetingId}` | List | 24h | ring buffer 500 op (LPUSH + LTRIM) |
| `presence:{meetingId}` | Set | 24h | userId đang online |
| `presence:peak:{meetingId}` | String | 24h | đỉnh participant → ghi Mongo khi end |
| `lock:{jobName}` | String | 30s | distributed lock (SET NX PX) |
| `rl:{scope}:{id}` | String | tuỳ | rate limit counter |
| `socket.io#*` | (adapter tự quản) | — | pub/sub broadcast giữa instance |

```
Realtime  → Redis (nguồn đọc snapshot khi join)
Debounce  → Mongo (15s / 60s / lúc end / graceful shutdown)
Thống kê  → Redis trong lúc chạy → Mongo một lần khi meeting ENDED
```

## 7. Bốn phép thử xác nhận schema [PLANNED]

Script `backend/scripts/verify-schema.ts`. Chạy trước khi có API.

1. Tạo 2 meeting ACTIVE cùng room → phải lỗi duplicate key
2. Insert 2 message cùng `clientMsgId` → phải lỗi duplicate key
3. Import cùng email 2 lần → chỉ còn 1 bản ghi
4. Ghi whiteboard với `lastSeq` nhỏ hơn → `matchedCount` phải bằng 0
