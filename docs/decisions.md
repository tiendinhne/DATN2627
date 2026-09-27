# Architecture Decision Records

Trạng thái: tất cả **[CONFIRMED]** trừ khi ghi khác. Không quay lại các alternative đã loại.

---

## ADR-001 — Room ≠ Meeting, Whiteboard 1–1 Meeting
**Decision:** `Room` lâu dài (join code + link), chứa nhiều `Meeting` (phiên học). `Whiteboard` thuộc Meeting, quan hệ 1–1, meeting mới có thể `cloneFrom: previousMeetingId`. Một whiteboard = một canvas vô hạn, không có page/tab.
**Reason:** Đúng nghiệp vụ "một phòng học nhiều buổi", giữ được lịch sử meeting.
**Alternatives:** gộp Room = Meeting; whiteboard thuộc Room.
**Rejected because:** gộp thì không biểu diễn được nhiều phiên; whiteboard thuộc Room thì không review được từng buổi.
**Status:** CONFIRMED. Đổi = sửa schema, API path, socket room name, LiveKit room name, FE routing, migration dữ liệu.

## ADR-002 — LiveKit room name = `meeting._id.toString()`
**Decision:** Không tạo field riêng lưu tên room LiveKit.
**Reason:** Một nguồn sự thật; webhook parse ngược ra `meetingId` được.
**Alternatives:** field `livekitRoomName` riêng.
**Rejected because:** hai nguồn sẽ lệch, dữ liệu cũ mồ côi khi đổi.
**Status:** CONFIRMED.

## ADR-003 — Whiteboard đồng bộ bằng LWW per-element
**Decision:** Dùng cơ chế sẵn có của Excalidraw: `version` cao hơn thắng; hoà version thì `versionNonce` nhỏ hơn thắng; `isDeleted = true` là tombstone, KHÔNG xoá khỏi mảng.
**Reason:** Xung đột thật (2 người sửa cùng 1 element trong vài trăm ms) rất hiếm trong học nhóm. Hàm merge thuần, test trong vài ms.
**Alternatives:** CRDT (Yjs).
**Rejected because:** thêm runtime + awareness + persistence riêng; khó test; khó trình bày trong báo cáo; Excalidraw bản collab chính thức không dùng CRDT.
**Status:** CONFIRMED. Trình bày CRDT như alternative + limitation trong báo cáo. **Không code đường lui sang CRDT** — kiến trúc không hỗ trợ đổi rẻ (chạm storage format, socket contract, FE reconcile, và cả AI pipeline).

## ADR-004 — Stateless backend từ commit đầu tiên
**Decision:** Không giữ state theo user/room trong RAM process. Session → JWT; socket registry → Redis adapter; whiteboard live → Redis; seq → Redis INCR; presence → Redis Set; rate limit → Redis; upload → object storage; cron → distributed lock.
**Reason:** Yêu cầu bắt buộc của GVHD. Scale mà code không distributed thì vô nghĩa.
**Alternatives:** code single-instance trước, gỡ ra sau.
**Rejected because:** không có công cụ tự động tìm state trong RAM; đổi sync→async lan lên toàn bộ call chain, kéo theo sửa signature + test hàng loạt.
**Status:** CONFIRMED.

## ADR-005 — Socket.IO Redis adapter bắt buộc, không đợi
**Decision:** Bật `@socket.io/redis-adapter` ngay cả khi dev 1 instance.
**Reason:** Multi-instance là requirement chứ không phải giả định.
**Status:** CONFIRMED. *Đây là đảo ngược một quyết định cũ ("chỉ bật khi >1 instance") — không quay lại.*

## ADR-006 — Không dùng sticky session
**Decision:** Client ép `transports: ['websocket']`; NGINX round-robin thuần, **không `ip_hash`**.
**Reason:** Sticky session mâu thuẫn tinh thần stateless, giấu vấn đề thay vì giải quyết, và làm mất kết nối hàng loạt khi auto-scale thu hồi instance.
**Alternatives:** sticky session ở LB để giữ fallback polling.
**Rejected because:** rủi ro mất polling được bù bằng resync theo `seq` — mất kết nối không mất dữ liệu.
**Status:** CONFIRMED.

## ADR-007 — Không dựng integration event bus riêng
**Decision:** Domain event trong process bằng `EventEmitter2`; fan-out cross-instance do Socket.IO Redis adapter lo.
**Reason:** Backend không giữ state trong RAM nên không có cache nào cần invalidate cross-instance.
**Alternatives:** BullMQ / RabbitMQ / Redis Streams.
**Rejected because:** không giải quyết vấn đề có thật, vi phạm nguyên tắc "mỗi công nghệ phải có lý do".
**Status:** CONFIRMED. Nếu sau này cần job nặng thì thêm `EventBusPort` — port đã có chỗ.

## ADR-008 — Không hỗ trợ guest
**Decision:** Mọi user bắt buộc đăng nhập.
**Reason:** Mọi realtime event gắn `userId` thật → audit/presence/permission nhất quán; LiveKit token luôn sinh từ identity đã xác thực; giảm bề mặt tấn công.
**Alternatives:** guest join bằng link.
**Rejected because:** `userId` trở thành nullable ở mọi guard, schema, LiveKit identity → lan rất rộng.
**Status:** CONFIRMED. Nếu sau này thật sự cần, làm bằng User record có flag `isGuest`, **không** làm nullable userId.

## ADR-009 — Quyền theo phiên bằng `Meeting.mode`
Bỏ phần chia mode này, cập nhật lại tất cả tài liệu sau nếu mâu thuẫn.
Phần này không nằm trong scope hiện tại
## ADR-010 — Không có role ADMIN hệ thống
**Decision:** Bỏ chức năng import users. Import/export chỉ áp dụng cho room members (+ export chat/meeting/whiteboard).
**Status:** CONFIRMED.

## ADR-011 — AI pipeline 3 lớp
**Decision:** `LLM (JSON mode) → DSL chỉ nodes+edges KHÔNG toạ độ → Zod validate → elkjs layout → convertToExcalidrawElements() → gán version/versionNonce → merge`.
**Reason:** LLM sinh toạ độ rất tệ — trả thẳng element kèm `x,y,w,h` và arrow binding sẽ chồng chéo, mũi tên lệch, trông như bug.
**Alternatives:** LLM trả thẳng Excalidraw element.
**Rejected because:** kết quả không dùng được; đồng thời khó validate schema.
**Status:** CONFIRMED. **Điểm dễ hỏng:** element do layout engine sinh ra bắt buộc mang `version` + `versionNonce` hợp lệ, nếu không sẽ merge sai hoặc không sync sang client khác.

## ADR-012 — Backend không đặt trên Vercel
**Decision:** Vercel chỉ host Next.js frontend. NestJS + Socket.IO chạy container trên VPS sau NGINX.

## ADR-013 — AWS chỉ dùng cho thí nghiệm E5
**Decision:** Host chính (VPS hoặc Oracle Always Free) chạy backend ×2–3 + NGINX + Redis + LiveKit. AWS chỉ dựng ALB + ASG cho **backend** (không phải SFU), chạy ngắn hạn rồi tắt.
**Reason:** AWS chỉ miễn phí 100 GB egress/tháng ≈ **5 giờ** meeting 10 người. Free tier tài khoản mới hiện là credit có hạn 6 tháng.
**Status:** CONFIRMED. Trước bảo vệ ≥2 tuần phải chuyển sang VPS trả phí — không để buổi bảo vệ phụ thuộc free tier.

## ADR-014 — Whiteboard elements lưu dạng gzip Buffer, hard limit 5.000
**Decision:** `gzip(JSON.stringify(elements))` → `Buffer`. Vượt 5.000 element thì báo lỗi rõ ràng.
**Reason:** Trần 16 MB/document của MongoDB; 5.000 element thô ≈ 3–6 MB.
**Trade-off:** không query được bên trong elements — chấp nhận vì hệ thống không bao giờ cần.
**Status:** CONFIRMED. Nêu ở phần Limitations của báo cáo.

## ADR-015 — Guard `lastSeq` chống ghi đè ngược
**Decision:** Mọi lần persist whiteboard dùng update có điều kiện `{ meetingId, lastSeq: { $lt: incomingSeq } }`.
**Reason:** Nhiều instance có thể cùng debounce-persist một board; ghi mù thì bản cũ đè bản mới.
**Status:** CONFIRMED.

## ADR-016 — Backend dev chỉ chạy qua Docker Compose, không chạy song song native

## ADR-017 — Ràng buộc dự án được ép bằng hook, không chỉ nằm trong tài liệu

## ADR-018 — Room lâu dài, kết thúc phiên chỉ kết thúc meeting
**Decision:** Kết thúc phiên học chỉ đặt `meeting.status = ENDED`; room vẫn `ACTIVE` tới khi host giải tán.
**Reason:** Đề cương §6.1 (một phòng mở nhiều meeting, lưu lịch sử). Câu "phòng chuyển sang trạng thái kết thúc" ở §6.6 được hiểu là meeting kết thúc — user chốt 2026-09-23.
**Status:** CONFIRMED.

## ADR-019 — Chat thuộc room, meeting chỉ là tag
**Decision:** `messages.roomId` là khoá sở hữu; `meetingId` tuỳ chọn, chỉ server gắn sau khi xác minh. Realtime phát một lần tới `room:{roomId}`, khung chat meeting lọc theo `meetingId`.
**Reason:** Đề cương §6.3 — tin trong họp vẫn nằm trong luồng chat chung của room, người ngoài họp đọc được.
**Alternatives:** chat chỉ trong meeting; phát riêng hai kênh room/meeting.
**Rejected because:** trái §6.3; phát hai kênh phải khử trùng cho người ở cả hai nơi.
**Status:** CONFIRMED.

## ADR-020 — Mỗi room một HOST cố định, kick = xoá thành viên
**Decision:** Người tạo là HOST duy nhất, không chuyển host. Kick = xoá bản ghi `room_members` (vào lại được bằng mã), bỏ `isBanned`. HOST không rời phòng, chỉ giải tán. Quyền HOST tra bảng `shared/permissions.ts`.
**Reason:** Đề cương §5.4 (chủ phòng quản lý thành viên, kết thúc phòng); `docs/rule/role.md` ("Call API delete member"). Chỉ có 2 role → "đổi role" không có ý nghĩa. Chuyển host phải ghi 3 document mà Mongo standalone không có transaction.
**Alternatives:** kick = ban (`isBanned`); có chuyển host.
**Rejected because:** không có UI gỡ ban → trạng thái chết; chuyển host lỗi giữa chừng có thể để lại 2 HOST.
**Status:** CONFIRMED — user chốt 2026-09-26.

## ADR-021 — Chỉ dùng npm; backend và frontend là hai dự án npm độc lập `[phát sinh kỹ thuật]`
**Decision:** Cả project chỉ dùng npm. Bỏ npm workspace ở gốc repo → backend có đúng một lockfile `backend/package-lock.json`, dùng chung cho máy dev và Docker; frontend dùng `frontend/package-lock.json`. Ba `package.json` (gốc, backend, frontend) khai báo `"packageManager": "npm@<bản npm>"` để công cụ tự dò (vd CLI shadcn) chọn npm. Cài backend: `npm install --legacy-peer-deps` (cùng cờ với Dockerfile). File pnpm (`backend/pnpm-lock.yaml`, `frontend/pnpm-lock.yaml`, `frontend/pnpm-workspace.yaml`) giữ lại nhưng **không dùng, không cập nhật**. `.npmrc` ở gốc để nguyên — hiện không có tác dụng (dòng bị bọc ngoặc kép, `npm config get legacy-peer-deps` = `false`).
**Reason:** Không có trong đề cương — phát sinh khi làm Task 9 module room (CLI shadcn tự chọn pnpm vì thấy `pnpm-lock.yaml`). Chạy thử 2026-09-27 trên bản sao (đồ bỏ): lint/test/build như nhau ở hai công cụ (backend 58/58 cả hai); pnpm chỉ nhanh hơn khi cài lại (frontend 30,8 s so với 87,5 s). Vấn đề thật là **dùng lẫn**: `class-transformer` thêm bằng pnpm nên cả hai lockfile npm của backend thiếu package → `npm ci` fail; Docker cài từ `backend/package-lock.json` cũ ra `@nestjs/platform-socket.io` 12.1.0, máy dev 12.0.3. Workspace khiến backend có hai lockfile (gốc cho máy dev, `backend/` cho Docker), mỗi lần thêm package chỉ một file được cập nhật. Setup có sẵn (CLAUDE.md, Dockerfile, repo khởi tạo) đều là npm.
**Alternatives:** chuyển hẳn sang pnpm; giữ workspace và cho Docker build từ gốc repo bằng lockfile gốc; giữ cả hai lockfile npm, cập nhật tay.
**Rejected because:** pnpm phải sửa Dockerfile, workspace, CLAUDE.md và cấu hình `allowBuilds` (clone mới chạy `pnpm install` lỗi `ERR_PNPM_IGNORED_BUILDS`), lợi ích tốc độ không ảnh hưởng đồ án; build Docker từ gốc phải đổi cấu hình của ADR-016; cập nhật tay hai lockfile dễ quên — chính là lỗi đang có.
**Status:** CONFIRMED — user chốt 2026-09-27. Thực hiện ở Task 9a (`docs/task/room/room_module_plan.md`); tới khi làm xong, repo vẫn ở hiện trạng cũ.
