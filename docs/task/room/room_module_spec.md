# Module Room — spec (Task 0)

Ngày chốt: 2026-09-26. Task list: `room_module_tasks.md` (cùng thư mục).

**Nguồn:** đề cương §3.2, §5.4, §6.1, §6.2 · `docs/rule/role.md` · PROJECT_CONTEXT §4, §13, §14, §15, §16 · ADR-008, ADR-018.

---

## 1. Câu hỏi mở — đã chốt

| # | Câu hỏi | Chốt | Lý do |
|---|---|---|---|
| 1 | "Đổi role" trong `role.md` | **Không làm.** Không có chuyển host. | Chỉ có 2 role, mỗi phòng 1 HOST → không có gì để đổi. Chuyển host cần ghi 3 document (2 member + `rooms.ownerId`) mà Mongo chạy standalone, không có transaction. User chốt 2026-09-26. |
| 2 | Kick có chặn vào lại không | **Kick = xoá bản ghi `room_members`.** Người bị kick nhập lại mã thì vào lại được. **Bỏ field `isBanned`.** | Đúng `role.md` ("Call API delete member"). Không có UI gỡ ban → giữ ban chỉ thêm trạng thái chết. |
| 3 | HOST rời phòng | **Không được rời**, chỉ giải tán. | Hệ quả của câu 1: không chuyển host thì HOST rời sẽ để lại phòng không có chủ. |
| 4 | Sửa tên/mô tả phòng | **Có** — `PATCH /rooms/:roomId`, chỉ HOST. | Đề cương §3.2 "quản lý phòng". User chốt 2026-09-26. |
| 5 | `rooms.deletedAt` | **Giữ nguyên field, không dùng.** `assertRoomAccess` vẫn lọc `deletedAt: null` như hiện tại. | User chốt 2026-09-26. Giải tán dùng `status = DISSOLVED` + `dissolvedAt`. |
| 6 | Giải tán khi có meeting ACTIVE | Bây giờ giải tán chỉ đổi status. Kết thúc meeting (`EndReason.ROOM_DISSOLVED`) **để lại cho module meeting**. | Module meeting chưa có. Sau giải tán `assertRoomAccess` đã trả 404 nên mọi truy cập qua room đều bị chặn. |
| 7 | Bảng quyền đặt ở đâu | `backend/src/shared/permissions.ts`, cạnh `enums.ts`. TS thuần, không import Nest/mongoose. Cách frontend import **chốt ở Task 9**. | Docker build context là `./backend` → dời `shared/` ra gốc repo phải sửa Dockerfile + cấu hình Next, không đáng làm lúc này. |

---

## 2. API

Mọi endpoint cần JWT (ADR-008, không có guest). Response trả `id`, không `_id`. Lỗi validate → 400.

### 2.1 Bảng endpoint

| Endpoint | Ai gọi được | Task |
|---|---|---|
| `POST /rooms` | user đã đăng nhập | 2 |
| `POST /rooms/join` | user đã đăng nhập | 3 |
| `GET /rooms` | user đã đăng nhập | 4 |
| `GET /rooms/:roomId` | thành viên | 4 |
| `PATCH /rooms/:roomId` | HOST | 4 |
| `GET /rooms/:roomId/members` | thành viên | 4 |
| `DELETE /rooms/:roomId/members/me` | thành viên (không phải HOST) | 6 |
| `DELETE /rooms/:roomId/members/:userId` | HOST | 5 |
| `POST /rooms/:roomId/dissolve` | HOST | 7 |

### 2.2 Chi tiết

**`POST /rooms`** — body `{ name: string 1–100 (trim), description?: string ≤500 }`
1. Sinh `joinCode` (mục 3.1), tạo room với `ownerId = userId`, `memberCount: 1`.
2. Tạo `room_members` `{ roomId, userId, role: HOST }`.
3. Nếu bước 2 lỗi → xoá room vừa tạo rồi ném lỗi (bù tay vì không có transaction).
4. `201` → room response (mục 2.3) với `myRole: HOST`.

**`POST /rooms/join`** — body `{ code: string }`, chuẩn hoá uppercase rồi kiểm tra `/^[A-Z2-7]{8}$/`.
1. Rate limit (mục 3.2) — vượt → `429`.
2. Tìm room `{ joinCode, status: ACTIVE }`. Không thấy (sai mã **hoặc** đã giải tán) → `404` cùng một thông báo, không lộ phòng nào đã giải tán.
3. Insert member `role: MEMBER`.
   - Lỗi duplicate key (unique `{roomId, userId}`) → đã là thành viên → trả room luôn, **không** tăng count (idempotent).
   - Insert thành công → `$inc memberCount: 1`.
4. `200` → room response với `myRole` thật của user.

**`GET /rooms?page=1&limit=20`** — `page ≥1`, `1 ≤ limit ≤ 50`, mặc định 1 / 20.
- Một aggregate trên `room_members`: `$match {userId}` → `$sort {joinedAt: -1}` → `$lookup rooms` → `$match` room ACTIVE → `$skip` / `$limit (limit + 1)`.
- Trả `{ items: RoomResponse[], page, limit, hasMore }` — `hasMore` = lấy dư 1 bản ghi, không đếm total.

**`GET /rooms/:roomId`** — `assertRoomAccess` → room response với `myRole`. Mọi thành viên đều thấy `joinCode` để chia sẻ (như Google Meet).

**`PATCH /rooms/:roomId`** — body `{ name?, description? }` cùng ràng buộc như tạo, phải có ít nhất 1 field. `assertRoomPermission(UPDATE_ROOM)` → cập nhật → room response.

**`GET /rooms/:roomId/members`** — `assertRoomAccess` → danh sách `{ userId, displayName, avatarUrl, role, joinedAt }`, HOST đứng đầu, sau đó theo `joinedAt` tăng dần. Không phân trang (phòng học nhóm nhỏ).

**`DELETE /rooms/:roomId/members/me`** — `assertRoomAccess`. HOST → `400` "Host không thể rời phòng, hãy giải tán phòng". MEMBER → xoá bản ghi, `deletedCount === 1` thì `$inc memberCount: -1`. `204`.

**`DELETE /rooms/:roomId/members/:userId`** — `:userId` phải là ObjectId (400).
1. `assertRoomPermission(KICK_MEMBER)` — MEMBER gọi → `403`.
2. `:userId` là chính mình → `400` (HOST duy nhất là mình nên đây cũng là chặn "kick HOST").
3. `deleteOne({ roomId, userId })` — `deletedCount === 0` → `404`; `=== 1` → `$inc memberCount: -1`. Hai request kick cùng lúc chỉ trừ count một lần.
4. `204`.

Route `members/me` khai báo **trước** `members/:userId` trong controller.

**`POST /rooms/:roomId/dissolve`** — `assertRoomPermission(DISSOLVE_ROOM)` → `updateOne({ _id, status: ACTIVE }, { status: DISSOLVED, dissolvedAt: now })`. Giữ nguyên `room_members` làm lịch sử. `204`. Sau đó mọi endpoint theo `roomId` trả 404 (qua `assertRoomAccess`), join bằng mã trả 404.

### 2.3 Room response

```ts
{ id, name, description, joinCode, ownerId, status, memberCount, createdAt, myRole }
```

Map `_id → id` trong service trước khi trả về controller.

---

## 3. Chi tiết kỹ thuật

### 3.1 Sinh join code (§16)
- 8 ký tự, bảng base32 `ABCDEFGHIJKLMNOPQRSTUVWXYZ234567`, mỗi ký tự lấy bằng `crypto.randomInt(32)` → không tuần tự, ~1,1·10¹² tổ hợp.
- Trùng (duplicate key trên `joinCode`) → sinh lại, tối đa 5 lần, quá thì `500`.

### 3.2 Rate limit join code (§16)
- Key Redis `ratelimit:join:{userId}`: `INCR`, nếu kết quả = 1 thì `EXPIRE 60`.
- Kết quả > 10 → `429`. Đếm mọi lần gọi (không phân biệt đúng/sai) cho đơn giản.
- Nằm trong Redis → đúng khi request rơi vào instance khác (ràng buộc 5).

### 3.3 Bảng quyền (§15)
`backend/src/shared/permissions.ts`:
```ts
export enum RoomAction { UPDATE_ROOM, DISSOLVE_ROOM, KICK_MEMBER, IMPORT_MEMBERS, EXPORT_MEMBERS, MANAGE_MEETING }
export const ROOM_PERMISSIONS: Record<RoomAction, RoomRole[]>  // theo docs/rule/role.md
export function can(role: RoomRole, action: RoomAction): boolean
```
- Chỉ liệt kê hành động **chỉ HOST** được làm. Hành động cả hai role đều làm (chat, vẽ, AI, upload, media) chỉ cần là thành viên → dùng `assertRoomAccess`, không đưa vào bảng.
- `MANAGE_MEETING` (tạo/kết thúc meeting) khai báo sẵn cho module meeting dùng.

### 3.4 Kiểm tra quyền ở backend
Thêm vào `RoomAccessService`:
```ts
assertRoomPermission(userId, roomId, action) // = assertRoomAccess → can(member.role, action) → không được thì 403
```
Module meeting sau này dùng lại được.

### 3.5 Thay đổi code có sẵn
- `room-member.schema.ts`: bỏ `isBanned`.
- `room-access.service.ts`: bỏ `isBanned: false` khỏi query; sửa `room-access.service.spec.ts` tương ứng.
- `docs/database/DB_DESIGN.md`: bỏ `isBanned`.

### 3.6 Cấu trúc module
- Một `RoomsController` + một `RoomsService` trong `modules/rooms/`, gồm cả route members. `rooms.module.ts` import `RoomMembersModule` (lấy `RoomAccessService`) và đăng ký thêm model `RoomMember`.
- `room-members` module giữ nguyên vai trò: schema + `RoomAccessService`.
- DTO trong `modules/rooms/dto/`.

---

## 4. Test (viết trước)

| Đối tượng | Case |
|---|---|
| `can()` | HOST được mọi action; MEMBER bị từ chối mọi action |
| `assertRoomPermission` | MEMBER + action HOST → 403 |
| Tạo phòng | người tạo thành HOST, `memberCount = 1`; `joinCode` trùng → sinh lại; tạo member lỗi → room bị xoá |
| Join | sai mã → 404; phòng đã giải tán → 404; đã là thành viên → trả room, không tăng count; vượt rate limit → 429 |
| Sửa phòng | MEMBER → 403 |
| Kick | MEMBER gọi → 403; tự kick → 400; người không có trong phòng → 404; thành công → count giảm 1 |
| Rời phòng | HOST → 400; MEMBER → count giảm 1 |
| Giải tán | MEMBER → 403; HOST → status DISSOLVED |

---

## 5. Ngoài phạm vi spec này — ghi vào progress khi làm tới

- **Thu hồi socket** của người bị kick/rời phòng khỏi kênh `room:{roomId}` → làm khi có chat gateway.
- **Kết thúc meeting ACTIVE khi giải tán** (`EndReason.ROOM_DISSOLVED`) → làm khi có module meeting.
- **Frontend dùng bảng quyền** → chốt ở Task 9. Frontend chỉ ẩn/hiện nút, backend vẫn quyết định.
- **Import/export thành viên** `[GVHD-verbal]` (§13) → Task 8. Chỉ HOST (`IMPORT_MEMBERS`, `EXPORT_MEMBERS`). Hướng đã chốt: import email → thêm thẳng user đã có tài khoản làm MEMBER, email chưa đăng ký báo lỗi ở bước review (không gửi mail). Định dạng file, bước review, validate từng dòng chốt khi làm Task 8.

---

## 6. Hướng mở rộng — chưa làm, ghi lại để phát triển sau

**Mời thành viên qua email** `[phát sinh — ý tưởng mở rộng, không có trong đề cương]` (ghi 2026-09-26)
- **Ý tưởng:** HOST import danh sách email → hệ thống gửi mail chứa link mời → user bấm link, đăng nhập **đúng email được mời** thì vào phòng.
- **Khác mã phòng ở đâu:** mã phòng là "chìa khoá" ai có cũng dùng được; link mời gắn với một email cụ thể, người khác cầm link không dùng được.
- **Lưu ý:** chỉ tăng bảo mật thật nếu có thêm tuỳ chọn tắt tham gia bằng mã (phòng đóng); nếu không, người có mã vẫn vào được song song.
- **Cần thêm khi làm:** collection `invitations` (roomId, email, hash token, hạn dùng, trạng thái); endpoint chấp nhận lời mời; module `mail` tách `ports/` + `adapters/` (ràng buộc 9); dependency gửi mail (cần duyệt); container nhận mail cho dev.
- **Trường hợp phải xử lý:** đăng nhập bằng email khác email được mời, link hết hạn, phòng đã giải tán, mời lại người đã bị kick, mail vào spam.
- **Quan hệ với Task 8:** Task 8 hiện làm theo hướng đơn giản — import email → thêm thẳng user đã có tài khoản vào phòng. Luồng mời qua email là luồng riêng, làm sau không phá Task 8.
