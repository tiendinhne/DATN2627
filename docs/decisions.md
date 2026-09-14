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
**Decision:** Mọi user bắt buộc đăng nhập. `/join/:code` → chưa login → `/login?returnUrl=...` → login xong tự resolve code.
**Reason:** Mọi realtime event gắn `userId` thật → audit/presence/permission nhất quán; LiveKit token luôn sinh từ identity đã xác thực; giảm bề mặt tấn công.
**Alternatives:** guest join bằng link.
**Rejected because:** `userId` trở thành nullable ở mọi guard, schema, LiveKit identity → lan rất rộng.
**Status:** CONFIRMED. Nếu sau này thật sự cần, làm bằng User record có flag `isGuest`, **không** làm nullable userId.

## ADR-009 — Quyền theo phiên bằng `Meeting.mode`
**Decision:** `Meeting.mode: DISCUSSION | LECTURE`. `DISCUSSION` dùng role gốc của `RoomMember`; `LECTURE` chỉ HOST/CO_HOST được publish media và vẽ, còn lại hạ xuống VIEWER.
**Reason:** Role gắn RoomMember là room-level, không biểu diễn được "tuần này thảo luận, tuần sau nghe giảng".
**Alternatives:** `MeetingParticipant.roleOverride` (2 tầng resolve).
**Rejected because:** permission resolve được gọi ở 30–50 chỗ; 2 tầng làm chữ ký hàm phức tạp mà không cần thiết cho phạm vi này.
**Status:** CONFIRMED.

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
**Reason:** Vercel có WebSocket từ 6/2026 nhưng còn beta: kết nối bị đóng khi chạm max duration (Hobby mặc định 5 phút), không sticky-route theo room, serverless không giữ process thường trú.
**Status:** CONFIRMED. Hệ quả tích cực: NGINX trở thành load balancer thực thụ — đúng thứ GVHD yêu cầu.

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

## ADR-016 — bcryptjs thay vì argon2
**Decision:** Hash password bằng `bcryptjs` (thuần JS).
**Reason:** Không cần native build → tránh hẳn node-gyp / Visual Studio Build Tools trên Windows, và tránh vấn đề pnpm chặn build script.
**Alternatives:** argon2, bcrypt (native).
**Rejected because:** cả hai cần compile; argon2 đã thực sự gây lỗi trong dự án này.
**Status:** CONFIRMED. **Phải gỡ `argon2` khỏi `package.json` nếu còn.**

## ADR-017 — ESM + NestJS 12 / Mongoose 9 / TypeScript 6
**Decision:** `"type": "module"`, `moduleResolution: nodenext`. Mọi import tương đối có đuôi `.js`.
**Reason:** Theo nhánh đồng đội đang chạy được; LiveKit SDK cũng ESM-first.
**Alternatives:** CommonJS.
**Rejected because:** viết lại auth đang chạy tốn hơn.
**Status:** CONFIRMED — **nhưng có rủi ro chưa kiểm chứng**: chưa test `@socket.io/redis-adapter` và `@nestjs/schedule` dưới ESM. Phải test trong Giai đoạn 0. Nếu vướng, đổi sớm rẻ hơn đổi muộn.

## ADR-018 — Cấu trúc thư mục theo nhánh đồng đội
**Decision:** `src/{config, database, common, modules}` với `modules/{auth, users, rooms, room-members, meetings, whiteboard, chat, ai-assistant, realtime, health, files}`.
**Reason:** Quy ước NestJS chuẩn, đồng đội đã quen tay, đã có sẵn skeleton 10 module + `infrastructure/`.
**Alternatives:** `core/` + hexagonal đầy đủ mọi module.
**Rejected because:** hexagonal toàn bộ tốn 1–2 tuần boilerplate mà 2 tháng không có chỗ chứa.
**Status:** CONFIRMED.

## ADR-019 — Hybrid Hexagonal
**Decision:** Chỉ dựng `ports/` + `adapters/` ở module có **hệ ngoài phía sau** (media/LiveKit, ai-assistant/Gemini+elkjs, files/storage) hoặc có **logic thuần đáng test riêng** (whiteboard LWW, meeting state machine). Các module CRUD giữ layered `controller → service → schema`.
**Reason:** Hexagonal chỉ trả lãi từ module thứ ba trở đi; áp cho `rooms`/`users` sinh ra 3 shape dữ liệu + 2 mapper mỗi entity, giá trị gần bằng 0.
**Status:** CONFIRMED.
