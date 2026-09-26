Tổng hợp các endpoint/api của toàn hệ thống

## Yêu cầu ghi file
Khi code xong module/api. phải thêm chi tiết api đó là gì, request/response ra sau. Dễ đọc dễ hình dung
Phân chia thêm từng nhóm module riêng biệt
Vd: Auth,...

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

### POST /rooms/join
Tham gia phòng bằng mã (link `/join/:code` ở frontend gọi cùng API).

| Body | Kiểu | Ràng buộc |
|---|---|---|
| code | string | 8 ký tự A–Z, 2–7 (không phân biệt hoa thường) |

- Response `200`: room response. Đã là thành viên thì trả luôn, không tính thêm.
- `404`: sai mã **hoặc** phòng đã giải tán (cùng thông báo).
- `429`: quá 10 lần/phút mỗi user (Redis `ratelimit:join:{userId}`).

### GET /rooms
Phòng của tôi (chỉ phòng đang hoạt động), mới tham gia trước.

| Query | Kiểu | Mặc định | Ghi chú |
|---|---|---|---|
| page | number | 1 | 1–1000 |
| limit | number | 20 | 1–50 |

Response `200`: `{ items: RoomResponse[], page, limit, hasMore }`.

### GET /rooms/:roomId
Chi tiết phòng. Quyền: thành viên. Mọi thành viên đều thấy `joinCode` để chia sẻ.
Response `200`: room response. `404` phòng không tồn tại / đã giải tán; `403` không phải thành viên.

### PATCH /rooms/:roomId
Sửa phòng. Quyền: HOST.

| Body | Kiểu | Ràng buộc |
|---|---|---|
| name | string | tuỳ chọn, 1–100 ký tự (đã trim), không nhận `null` |
| description | string | tuỳ chọn, ≤ 500 ký tự, không nhận `null` (gửi `""` để xoá mô tả) |

Phải có ít nhất 1 field (không thì `400`). `403` nếu không phải HOST. Response `200`: room response.

### GET /rooms/:roomId/members
Danh sách thành viên, HOST đứng đầu rồi theo thời gian vào phòng. Quyền: thành viên.
Response `200`: `[{ userId, displayName, avatarUrl, role, joinedAt }]`.

### DELETE /rooms/:roomId/members/me
Tự rời phòng. Quyền: thành viên không phải HOST.
- Response `204`.
- `400`: HOST gọi — HOST không rời được, chỉ giải tán (ADR-020).

### DELETE /rooms/:roomId/members/:userId
Kick thành viên (xoá khỏi phòng, người đó nhập lại mã vẫn vào được — ADR-020). Quyền: HOST.
- Response `204`.
- `400`: `userId` sai định dạng, hoặc tự kick chính mình.
- `403`: không phải HOST. `404`: người đó không có trong phòng.

## Chat (thiết kế — chưa code)

### GET /rooms/:roomId/messages
Lấy lịch sử chat của room, mới nhất trước.

| Query | Kiểu | Mặc định | Ghi chú |
|---|---|---|---|
| before | messageId | — | cursor: lấy tin cũ hơn tin này |
| limit | number | 50 | tối đa 100 |
| meetingId | ObjectId | — | có thì chỉ lấy tin của meeting đó |

Quyền: thành viên room.
Response: `{ items: [{ id, roomId, meetingId, meetingTitle?, senderId, senderName, type, content, fileId, createdAt }], nextCursor }`
