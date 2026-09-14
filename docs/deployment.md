# Deployment & Infrastructure

Trạng thái: `docker-compose.dev.yml` **[IMPLEMENTED]** (mongo + redis + minio). Phần còn lại **[PLANNED]**.

## 1. Phân bổ hạ tầng [CONFIRMED]

| Thành phần | Nơi chạy | Chi phí |
|---|---|---|
| Frontend (Next.js) | **Vercel Hobby** | miễn phí, HTTPS + CDN + custom domain |
| Backend ×2–3 + NGINX LB | VPS / cloud VM | xem §2 |
| LiveKit SFU + TURN | cùng VPS | |
| MongoDB | Atlas M0 free (512 MB) hoặc self-host | miễn phí |
| Redis, MinIO | self-host container | miễn phí |
| Object storage prod | Cloudflare R2 free (10 GB) | miễn phí |
| Domain `.site` / `.cloud` | hostinger.vn | ~1 USD/năm |
| TLS | Let's Encrypt + Vercel tự lo | miễn phí |

## 2. Chọn host — yếu tố quyết định là EGRESS, không phải CPU [CONFIRMED]

| Phương án | Egress miễn phí | Nhận xét |
|---|---|---|
| Oracle Cloud Always Free (2 OCPU / 12 GB ARM) | rất rộng (mức TB/tháng) | tốt nhất về giá; rủi ro hết capacity ARM, chính sách đổi không báo trước |
| AWS EC2 | **chỉ 100 GB/tháng** | ≈ **5 giờ** meeting 10 người. Không làm host chính cho SFU |
| VPS giá rẻ (~5 USD/tháng) | vài TB/tháng | ổn định nhất |

**Chiến lược lai:** host chính chạy backend ×2–3 + NGINX + Redis + LiveKit (môi trường demo và benchmark). **AWS chỉ dùng cho E5** — ALB + Auto Scaling Group cho **backend** (không phải SFU), chạy ngắn hạn rồi tắt.

**Không để buổi bảo vệ phụ thuộc free tier.** Trước bảo vệ ≥2 tuần chuyển sang VPS trả phí.

**[OPEN]** Chốt host chính: Oracle Always Free hay VPS trả phí — cần trước Giai đoạn 0.

## 3. Docker Compose [PLANNED]

```
nginx          ← load balancer + TLS
backend-1/2/3  ← cùng image, khác INSTANCE_ID
redis
mongodb
livekit        ← network_mode: host
(tuỳ chọn) prometheus, grafana, node-exporter, cadvisor
```

`docker-compose.dev.yml` hiện có: mongo + redis + minio.

## 4. NGINX [PLANNED]

```nginx
upstream backend_pool {
    server backend-1:4000;
    server backend-2:4000;
    server backend-3:4000;
    # KHÔNG dùng ip_hash — xem ADR-006
}
```

Điểm chính: `proxy_set_header Upgrade` / `Connection "upgrade"` cho `/socket.io`; `proxy_read_timeout` đủ dài (~3600s); không buffer WS; `client_max_body_size` đủ cho upload.

## 5. Environment variables

Validate bằng Zod (`config/env.schema.ts`) — **fail fast**, thiếu biến thì app không khởi động.

Nhóm biến: `NODE_ENV, PORT, INSTANCE_ID` · `MONGODB_URI` · `REDIS_*` · `JWT_*` · `CORS_ORIGINS` · `LIVEKIT_*` · `STORAGE_*` · `AI_PROVIDER, GEMINI_API_KEY, AI_TIMEOUT_MS` · `WB_PERSIST_*`, `WB_OPS_BUFFER_SIZE` · `MEETING_AUTO_END_AFTER_MIN`.

`NEXT_PUBLIC_*` của Next.js được **inline lúc build** → URL backend/LiveKit phải biết trước khi build trên Vercel, không đổi runtime được.

## 6. Observability [PLANNED]

LiveKit Prometheus endpoint (có sẵn) · node-exporter + cAdvisor · Grafana · pino JSON với `requestId` / `meetingId` / **`instanceId`**.

`instanceId` là **bắt buộc** — không có nó thì không chứng minh được load balancer phân phối đều (E3). Dựng ngay sau bước LiveKit integration, không để tới cuối.

## 7. CI/CD [PLANNED]

GitHub Actions: lint → test → build image → deploy qua SSH. Frontend Vercel tự deploy khi push.

Vercel cần cấu hình khi có workspace: Root Directory = `frontend`, Install Command chạy từ root để pnpm resolve được `shared`. Làm sớm, đừng để tuần cuối mới deploy lần đầu.
