# DATN2627 - RusSra
Nghiên cứu và xây dựng hệ thống bảng vẽ cộng tác thời gian thực tích hợp trợ lý AI và truyền thông đa phương tiện

## Cách chạy (sau khi vừa clone)

**Cần cài sẵn:** Docker Desktop, Node.js 22, npm (không dùng pnpm).

### 1. Tạo file env cho backend

```powershell
Copy-Item backend/.env.example backend/.env
```

Chạy local thì giữ nguyên giá trị mẫu là được. Muốn đăng nhập Google thì điền `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`.

### 2. Chạy backend (Mongo + Redis + LiveKit + backend)

```powershell
docker compose up -d --build
docker compose logs -f backend    # đợi dòng "Backend is running on: http://127.0.0.1:3001"
```

### 3. Chạy frontend

```powershell
cd frontend
npm install
npm run dev
```

Mở http://localhost:3000

### Tắt

```powershell
docker compose down     # trong thư mục gốc
```

> Không chạy `npm run start:dev` trong `backend/` cùng lúc với container backend (trùng cổng 3001).
