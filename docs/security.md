# Security

## 1. Authentication

**[IMPLEMENTED]** — nhánh đồng đội
- Register / login local qua Passport `LocalStrategy` (identifier = email hoặc username)
- `JwtStrategy` với `ExtractJwt.fromAuthHeaderAsBearerToken()`
- Google OAuth qua `passport-google-oauth20`, có **account linking**: email trùng tài khoản local → liên kết `googleId` vào tài khoản đó
- Password hash `bcryptjs`, `select: false` trên field password
- `googleId` unique + `sparse: true`
- `providers[]` hỗ trợ đa provider

**[PLANNED] — phải sửa**
- **Refresh token rotation.** Hiện chỉ có một JWT sống 7 ngày → không logout được, không revoke được, token lộ thì dùng cả tuần. Chốt: access token 15m + refresh token rotate, lưu **hash** trong Mongo (`refresh_tokens`) với TTL index. Lưu hash để verify được ở mọi instance → stateless-friendly.
- **Google callback không trả token qua query string.** Hiện `res.redirect(...?token=...)` → token vào browser history, access log NGINX, header `Referer`. Chốt: one-time code ngắn hạn (60s, lưu Redis) rồi frontend đổi lấy token qua POST; hoặc set cookie httpOnly rồi redirect không kèm gì.

## 2. Token storage [CONFIRMED]

- Access token giữ **trong memory**, không localStorage
- Refresh token trong cookie `Domain=.<domain>; Secure; HttpOnly; SameSite=None`
- Frontend `app.<domain>` và backend `api.<domain>` là **hai origin khác nhau** → CORS whitelist chính xác (kể cả preview URL Vercel), Socket.IO `withCredentials: true`
- Dev local bắt buộc 2 hostname, nếu không vấn đề cross-origin bị giấu tới lúc deploy

## 3. Permission matrix [CONFIRMED — IMPLEMENTED trong `shared/`]

Biểu diễn dưới dạng **dữ liệu** (bảng tra), không phải chuỗi if-else. Dùng chung backend (enforce) và frontend (ẩn/hiện UI).

| Hành động | HOST | CO_HOST | MEMBER | VIEWER |
|---|:--:|:--:|:--:|:--:|
| Dissolve room | ✅ | ❌ | ❌ | ❌ |
| Đổi role | ✅ | ❌ | ❌ | ❌ |
| Quản lý / kick member | ✅ | ✅ | ❌ | ❌ |
| Import members / Export | ✅ | ✅ | ❌ | ❌ |
| Tạo / kết thúc meeting | ✅ | ✅ | ❌ | ❌ |
| Publish media, screen share | ✅ | ✅ | ✅¹ | ❌ |
| Chat | ✅ | ✅ | ✅ | ✅ |
| Vẽ whiteboard | ✅ | ✅ | ✅¹ | ❌ |
| Xoá element người khác / clear board | ✅ | ✅ | ❌ | ❌ |
| Gọi AI generate | ✅ | ✅ | ✅¹ | ❌ |
| Upload file | ✅ | ✅ | ✅¹ | ❌ |

¹ Ở `LECTURE` mode, MEMBER bị hạ xuống quyền VIEWER cho các mục này.

**Enforce ở backend**, cả REST guard lẫn Socket.IO handler. Frontend chỉ ẩn/hiện UI.

**Role map thẳng sang LiveKit token grant** (`canPublish: false` cho VIEWER) → quyền media enforce ngay ở SFU, không chỉ ẩn nút ở UI. Đây là điểm đáng nêu trong báo cáo.

## 4. Input validation (yêu cầu GVHD) [CONFIRMED]

Bắt buộc ở **mọi** entry point, không ngoại lệ:

| Entry point | Cơ chế |
|---|---|
| REST API | `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })` + DTO |
| **Socket.IO event** | DTO + validate thủ công — `ValidationPipe` **không tự áp cho gateway** |
| File upload / import | đuôi file, MIME, kích thước, số dòng, schema từng dòng |
| AI response | Zod schema — LLM cũng là untrusted input |
| LiveKit webhook | **verify chữ ký** |
| Query phân trang | `limit` có max, `page` ≥ 1, `sort` whitelist tên trường |
| MongoDB query | chặn NoSQL injection, không truyền object thô từ user |
| Env | **Zod fail-fast** — thiếu biến thì app không khởi động |

Format lỗi thống nhất cho cả REST và Socket.IO:

```jsonc
{
  "statusCode": 400,
  "error": "VALIDATION_ERROR",
  "message": "Dữ liệu không hợp lệ",
  "details": [ { "field": "email", "constraint": "Email không đúng định dạng" } ]
}
```

Frontend hiển thị lỗi **ngay tại field**, không chỉ toast chung.

## 5. Các mục khác [CONFIRMED]

- LiveKit API key/secret và AI API key **chỉ ở backend env**
- LiveKit webhook **verify chữ ký** — không verify thì ai cũng giả webhook để đá người khác khỏi meeting
- Socket.IO auth qua handshake (`auth.token`), **không qua query string**; re-check membership mỗi lần join room
- Rate limit **trong Redis** (không in-memory): login, brute-force join code, AI request (5/user/phút, 20/meeting/giờ), whiteboard op size, import
- Join code 8 ký tự base32, không tuần tự
- HTTPS bắt buộc — `getUserMedia` chỉ chạy trên secure context
- CORS whitelist chính xác, không `*`; Helmet; giới hạn body size
- File tải về bằng **presigned URL có hạn** (~15 phút), không public bucket
