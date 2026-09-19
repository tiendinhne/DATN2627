# DATN 2627 - Frontend Auth Demo

Ứng dụng demo hoàn chỉnh về xác thực (Authentication) được xây dựng với **Next.js 16** kết hợp với **NestJS** backend.

## 🚀 Tính Năng

### 1. Đăng Ký (Register)
- Tạo tài khoản mới với email, tên đăng nhập và mật khẩu
- Validasi mật khẩu (minimum 6 ký tự, kiểm tra khớp)
- Tự động lưu token và đăng nhập sau khi đăng ký thành công
- Route: `/register`

### 2. Đăng Nhập (Login)
- Đăng nhập với email hoặc tên đăng nhập + mật khẩu
- Lựa chọn đăng nhập với Google OAuth
- Tự động lưu token trong localStorage
- Route: `/login`

### 3. Google OAuth
- Đăng nhập nhanh chóng với tài khoản Google
- Callback handler tự động xử lý redirect từ backend
- Route: `/auth/callback` (xử lý Google redirect)

### 4. Dashboard/Profile
- Hiển thị thông tin cá nhân sau khi đăng nhập
- Hiển thị user ID, email, tên đăng nhập, tên hiển thị
- Hiển thị access token (cho mục đích debugging)
- Nút đăng xuất
- Route: `/dashboard` (Protected)

### 5. Quản Lý Token
- Token được tự động lưu trong localStorage
- Tự động gửi token trong header `Authorization: Bearer <token>` cho mỗi request
- Auth Context quản lý trạng thái authentication trên toàn app

## 📁 Cấu Trúc Thư Mục

```
frontend/
├── app/
│   ├── layout.tsx              # Root layout với AuthProvider
│   ├── page.tsx                # Trang chủ
│   ├── login/
│   │   └── page.tsx            # Trang đăng nhập
│   ├── register/
│   │   └── page.tsx            # Trang đăng ký
│   ├── dashboard/
│   │   └── page.tsx            # Trang dashboard (protected)
│   └── auth/
│       └── callback/
│           └── page.tsx        # Google OAuth callback handler
├── src/
│   ├── context/
│   │   └── auth.context.tsx    # Auth Context & Provider
│   ├── hooks/
│   │   └── useProtectedRoute.ts # Hook để protect routes
│   └── services/
│       └── auth.service.ts     # API service
├── .env.local                  # Environment variables
└── tsconfig.json               # TypeScript config
```

## 🔧 Environment Variables

Tạo file `.env.local` trong thư mục `frontend`:

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
```

## 🎯 Backend API Endpoints

Ứng dụng frontend sử dụng các endpoint sau:

### Register
```
POST /auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "username": "username",
  "password": "password"
}

Response:
{
  "accessToken": "jwt_token_here",
  "user": {
    "id": "user_id",
    "email": "user@example.com",
    "username": "username",
    "displayName": "User Name"
  }
}
```

### Login
```
POST /auth/login
Content-Type: application/json

{
  "identifier": "email_or_username",
  "password": "password"
}

Response:
{
  "accessToken": "jwt_token_here",
  "user": { ... }
}
```

### Google Auth
```
GET /auth/google
# Redirects to Google login page

GET /auth/google/callback?code=...
# Google redirects back to frontend with token:
# http://localhost:3000/auth/callback?token=jwt_token_here
```

### Get Current User
```
GET /auth/me
Authorization: Bearer jwt_token_here

Response:
{
  "id": "user_id",
  "email": "user@example.com",
  "username": "username",
  "displayName": "User Name"
}
```

## 🚀 Chạy Ứng Dụng

### 1. Cài đặt dependencies
```bash
cd frontend
pnpm install
# hoặc
npm install
```

### 2. Chạy development server
```bash
pnpm dev
# hoặc
npm run dev
```

Frontend sẽ chạy trên: `http://localhost:3000`

### 3. Đảm bảo backend đang chạy
Backend phải chạy trên: `http://localhost:3001`

```bash
cd backend
pnpm install
pnpm start:dev
```

## 🧪 Kiểm Thử

### 1. Test Đăng Ký
1. Truy cập http://localhost:3000/register
2. Nhập email, tên đăng nhập, mật khẩu
3. Click "Đăng Ký"
4. Nếu thành công, sẽ redirect đến dashboard

### 2. Test Đăng Nhập
1. Truy cập http://localhost:3000/login
2. Nhập email/tên đăng nhập và mật khẩu
3. Click "Đăng Nhập"
4. Nếu thành công, sẽ redirect đến dashboard

### 3. Test Google OAuth
1. Truy cập http://localhost:3000/login
2. Click "Đăng nhập với Google"
3. Đăng nhập với tài khoản Google của bạn
4. Sẽ redirect về `/auth/callback` rồi đến dashboard

### 4. Test Protected Route
1. Nếu không đăng nhập, truy cập http://localhost:3000/dashboard
2. Sẽ redirect đến `/login?redirect=dashboard`

### 5. Test Logout
1. Sau khi đăng nhập, truy cập dashboard
2. Click "Đăng Xuất"
3. Token sẽ bị xóa khỏi localStorage
4. Sẽ redirect đến login

## 🔐 Security Notes

### Token Storage
- Token hiện được lưu trong **localStorage** (không an toàn 100%)
- Đối với production, nên sử dụng **httpOnly cookies** để ngăn XSS attacks
- Token có thể được truy cập bằng JavaScript, cần cẩn thận với XSS vulnerabilities

### Password
- Password phải có tối thiểu 6 ký tự
- Nên validate password strength ở backend cũng
- Không nên transmit password không encrypted (luôn dùng HTTPS)

### Google OAuth
- Cần cấu hình Google OAuth credentials trong backend
- Callback URL phải khớp với cấu hình trong Google Cloud Console

## 📝 Component Structure

### AuthContext
Quản lý toàn bộ authentication state:
- `user`: Thông tin user hiện tại
- `token`: JWT token
- `isLoading`: Trạng thái loading
- `login()`: Hàm đăng nhập
- `register()`: Hàm đăng ký
- `logout()`: Hàm đăng xuất
- `loginWithGoogle()`: Hàm đăng nhập Google

### Pages
- `/`: Trang chủ với navigation
- `/login`: Trang đăng nhập
- `/register`: Trang đăng ký
- `/dashboard`: Dashboard (protected route)
- `/auth/callback`: Google OAuth callback handler

### Hooks
- `useAuth()`: Lấy auth context
- `useProtectedRoute()`: Protect một route, auto redirect nếu chưa đăng nhập

## 🎨 UI/UX

- Sử dụng **Tailwind CSS** cho styling
- Responsive design cho mobile, tablet, desktop
- Loading states cho form submission
- Error messages hiển thị rõ ràng
- Smooth transitions và hover effects

## 🔄 Flow Diagram

```
┌─────────────┐
│  Trang Chủ  │ (/)
└──────┬──────┘
       │
       ├──→ ┌──────────────┐
       │    │ Đăng Nhập    │ (/login)
       │    └──────┬───────┘
       │           │
       │           ├──→ ┌──────────────┐
       │           │    │ Local Login  │
       │           │    └──────┬───────┘
       │           │           │
       │           │ ┌─────────┘
       │           │ │
       │           ├──→ ┌──────────────┐
       │           │    │ Google Auth  │
       │           │    └──────┬───────┘
       │           │           │
       │           └──────────┬┘
       │                      │
       │    ┌─────────────────┘
       │    │
       ├──→ ┌──────────────┐
       │    │ Đăng Ký      │ (/register)
       │    └──────┬───────┘
       │           │
       ├───────────┼───────────┐
       │           │           │
       └──────┬────┘           │
              │                │
              ├────────────────┘
              │
        ┌─────▼──────────┐
        │ Dashboard      │ (/dashboard) - Protected
        └────────────────┘
```

## 🐛 Troubleshooting

### "Cannot GET /login"
- Đảm bảo Next.js dev server đang chạy
- Kiểm tra port 3000 không bị occupied

### "API request failed"
- Đảm bảo backend đang chạy trên http://localhost:3001
- Kiểm tra `.env.local` có `NEXT_PUBLIC_API_URL` đúng không
- Kiểm tra CORS configuration trong backend

### Token không được lưu
- Kiểm tra localStorage enabled trong browser
- Mở DevTools → Application → Local Storage

### Google OAuth không hoạt động
- Kiểm tra Google Client ID cấu hình trong backend
- Kiểm tra callback URL trong Google Cloud Console
- Kiểm tra FRONTEND_URL cấu hình trong backend

## 📚 References

- [Next.js Documentation](https://nextjs.org/docs)
- [React Documentation](https://react.dev)
- [Tailwind CSS](https://tailwindcss.com)
- [JWT Authentication](https://jwt.io)
- [Google OAuth](https://developers.google.com/identity/protocols/oauth2)
