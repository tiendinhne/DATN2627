# Status, TODO, Open Questions, Context Gaps

### [NOT STARTED]
rooms · room-members · meetings · LiveKit integration · realtime gateway · whiteboard sync · AI pipeline · files · import/export · health · observability · NGINX LB · deploy · E1–E5 · B1–B6 · frontend feature

## 3. TODO

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
