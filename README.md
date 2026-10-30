# DATN2627 - RusSra
Nghiên cứu và xây dựng hệ thống bảng vẽ cộng tác thời gian thực tích hợp trợ lý AI và truyền thông đa phương tiện

## Cách chạy (sau khi vừa clone)

**Cần cài sẵn:** Docker Desktop. (Node.js 22 + npm chỉ cần khi chạy test hoặc debug ngoài Docker; không dùng pnpm.)

### 1. Tạo file env cho backend

```powershell
Copy-Item backend/.env.example backend/.env
```

Chạy local thì giữ nguyên giá trị mẫu là được. Muốn đăng nhập Google thì điền `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`.

### 2. Chạy cả hệ thống (Mongo + Redis + LiveKit + backend + frontend)

```powershell
docker compose up -d --build
docker compose logs -f frontend   # đợi dòng "Ready", Ctrl+C để thoát xem log
```

Mở http://localhost:3000

- Sửa code trong `backend/src`, `frontend/src` → tự reload. Sửa `package.json`, file cấu hình, `public/` → chạy lại lệnh trên.
- Lần đầu mở mỗi trang phải chờ compile (trang buổi học ~2 phút, lần sau vài giây). Trước khi demo nên mở trước một lượt.

### Tắt

```powershell
docker compose down     # trong thư mục gốc
```

> Không chạy `npm run start:dev` (backend) hoặc `npm run dev` (frontend) ngoài Docker cùng lúc với container (trùng cổng 3001 / 3000).
