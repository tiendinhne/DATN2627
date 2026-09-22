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

### Token không được lưu
- Kiểm tra localStorage enabled trong browser
- Mở DevTools → Application → Local Storage