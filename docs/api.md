# API

> **Không bịa API.** Chỉ những endpoint dưới đây đã tồn tại hoặc đã được thống nhất. Phần còn lại là NOT DESIGNED — thiết kế khi implement module tương ứng.

## 0. Quy ước [CONFIRMED]

- JSON `camelCase`, timestamp ISO-8601 UTC
- Trả `id: string`, không để `_id` rò ra
- Pagination: `{ items, total, page, limit }`
- Error: `{ statusCode, error, message, details? }` — dùng chung cho REST và Socket.IO
- Auth: `Authorization: Bearer <accessToken>`

**[OPEN] Prefix API.** Nhánh đồng đội dùng `/auth/*`. Scaffold dùng `setGlobalPrefix('api/v1')` → `/api/v1/auth/*`. **Phải thống nhất trước khi viết frontend API client.**

## 1. Auth [IMPLEMENTED]

### POST /auth/register
Tạo tài khoản local.
- Auth: none
- Request: `{ email, username, password }` — username 3–30 ký tự `[a-zA-Z0-9_]`, password ≥ 6 ký tự
- Response: `{ accessToken, user: { id, email, username, avatar, provider } }`
- Rules: email và username đều unique; trùng → 400

### POST /auth/login
- Auth: none (qua `LocalAuthGuard`)
- Request: `{ identifier, password }` — identifier là email **hoặc** username
- Response: như register
- Rules: user chỉ đăng ký bằng Google (không có password) → login local thất bại

### GET /auth/google
Redirect sang Google. Auth: none.

### GET /auth/google/callback
- Auth: none (qua `GoogleAuthGuard`)
- Hành vi hiện tại: `res.redirect(FRONTEND_URL/auth/callback?token=...)`
- **[PLANNED] phải sửa** — token trong query string là lỗ hổng, xem `security.md` §1
- Rules account linking: đã có `googleId` → trả user đó; email trùng tài khoản local → liên kết `googleId`; hoàn toàn mới → tạo user Google không password, username tự sinh unique

### GET /auth/me
- Auth: Bearer JWT (`JwtAuthGuard`)
- Response: user document hiện tại

## 2. Health [PLANNED]

- `GET /health` — liveness, cho LB/ASG
- `GET /ready` — readiness, kiểm tra Mongo + Redis

## 3. Chưa thiết kế [NOT DESIGNED]

Rooms, room-members, meetings (gồm endpoint sinh LiveKit token), files (presigned upload/download), import/export, AI. Thiết kế khi implement module tương ứng, theo quy ước §0 và permission matrix ở `security.md`.

Ràng buộc đã biết cho meetings:
- Endpoint join meeting phải trả `{ token, livekitUrl }`, token sinh theo `toLiveKitGrant(role, mode)`, TTL 6 giờ
- Webhook LiveKit là một controller riêng, phải verify chữ ký
