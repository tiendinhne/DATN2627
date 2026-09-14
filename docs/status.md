# Status, TODO, Open Questions, Context Gaps

Cập nhật: 09/2026. **Không suy đoán ngoài file này.**

## 1. Implementation status

### [IMPLEMENTED] — nhánh đồng đội (`feature/project-structure`)
- Auth module: register, login local (Passport LocalStrategy), Google OAuth + account linking, JwtStrategy, 3 guards, DTO class-validator có message tiếng Việt
- Users module + service (findByEmail/Username/Identifier/GoogleId, createLocal/GoogleUser, linkGoogleAccount, ensureUniqueUsername)
- `User` schema: email, username, password (select:false), googleId (unique+sparse), avatar, providers[]
- Skeleton 10 module + `infrastructure/{docker,nginx,livekit,redis}` + `.github/`
- Frontend Next.js shell: `app/page.tsx`, `app/auth/callback/page.tsx`, `src/services/auth.service.ts`, feature folder skeleton
- vitest + vitest e2e config, oxlint, prettier
- ESM: `"type": "module"`, `moduleResolution: nodenext`

### [IMPLEMENTED] — nhánh còn lại (scaffold, **CommonJS**)
- `shared/`: enums, error codes, event envelope, realtime event catalog (type), permission matrix + `can()` + `toLiveKitGrant()`, `element.types`, `lww-merge` — **compile OK, 14/14 test pass**
- `config/env.schema.ts` (Zod fail-fast) + config.module
- `core/database/database.module.ts`
- `core/redis/`: RedisService (3 client: client/pub/sub), DistributedLockService (SET NX PX + Lua release)
- `core/common/`: http-exception.filter, ws-exception.filter, transform.interceptor (_id→id), logging.interceptor (instanceId), current-user.decorator
- **9 Mongoose schema** — verified load 9/9, index list đúng (gồm unique partial index cho meeting ACTIVE)
- `scripts/verify-schema.ts` (6 assertion / 4 ràng buộc)
- `docker-compose.dev.yml` (mongo + redis + minio)
- `pnpm-workspace.yaml`, tsconfig + tsconfig.build.json đã sửa rootDir

### [BROKEN / UNKNOWN]
- **Hai nhánh CHƯA MERGE**, khác module system (ESM vs CommonJS)
- `pnpm verify:schema` **chưa từng chạy thành công end-to-end** (cần Mongo đang chạy)
- Backend **chưa xác nhận boot được** trên máy dev — lần cuối còn vướng `pnpm -w run`
- `argon2` còn trong `package.json` của scaffold nhưng đã bị `allowBuilds:false` **và** đã chốt dùng bcryptjs → phải gỡ

### [NOT STARTED]
rooms · room-members · meetings · LiveKit integration · realtime gateway · whiteboard sync · AI pipeline · files · import/export · health · observability · NGINX LB · deploy · E1–E5 · B1–B6 · frontend features

## 2. Known problems

| # | Problem | Root cause | Status |
|---|---|---|---|
| 1 | `CannotDetermineTypeError` | `Date\|null` union + emitDecoratorMetadata | FIXED (13 chỗ) |
| 2 | Duplicate schema index | `@Prop({index:true})` trùng compound | FIXED (10 chỗ) |
| 3 | `Cannot find module dist/main` | `paths` → `../shared/src` đẩy rootDir lên root repo | FIXED (tsconfig.build.json) |
| 4 | `class-validator is missing` | optional peer + pnpm strict | giải pháp đã có, **chưa xác nhận áp dụng** |
| 5 | `ERR_PNPM_MINIMUM_RELEASE_AGE` | policy chống supply-chain | tái diễn; `pnpm clean --lockfile` |
| 6 | argon2 build bị từ chối | Enter suông = từ chối tất cả | **thay bằng bcryptjs**, gỡ argon2 khỏi deps |
| 7 | `Command "dev:backend" not found` | pnpm v12 root script recursive | giải pháp đã có, **chưa xác nhận** |
| 8 | 4 dependency phantom ở nhánh đồng đội (`@nestjs/config`, `class-validator`, `class-transformer`, `bcryptjs`) | npm hoist phẳng | **CHƯA SỬA** — pnpm strict sẽ vỡ |
| 9 | Google callback trả token qua query string | — | **CHƯA SỬA** |
| 10 | Không có refresh token, JWT sống 7 ngày | — | **CHƯA SỬA** |
| 11 | `MONGO_URI ?? 'mongodb://localhost...'` fallback im lặng | — | **CHƯA SỬA** — production sẽ lặng lẽ nối nhầm DB |
| 12 | Prefix API không thống nhất (`/auth` vs `/api/v1/auth`) | hai nhánh khác convention | **CHƯA THỐNG NHẤT** |

## 3. TODO

### P0 — blocking
1. Merge 2 nhánh; chuyển `shared/` từ CJS sang ESM
2. Bổ sung 4 dependency thiếu; gỡ `argon2`
3. Hoà giải `User` schema (giữ username/providers/googleId, thêm displayName + lastLoginAt, đổi avatar → avatarUrl); bê 8 schema còn lại
4. Thay fallback `MONGO_URI` bằng `env.schema.ts`
5. Chạy được `verify:schema` PASS
6. **Giai đoạn 0 spike** — hai điểm chết người:
   - 3 máy ở 3 mạng khác nhau (wifi / 4G / mạng trường) gọi được nhau qua LiveKit + TURN
   - 2 backend instance + Redis adapter: 2 tab ở 2 instance chat được với nhau
   - Test `@socket.io/redis-adapter` + `@nestjs/schedule` dưới **ESM**

### P1 — important
7. Refresh token rotation
8. Sửa Google callback (one-time code hoặc cookie httpOnly)
9. Thống nhất prefix `/api/v1`
10. Rooms + RoomMembers + Meeting lifecycle
11. LiveKit integration (token theo role, webhook + verify chữ ký)
12. Socket.IO gateway + Redis adapter + presence + chat
13. Observability (pino + instanceId, Prometheus, Grafana)
14. **E1 + E2**

### P2 — normal
15. Excalidraw + LWW sync + seq + resync + persistence
16. AI pipeline (DSL → Zod → elkjs → merge)
17. Files + object storage (presigned URL)
18. Import/Export members (export trước, import sau — 4 bước có màn hình review)
19. Distributed lock cho cron auto-end + graceful shutdown
20. E3 + E4, benchmark B1–B6
21. Docker Compose đầy đủ + NGINX LB + CI/CD

### P3 — optional (cắt được nếu chậm, cắt từ dưới lên)
22. E5 AWS auto-scale
23. CO_HOST role
24. Acting host khi disconnect
25. Export PNG/SVG
26. LECTURE mode

## 4. Open questions

**Không tự biến những mục này thành quyết định. Phải hỏi người dùng.**

1. **Host chính:** Oracle Always Free hay VPS trả phí — cần trước Giai đoạn 0
2. **Số backend instance mục tiêu:** 2 hay 3 — ảnh hưởng cấu hình NGINX và RAM VPS, cần trước Giai đoạn 6
3. **Có scheduled meeting không** — nếu có thì `meetings` cần `scheduledAt` + status `SCHEDULED`, cần trước Giai đoạn 1
4. **Prefix API:** `/auth/*` hay `/api/v1/auth/*` — cần trước khi viết frontend API client
5. **ESM có chạy được với `@socket.io/redis-adapter` và `@nestjs/schedule` không** — rủi ro kỹ thuật chưa kiểm chứng, phải test trong Giai đoạn 0

## 5. Rejected ideas — không quay lại

| Idea | Vì sao bị loại |
|---|---|
| CRDT / Yjs cho whiteboard | thêm runtime + awareness + persistence riêng, khó test và trình bày; xung đột thật rất hiếm |
| Sticky session / `ip_hash` | mâu thuẫn stateless, vỡ khi auto-scale thu hồi instance |
| Guest access (join không login) | `userId` nullable lan khắp guard/schema/LiveKit identity |
| Backend trên Vercel | WS beta, cap 5 phút, không sticky-route, không process thường trú |
| AWS làm host chính cho SFU | 100 GB egress/tháng ≈ 5 giờ meeting 10 người |
| Message queue / integration event bus riêng | Redis adapter đã lo fan-out; không có cache cần invalidate |
| Recording / egress | transcode tiêu CPU nặng, cạnh tranh mục tiêu đo scalability |
| LiveKit multi-node | ngoài phạm vi; tốn thêm VM và nhân đôi bandwidth |
| Role ADMIN + import users | không có admin panel trong phạm vi |
| Microservice | vi phạm nguyên tắc không over-engineer |
| `shamefully-hoist=true` | mất lớp bảo vệ phantom dependency |
| argon2 / bcrypt native | cần compile, lỗi trên Windows |
| Socket.IO polling transport | kéo theo nhu cầu sticky session |
| Nhiều page/tab trong một whiteboard | canvas Excalidraw vô hạn đã đủ |
| localStorage cho access token | rủi ro XSS; giữ trong memory |
| Hexagonal cho toàn bộ module | 1–2 tuần boilerplate không có chỗ chứa trong 2 tháng |

## 6. CONTEXT GAPS — Claude Code cần nhưng conversation chưa có

1. **Trạng thái thực tế của repo sau merge.** Toàn bộ mô tả trên dựa vào hai nhánh riêng biệt tại thời điểm bàn giao. Claude Code phải **đọc repo thật** trước khi tin phần "Implementation status".
2. **Kết quả chạy thật.** Chưa có log xác nhận backend boot, `verify:schema` PASS, hay Mongo/Redis kết nối được trên máy dev.
3. **Nội dung `users.service.ts` phần cuối** (sau `createGoogleUser`) chưa được đọc đầy đủ — gồm `linkGoogleAccount`, `ensureUniqueUsername`.
4. **Frontend hiện có gì.** Mới thấy `auth.service.ts`, `app/auth/callback/page.tsx`, `app/page.tsx`, `layout.tsx`. Chưa rõ state management (Zustand? Context?), chưa có API client chung, chưa có route guard.
5. **Git workflow:** tên nhánh, quy ước commit, ai merge, có PR review không — chưa xác định.
6. **Deadline cụ thể** từng giai đoạn và ngày bảo vệ — chỉ biết "2 tháng".
7. **Tài khoản/credential:** domain đã mua chưa, VPS đã có chưa, Gemini API key đã có chưa, Google OAuth client đã tạo cho production chưa.
8. **Schema `Room`, `Meeting` v.v. của nhánh đồng đội** — các thư mục `schemas/` mới chỉ có `.gitkeep`, nên 8 schema còn lại chỉ tồn tại ở nhánh scaffold.
9. **Frontend có dùng `shared/` chưa** — hiện `frontend/` của đồng đội là npm project độc lập, chưa nối workspace.
10. **Chưa có DTO/validation cho Socket.IO event** — mới có type trong `shared/`, chưa có class DTO để validate thủ công trong gateway.
