Tổng hợp các endpoint/api của toàn hệ thống

## Yêu cầu ghi file
Khi code xong module/api. phải thêm chi tiết api đó là gì, request/response ra sau. Dễ đọc dễ hình dung
Phân chia thêm từng nhóm module riêng biệt
Vd: Auth,...

## Auth

Hai loại token (ADR-023):
- **Access token** — JWT 15 phút (`JWT_EXPIRES_IN`), trả trong body, frontend chỉ giữ trong memory, gửi bằng header `Authorization: Bearer <accessToken>`.
- **Refresh token** — 7 ngày, **chỉ nằm trong cookie** `refresh_token` (`HttpOnly; SameSite=Lax; Path=/auth`, thêm `Secure` khi production). Không bao giờ có trong body. Mongo chỉ lưu hash (`refresh_tokens`).

Request đặt / gửi cookie phải có `credentials: 'include'` (CORS đã bật `credentials`).

**User response:** `{ id, email, username, displayName, avatarUrl, provider }`.

### POST /auth/register
Body: `{ email, username (3–30, chữ / số / _), displayName (1–20), password (≥ 6) }`.
- `201`: `{ accessToken, user }` + `Set-Cookie: refresh_token=…`.
- `400`: validate sai, email hoặc username đã dùng.

### POST /auth/login
Body: `{ identifier, password }` — `identifier` là email hoặc username.
- `201`: `{ accessToken, user }` + `Set-Cookie: refresh_token=…`.
- `401`: sai tài khoản / mật khẩu.

### POST /auth/refresh
Không body; đọc cookie `refresh_token`. Frontend gọi khi tải trang và trước khi access token hết hạn 60 giây.
- `200`: `{ accessToken, user }` + cookie mới (**xoay vòng**: token cũ bị thu hồi, `replacedByTokenHash` trỏ token mới).
- `200` **không có** `Set-Cookie`: token vừa bị xoay vòng trong 10 giây (2 tab / Strict Mode refresh cùng lúc) → chỉ cấp access token, cookie trình duyệt đã là token mới.
- `401`: không có cookie, sai định dạng, không tồn tại, hết hạn, bị thu hồi do đăng xuất, hoặc bị xoay vòng quá 10 giây.

### POST /auth/logout
Không body; đọc cookie `refresh_token`.
- `204`: thu hồi refresh token (nếu có) + xoá cookie. Gọi lại / không có cookie vẫn `204`. Access token đã cấp vẫn dùng được tới khi hết hạn (≤ 15 phút).

### GET /auth/me
Header `Authorization: Bearer <accessToken>` → `200` thông tin user; `401` token sai / hết hạn.

### PATCH /auth/me
Header `Authorization: Bearer <accessToken>`. Body: `{ displayName }` — trim khoảng trắng, 1–20 ký tự.
- `200`: `{ id, email, username, displayName, avatarUrl }` đã cập nhật.
- `400`: tên hiển thị rỗng, quá dài hoặc sai kiểu. `401`: token sai / hết hạn. `404`: tài khoản không còn tồn tại.

### GET /auth/google, GET /auth/google/callback
Chỉ hoạt động khi có `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`. Callback đặt cookie `refresh_token` rồi chuyển về `<FRONTEND_URL>/auth/callback` **không kèm token trên query** (PROJECT_CONTEXT §16); frontend lấy access token bằng `POST /auth/refresh`.

## Rooms

Mọi endpoint cần header `Authorization: Bearer <accessToken>`. Lỗi validate → 400.
Rời phòng / kick / giải tán: lỗi khi gọi LiveKit **không** đổi mã trả về (vẫn `204`) — chỉ ghi log.

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

### GET /rooms/:roomId/members/search?q=...
Tìm user theo tiền tố email hoặc username để HOST chọn thêm vào phòng. Chỉ trả tối đa 10 kết quả và loại user đã là thành viên.

| Query | Kiểu | Ràng buộc |
|---|---|---|
| q | string | trim, 2–100 ký tự |

- Response `200`: `[{ id, email, username, displayName, avatarUrl }]`.
- `400`: query không hợp lệ. `403`: không phải HOST.

### POST /rooms/:roomId/members
Thêm một người **đã có tài khoản** vào phòng bằng email, với role MEMBER (`invitedBy` = HOST). Quyền: HOST.

| Body | Kiểu | Ràng buộc |
|---|---|---|
| email | string | email hợp lệ; tự trim + chữ thường |

- Response `201`: `{ userId, displayName, avatarUrl, role, joinedAt }` (cùng dạng một phần tử của `GET /members`).
- `400`: email sai định dạng. `403`: không phải HOST.
- `404`: email chưa đăng ký tài khoản (không gửi mail mời). `409`: người đó đã ở trong phòng.

### DELETE /rooms/:roomId/members/me
Tự rời phòng. Quyền: thành viên không phải HOST.
- Response `204`.
- `400`: HOST gọi — HOST không rời được, chỉ giải tán (ADR-020).
- Đang ở trong buổi học → bị đưa ra khỏi cuộc gọi.

### DELETE /rooms/:roomId/members/:userId
Kick thành viên (xoá khỏi phòng, người đó nhập lại mã vẫn vào được — ADR-020). Quyền: HOST.
- Response `204`.
- `400`: `userId` sai định dạng, hoặc tự kick chính mình.
- `403`: không phải HOST. `404`: người đó không có trong phòng.
- Người bị kick đang ở trong buổi học → bị đưa ra khỏi cuộc gọi; vào lại bằng token cũ cũng bị đưa ra (webhook kiểm thành viên).

### POST /rooms/:roomId/dissolve
Giải tán phòng: `status = DISSOLVED`, `dissolvedAt = now`. Quyền: HOST.
- Response `204`.
- `403`: không phải HOST.
- Sau khi giải tán: mọi endpoint theo `roomId` trả `404`, join bằng mã trả `404`. `room_members` được giữ làm lịch sử.
- Buổi học đang diễn ra kết thúc với `ROOM_DISSOLVED`, mọi người bị ngắt khỏi cuộc gọi.

## Meetings

Mọi endpoint REST cần header `Authorization: Bearer <accessToken>`. `roomId` / `meetingId` sai định dạng → `400`. Không gọi được LiveKit → `502` "Không kết nối được máy chủ media" (không đổi trạng thái gì).

**Meeting response:** `{ id, roomId, title, status, createdBy, startedAt, endedAt, endReason, peakParticipants, totalParticipants, messageCount, durationSeconds }` — `status`: `ACTIVE` | `ENDED`; `endReason`: `HOST_ENDED` | `AUTO_EMPTY` (hệ thống tự kết thúc: phòng trống 3 phút hoặc media server dừng) | `ROOM_DISSOLVED` | `null`.

### POST /rooms/:roomId/meetings
Bắt đầu buổi học. Quyền: HOST.

| Body | Kiểu | Ràng buộc |
|---|---|---|
| title | string | bắt buộc, 1–100 ký tự (đã trim) — HOST bỏ trống thì frontend gửi "Buổi học dd/MM HH:mm" (giờ lúc bấm) |

- Response `201`: meeting response (`status: ACTIVE`).
- `403`: không phải HOST. `404`: phòng không tồn tại / đã giải tán.
- `409`: phòng đang có buổi học diễn ra. Meeting cũ còn ACTIVE trong DB nhưng room LiveKit đã đóng → tự chốt meeting cũ (`AUTO_EMPTY`) rồi tạo mới, không trả 409.

### GET /rooms/:roomId/meetings
Lịch sử buổi học, mới nhất trước (buổi đang diễn ra đứng đầu). Quyền: thành viên.

| Query | Kiểu | Mặc định | Ghi chú |
|---|---|---|---|
| page | number | 1 | 1–1000 |
| limit | number | 20 | 1–50 |

Response `200`: `{ items: MeetingResponse[], page, limit, hasMore }`.

### POST /meetings/:meetingId/join
Vào buổi học — cấp token LiveKit mới mỗi lần gọi. Quyền: thành viên phòng của meeting.

- Response `200`: `{ token, livekitUrl, myRole, meeting }` — `livekitUrl` là địa chỉ LiveKit cho trình duyệt (dev `ws://localhost:7880`); token: `identity = userId`, `name = displayName`, `room = meetingId`, mọi thành viên cùng quyền publish + subscribe, **không** gửi data qua LiveKit (`canPublishData: false`), hạn `LIVEKIT_TOKEN_TTL_HOURS` giờ.
- `403`: không phải thành viên. `404`: meeting không tồn tại / phòng đã giải tán.
- `409`: buổi học đã kết thúc (kể cả khi DB còn ACTIVE nhưng room LiveKit đã đóng — tự chốt meeting).

### POST /meetings/:meetingId/end
Kết thúc buổi học cho mọi người: chốt `ENDED` (`HOST_ENDED`), đóng room LiveKit → mọi người bị ngắt. Quyền: HOST.
- Response `204`. **Idempotent**: buổi đã kết thúc vẫn trả `204` (không ghi đè `endedAt`) — dùng được khi meeting bị kẹt.
- `403`: không phải HOST. `404`: meeting không tồn tại. `502`: không đóng được room LiveKit — bấm lại.

### POST /webhooks/livekit
Webhook của LiveKit (không dành cho client). Không dùng JWT — xác thực bằng chữ ký: header `Authorization` là JWT chứa sha256 của raw body; `Content-Type: application/webhook+json`.

| Mã | Khi nào |
|---|---|
| `200` | xử lý xong, **hoặc** bỏ qua có chủ đích: room không phải meeting (room tạo bằng `lk`), identity không phải userId (bot load-test), không có meeting, event không quan tâm, người không còn là thành viên (đã bị đưa ra khỏi room) |
| `401` | sai / thiếu chữ ký |
| `500` | lỗi bất ngờ (Mongo, Redis, LiveKit API) → LiveKit gửi lại; mọi bước idempotent |

Event xử lý: `participant_joined` (ghi session theo `sid`, presence, `$max` peak; không còn là thành viên / meeting đã kết thúc → `removeParticipant`), `participant_left` + `participant_connection_aborted` (đóng session theo `sid`), `room_finished` (chốt meeting `AUTO_EMPTY` / `ROOM_DISSOLVED` — ADR-022).

## Chat

### GET /rooms/:roomId/messages
Lấy lịch sử chat của room, mới nhất trước.

Header: `Authorization: Bearer <accessToken>`.

| Query | Kiểu | Mặc định | Ghi chú |
|---|---|---|---|
| before | messageId | — | cursor: lấy tin cũ hơn tin này |
| limit | number | 50 | tối đa 100 |
| meetingId | ObjectId | — | có thì chỉ lấy tin của meeting đó; Meeting phải thuộc room |

Quyền: thành viên room.
Response: `{ items: [{ id, roomId, meetingId, meetingTitle?, senderId, senderName, type, content, fileId, file, createdAt }], nextCursor }`. `file` là metadata `{ id, originalName, mimeType, sizeBytes }` hoặc `null`; response không chứa object key hay URL tải xuống.

### POST /rooms/:roomId/uploads
Cấp quyền PUT file trực tiếp lên Object Storage; không gửi nội dung file qua Backend.

Header: `Authorization: Bearer <accessToken>`.

```json
{
  "originalName": "lecture.pdf",
  "mimeType": "application/pdf",
  "sizeBytes": 123456,
  "meetingId": "665e..."
}
```

`meetingId` tuỳ chọn; nếu gửi, Backend kiểm tra Meeting đang ACTIVE, thuộc room và user đang có mặt trong Meeting. MIME và phần mở rộng phải khớp danh sách hỗ trợ: JPEG, PNG, WebP, GIF, PDF, TXT, CSV, DOC/DOCX, XLS/XLSX, PPT/PPTX. Dung lượng 1 byte–20 MiB.

Response `201`:

```json
{
  "file": { "id": "665f...", "originalName": "lecture.pdf", "mimeType": "application/pdf", "sizeBytes": 123456, "status": "PENDING" },
  "upload": { "method": "PUT", "url": "https://storage.example/...", "headers": { "Content-Type": "application/pdf" }, "expiresInSeconds": 300 }
}
```

Frontend dùng `fetch(upload.url, { method: "PUT", headers: upload.headers, body: file })`. Không tự đặt `Content-Length`; trình duyệt lấy kích thước từ `File`. URL chỉ dùng được với đúng MIME/size đã ký. Bucket cần CORS cho origin Frontend và method `PUT`.

### POST /rooms/:roomId/uploads/:fileId/complete
Gọi sau khi PUT thành công. Backend dùng `HeadObject` kiểm tra object tồn tại, dung lượng/MIME khớp rồi chuyển metadata từ `PENDING` sang `READY`. Chỉ file `READY` mới được đính kèm hoặc tải xuống. Retry endpoint này là idempotent.

Response `200`: `{ id, originalName, mimeType, sizeBytes, status: "READY" }`.

### GET /rooms/:roomId/files/:fileId/download-url
Kiểm tra thành viên Room và cấp presigned GET URL sống 15 phút cho file `READY`.

Response `200`: `{ url, expiresInSeconds: 900 }`. URL được ký để ảnh hiển thị inline; loại file khác tải xuống dạng attachment. Bucket luôn private.

### Socket.IO chat
Kết nối namespace `/meeting` với `transports: ["websocket"]` và JWT trong `auth.token` (không truyền token trong query). Gửi `room:subscribe { roomId }` trước khi nhận chat; Backend chỉ join socket sau khi xác thực JWT và kiểm tra thành viên Room.

`chat:send` nhận `{ roomId, clientMsgId, content?, fileId?, meetingId? }`. Phải có `content` hoặc `fileId`; `clientMsgId` là UUID để chống tạo trùng khi reconnect. Khi gửi file, upload và gọi `complete` trước; tin nhắn có `type: "FILE"`, ảnh nhận biết bằng `file.mimeType`. Backend kiểm lại quyền Room, quyền Meeting, quyền sở hữu file và trạng thái `READY` trước khi ghi Mongo.

Sau khi lưu thành công, server phát đúng một `chat:new` vào `room:{roomId}`:

```json
{
  "v": 1, "seq": 12, "ts": "2026-10-27T07:00:00.000Z",
  "actorId": "665f...", "roomId": "665d...", "meetingId": null,
  "data": { "message": { "id": "665f...", "type": "FILE", "fileId": "665a...", "file": { "id": "665a...", "originalName": "lecture.pdf", "mimeType": "application/pdf", "sizeBytes": 123456 } } }
}
```

`meetingId` được Backend kiểm tra rồi mới lưu; tin nhắn vẫn thuộc luồng Room. Client lọc theo `meetingId` để hiển thị khung chat Meeting. Sự kiện chỉ mang nội dung tin nhắn và metadata, không mang bytes hay URL tải file. Lỗi quyền/validate phát qua event `error` `{ statusCode, error, message }`.

Khi thành viên rời/bị kick hoặc Room giải tán, server phát `room:access_revoked` (envelope chuẩn, `data.reason` là `LEFT`, `KICKED` hoặc `DISSOLVED`) rồi buộc các socket trên mọi Backend instance rời `room:{roomId}` qua Redis Adapter.

### Cấu hình Object Storage
Tạo bucket Amazon S3 riêng và đặt `AWS_REGION` cùng `S3_BUCKET` trong `backend/.env` (giá trị thật phụ thuộc AWS account; không dùng các placeholder trong `.env.example`). Bucket phải private. Adapter dùng AWS SDK for JavaScript v3 với credential provider chain mặc định; không cấu hình endpoint hay key/secret trong source.

- **Development:** khi chạy bằng Compose, đặt `AWS_ACCESS_KEY_ID` và `AWS_SECRET_ACCESS_KEY` (cùng `AWS_SESSION_TOKEN` nếu là credentials tạm thời) trong file `.env` ở root repo; Compose chỉ chuyển chúng vào container Backend, không chuyển sang LiveKit. File `.env` bị gitignore, không commit. Chỉ dùng credentials giới hạn quyền trong bucket test.
- **Production trên AWS:** ưu tiên IAM Role/Task Role gắn với workload, không truyền access key tĩnh. Cấp tối thiểu `s3:PutObject` và `s3:GetObject` trên `arn:aws:s3:::<bucket>/chat/*`; không cấp quyền public hoặc `ListBucket` nếu không cần.
- Cấu hình CORS của bucket cho đúng Frontend origin, methods `PUT` và `GET`, allowed header `Content-Type`. Ví dụ development dùng `http://localhost:3000`; production thay bằng origin HTTPS thực tế. Không bật public access.

Docker Compose không khởi chạy dịch vụ lưu trữ local; Backend gọi Amazon S3 trực tiếp. File đã upload vào MinIO trước đây không tự được sao chép sang S3, và dữ liệu/bucket cũ không bị xóa bởi thay đổi này. Nếu có file cần giữ, phải lập kế hoạch copy sang bucket S3 và cập nhật metadata trước khi ngừng nguồn cũ.

### Tích hợp Frontend nhanh
Frontend hiện cần `socket.io-client` để kết nối (chưa thêm dependency ở task Backend này). Dùng access token đang giữ trong memory:

```ts
const socket = io(`${API_URL}/meeting`, {
  transports: ['websocket'],
  auth: { token: accessToken },
});
socket.emit('room:subscribe', { roomId });
socket.on('chat:new', ({ data }) => addMessage(data.message));
socket.on('room:access_revoked', () => leaveRoomView());
```

Khi gửi file: gọi API tạo upload → PUT `File` vào `upload.url` với `upload.headers` → gọi API `complete` → gửi `chat:send` kèm `fileId` và `clientMsgId: crypto.randomUUID()`. Khi render ảnh/tải file, gọi `download-url` theo `fileId` rồi dùng `url` trả về; URL hết hạn sau 15 phút nên chỉ yêu cầu khi cần hiển thị/tải.
