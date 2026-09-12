# Backend — DATN2627

## Chạy lần đầu

```bash
cp .env.example .env          # đổi JWT secret thành chuỗi ngẫu nhiên >= 32 ký tự
pnpm install                  # chạy ở ROOT của repo
pnpm --filter @datn/shared build
pnpm infra:up                 # mongo + redis + minio
pnpm verify:schema            # 4 phép thử schema, phải PASS hết
pnpm dev:backend
```

## Quy ước

- `core/` = hạ tầng dùng chung, không chứa nghiệp vụ
- `modules/<name>/` có `domain/` + `ports/` -> hexagonal; chỉ có `*.service.ts` -> layered
- Domain event: `meeting.ended` (nội bộ, đổi tự do)
- Realtime event: `meeting:ended` (contract với client, đổi phải sửa frontend)
- Mọi emit ra socket đi qua `core/realtime/realtime.publisher.ts`, không gọi `server.to()` rải rác
- Trước khi commit code giữ state, tự hỏi: "request tiếp theo rơi vào instance khác thì còn đúng không?"
