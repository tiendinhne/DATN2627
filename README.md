# DATN2627 — Hệ thống học nhóm trực tuyến (WebRTC + AI Whiteboard)

## Cấu trúc

```
DATN2627/
├── shared/      contract dùng chung (enum, event envelope, permission, lww-merge)
├── backend/     NestJS — REST + Socket.IO + LiveKit + AI
├── frontend/    Next.js (tạo ở bước sau)
└── docker/      mongo + redis + minio (dev)
```

## Chạy lần đầu

```bash
pnpm install
pnpm build:shared

cp .env.example .env
cp backend/.env.example backend/.env      # đổi JWT secret thành chuỗi ngẫu nhiên >= 32 ký tự

pnpm infra:up            # mongo + redis + minio
pnpm verify:schema       # 4 phép thử schema — phải PASS hết trước khi code tiếp
pnpm dev:backend
```

## Dev local: dùng 2 hostname khác nhau

Thêm vào `/etc/hosts` (Windows: `C:\Windows\System32\drivers\etc\hosts`):

```
127.0.0.1  app.localhost
127.0.0.1  api.localhost
```

Frontend chạy ở `app.localhost:3000`, backend ở `api.localhost:4000`.

Nếu dev bằng `localhost` cho cả hai thì là **cùng origin**, vấn đề cookie cross-origin
sẽ giấu mặt cho tới lúc deploy Vercel mới lộ — và lúc đó phải viết lại toàn bộ auth client.
