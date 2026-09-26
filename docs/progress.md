progress.md được cập nhật sau mỗi task. Ghi task đã xong, commit nào, quyết định nảy sinh trong lúc code và chỗ nào lệch khỏi tài liệu. Phiên sau chỉ cần đọc file này.


Code hiện có
Phần	Trạng thái
Auth (đăng ký, đăng nhập local, Google OAuth, /auth/me)	Chạy được
9 schema Mongoose + index	Đã có, đúng theo DB_DESIGN.md
Rooms, room-members, meetings, chat, whiteboard	Mới có schema, chưa có service hay controller
Socket gateway /meeting	Mới là khung, chỉ ghi log, chưa có auth hay validate
AI, files, health, LiveKit	Chưa có
Frontend	Mới có các trang login, register, dashboard và Google callback. Chưa cài socket.io-client, LiveKit hay Excalidraw

---

### 2026-09-21 — Setup cấu hình Claude Code cho dự án

- **Đã xong:**
  - `CLAUDE.md` viết lại phân tầng: 10 ràng buộc cứng kiểm chứng được, bảng tra "task nào đọc § nào", khối "Quy trình & skill", mục "Chỗ code đang lệch khỏi tài liệu". Thêm `backend/CLAUDE.md`, bổ sung `frontend/CLAUDE.md`.
  - 6 slash command: `/ctx` (trích section từ PROJECT_CONTEXT thay vì nạp cả file), `/task`, `/check`, `/progress`, `/scale-check`, `/api`.
  - 2 hook: `check-rules.mjs` (PostToolUse — chặn 2 lỗi, cảnh báo 4 lỗi) và `session-start.mjs` (nạp progress.md đầu mỗi phiên).
  - 9 subagent viết lại theo stack thật, thêm `realtime-specialist`, `ai-whiteboard-specialist`, `devops-benchmark`.
  - Dọn `.claude/settings.local.json` (bỏ 2 chuỗi PowerShell hardcode `JWT_SECRET`), thay bằng `scripts/dev.ps1`.
- **Commit:** chưa commit.
- **Quyết định nảy sinh:**
  - ADR-017 — ép ràng buộc bằng hook thay vì chỉ ghi trong tài liệu; tách tầng ép luật (soi code) khỏi tầng quy trình (skill/plugin) để đổi công cụ không làm mất ràng buộc.
  - **Lệnh npm phải chạy bằng PowerShell, không bằng Bash.** Node cài qua nvm4w (`C:\nvm4w\nodejs`)
- **Lệch khỏi tài liệu:** phát hiện 4 chỗ, đã ghi vào mục "Chỗ code đang lệch khỏi tài liệu" trong `CLAUDE.md`:
  1. `shared/` mới chỉ có ở `backend/src/shared/`, §19.2 yêu cầu dùng chung cả hai phía — chưa chốt cách chia sẻ sang frontend.
  2. `frontend/src/app/` rỗng, trùng vai trò với `frontend/app/` đang dùng thật.
  3. Gateway `/meeting` chưa auth, chưa validate payload — vi phạm §14 và §9.
  4. `docker-compose.yml` chưa có `livekit`, `minio`, và chưa có nginx làm load balancer (cần cho tiêu chí ≥2 instance).
- **Kết quả `/check` (chạy thật, 2026-09-21):**

  | Bước | Kết quả |
  |---|---|
  | backend lint | ✅ pass — 2 warning: `UseGuards`, `HttpCode` import thừa ở `meeting.gateway.ts:3` |
  | backend test | ⚠ chưa có test nào (`No test files found`, pattern `**/*.spec.ts`) |
  | backend build | ✅ pass |
  | frontend lint | ❌ 2 error ở `src/context/auth.context.tsx`: `setState` gọi đồng bộ trong effect (dòng 35), và `fetchCurrentUser` dùng trước khi khai báo (dòng 36) |
  | frontend build | ❌ `/auth/callback` dùng `useSearchParams()` mà không bọc `Suspense` → prerender fail |

  Cả 5 vấn đề đều **có sẵn từ trước**, không phải do setup gây ra.

- **Còn dở:** chưa commit; 3 bước `/check` đang fail (xem bảng trên) — cần sửa trước khi làm tính năng mới; skill riêng cho "thêm socket event mới" đã bàn nhưng hoãn lại.

## 24-9-2026
chỉnh sửa phần meeting.mode ( Bỏ ra khỏi scope) chỉ còn meeting đơn thuần.
Cập nhật lại các role * đọc file rule/role.md
{ Đây là chỉnh tay từ tôi chưa qua rà soát của claude}

## 25-9-2026 — Bỏ `Meeting.mode` khỏi code + rà soát tài liệu
- **Xong:** task `docs/task/database/remove_meeting_mode.md`.
  - Code: xoá `enum MeetingMode`, `RoomRole.CO_HOST`, `RoomRole.VIEWER` (`shared/enums.ts`); xoá field `mode` trong `meeting.schema.ts`.
  - Docs: bỏ mode + CO_HOST/VIEWER ở `DB_DESIGN.md` (§C.0, §C.5, index room_members), `webrtc.md` §2 (`toLiveKitGrant(role)`), `whiteboard.md` §6, `PROJECT_CONTEXT.md` §15.
- **Kiểm tra:** `npm run build` (backend) không lỗi; grep `MeetingMode|LECTURE|DISCUSSION|CO_HOST|VIEWER` trong `backend/src` → không còn.
- **Truy vết:** `docs/DATN_decuong.md` chỉ nêu "chủ phòng" và "thành viên", không có chế độ giảng bài → khớp với HOST/MEMBER, không cần nhãn `[GVHD-verbal]`.
- **Chưa làm:** `enums.ts` vẫn ở `backend/src/shared`, chưa chuyển sang thư mục `shared/` dùng chung (DB_DESIGN đã ghi chú).

## 2026-09-25 — Chat thuộc room + collection `ai_requests` (S1: schema, enum, quyền, tài liệu)

- **Xong:** plan `docs/task/database/2026-09-23-chat-room-scope-ai-requests-design.md`, task 1–4.
  - Task 1 — `9010da6`: `message.schema.ts` đổi `roomId` thành khoá sở hữu chính, `meetingId` thành tag tuỳ chọn (`default: null`); đổi index sang `{roomId, createdAt}`, `{roomId, clientMsgId}` unique, `{meetingId, createdAt}` partial (chỉ tin có tag).
  - Task 2 — `536ef6a`: thêm collection `ai_requests` (`backend/src/modules/ai-assistant/schemas/ai-request.schema.ts`) + 2 enum `AiRequestKind`, `AiRequestStatus` trong `shared/enums.ts`, đăng ký schema trong `ai-assistant.module.ts`. Insert-only, không PENDING/update, không TTL.
  - Task 3 — `3b55226`: `RoomAccessService` (`assertRoomAccess`, `assertMeetingTag`) dùng chung cho `room:subscribe`, `chat:send`, REST history; luôn đọc Mongo/Redis, không cache. Thêm `RedisModule` global. 9 unit test (`room-access.service.spec.ts`) test trước.
  - Fix review — `2e0cbf2`: `assertMeetingTag` trả 400 khi `roomId` sai định dạng (trước chỉ check `meetingId`), tránh Mongoose CastError → 500.
  - Task 4 — commit tài liệu này: cập nhật `DB_DESIGN.md` (§B.1, §B.2, §C.0, §C.7, +§C.10 `ai_requests`, Phần D), `PROJECT_CONTEXT.md` §9 (kênh `room:{roomId}`, envelope thêm `roomId`, event `room:subscribe`/`room:unsubscribe`, `chat:send` đổi payload), `docs/api/endpoint.md` (thêm `GET /rooms/:roomId/messages` — thiết kế, chưa code), `docs/decisions.md` (ADR-018 room lâu dài, ADR-019 chat thuộc room).
- **Lệch khỏi spec ban đầu (đã duyệt, ghi ở Changelog spec v1.1):**
  - `assertMeetingTag` trả 400 (không phải 403) khi `meetingId` hoặc `roomId` sai định dạng.
  - Thêm `backend/src/common/redis.module.ts` (`@Global`) — `RedisService` trước chỉ khai báo ở `AppModule`, module con không inject được.
- **Kiểm tra:** `room-access.service.spec.ts` — **9/9 test pass** (`npm test -- room-access.service.spec.ts`, PowerShell).
- **Chưa chạy được:** app chưa boot qua `docker compose up` (Docker Desktop không chạy lúc code) — DI của `RoomAccessService`/`RedisModule` mới xác minh bằng `npm run build` + đọc code tĩnh, chưa xác minh bằng chạy container thật.
- **Còn dở (ngoài phạm vi S1, để lại task sau):** chat gateway (`room:subscribe`, `chat:send`, emit `chat:new`), REST `GET /rooms/:roomId/messages` theo spec mục 4, helper tên kênh Socket.IO, emit qua publisher chung.
- **Lưu ý cho task sau (từ final review):**
  - `assertMeetingTag` dựa vào Redis `presence:{meetingId}` — hiện chưa có code ghi set này (chờ webhook LiveKit). Task chat gateway phải quyết định khi tag bị từ chối: từ chối tin hay lưu tin không tag; và webhook LiveKit phải làm trước khi demo chat trong meeting.
  - Lần boot đầu bằng Docker: kiểm `REDIS_URL` có trong `backend/.env` (default của `redis.service.ts` là `localhost`, của `main.ts` là `redis`) và log có `Redis connected` + `Nest application successfully started`.
  - Khi viết query lịch sử chat theo `meetingId`: kiểm `.explain()` xem partial index `{meetingId, createdAt}` có được dùng; nếu không, thêm `meetingId: { $type: 'objectId' }` vào query.

## 2026-09-26 — Module room: Task 0 (thiết kế + spec)

- **Xong:** spec `docs/task/room/room_module_spec.md` — chốt 7 câu hỏi mở của `room_module_tasks.md`, 9 endpoint, bảng quyền, danh sách test.
- **Commit:** chưa commit (user yêu cầu không commit).
- **Quyết định (user chốt 2026-09-26):**
  - Không làm "đổi role"/chuyển host; HOST không được rời phòng, chỉ giải tán.
  - Kick = xoá bản ghi `room_members`, được vào lại bằng mã; bỏ field `isBanned` (sửa schema, `RoomAccessService`, test, DB_DESIGN khi làm Task 1/5).
  - Có `PATCH /rooms/:roomId` sửa tên/mô tả (chỉ HOST) — thêm so với task list, gộp vào Task 4.
  - Giữ `rooms.deletedAt`, không dùng.
  - Bảng quyền ở `backend/src/shared/permissions.ts`; cách frontend import chốt ở Task 9.
- **Để lại task sau:** thu hồi socket khi kick/rời (chat gateway); kết thúc meeting ACTIVE khi giải tán (module meeting); chi tiết import/export (Task 8).
- **Chưa cập nhật:** `docs/decisions.md`, `docs/api/endpoint.md`, `DB_DESIGN.md` — cập nhật khi code từng task (Task 10).
- **Plan:** `docs/task/room/room_module_plan.md` — Task 1–10, thứ tự 1→7, 9, 8, 10. Chi tiết import/export (Task 8) chốt trong plan. Chưa bắt đầu code.

## 2026-09-26 — Module room: Task 1 (bảng quyền + `assertRoomPermission` + bỏ `isBanned`)

- **Xong:** `backend/src/shared/permissions.ts` (`RoomAction` 6 hành động chỉ HOST, `ROOM_PERMISSIONS`, `can()`); `RoomAccessService.assertRoomPermission(userId, roomId, action)` = `assertRoomAccess` → `can()` → 403; bỏ `isBanned` khỏi schema `room_members`, query `assertRoomAccess`, test. Docs: `DB_DESIGN.md` §C.4, `endpoint.md` (GET messages), `decisions.md` ADR-020.
- **Commit:** `feat: bảng quyền room và assertRoomPermission, bỏ isBanned` (user duyệt đầu phiên Task 2).
- **Test:** `permissions.spec.ts` 2/2 pass. `room-access.service.spec.ts` đã chạy ở bước "fail trước" (4 fail đúng dự kiến / 8 pass). `npm test` toàn bộ lúc làm Task 1 bị auto-mode classifier chặn; chạy lại đầu phiên Task 2: **14/14 pass** (permissions 2 + room-access 12). `npm run build` pass.
- **Lệch khỏi plan:** sửa thêm `PROJECT_CONTEXT.md` §9 dòng Auth — bỏ "không bị ban" khỏi mô tả `assertRoomAccess` (plan không liệt kê, nhưng để lại thì mâu thuẫn với ADR-020).
- **Task sau cần biết:** interface `assertRoomPermission` đúng như plan (trả về member lean) → Task 2–8 không cần sửa. Các document `room_members` cũ trong DB có thể còn field `isBanned` — `.lean()` vẫn trả field đó nhưng không code nào đọc, không cần migrate.

## 2026-09-26 — Module room: Task 2 (tạo phòng `POST /rooms`)

- **Xong:** `rooms/dto/create-room.dto.ts` (trim, name 1–100, description ≤500); `rooms.service.ts` (`generateJoinCode` 8 ký tự base32 bằng `crypto.randomInt`, `toRoomResponse` map `_id → id`, `RoomsService.createRoom` — trùng `joinCode` sinh lại tối đa 5 lần rồi 500, tạo member HOST lỗi thì xoá room vừa tạo); `rooms.controller.ts` (`POST /rooms`, `JwtAuthGuard`); `rooms.module.ts` đăng ký controller/service, model `RoomMember`, import `RoomMembersModule`. Docs: `endpoint.md` thêm mục `## Rooms` + `POST /rooms`.
- **Commit:** chưa commit (chờ user duyệt).
- **Test:** `rooms.service.spec.ts` fail trước (không tìm thấy module) → 5/5 pass. Sau đó user yêu cầu thêm test case lạ tìm lỗ hổng: +9 test service (crypto thay `Math.random`, đủ 32 ký tự, mass assignment, response không lộ field, lỗi khác duplicate không retry, …) + `dto/create-room.dto.spec.ts` 6 test qua `ValidationPipe` cùng cấu hình `main.ts` (field lạ, NoSQL injection `{$ne}`, mảng, khoảng trắng Unicode, biên 100/101, `__proto__`). `npm test` toàn bộ **34/34 pass** (permissions 2 + room-access 12 + rooms.service 14 + create-room.dto 6). `npm run build` pass.
- **Lỗ hổng tìm được (user chốt 2026-09-26):**
  - Rollback xoá room cũng lỗi → lỗi gốc bị lỗi xoá đè, room mồ côi không để lại dấu vết. **Đã sửa:** `deleteOne(...).catch()` ghi `Logger.error` kèm roomId, vẫn ném lỗi gốc.
  - Emoji: class-validator `MaxLength` đếm 1 emoji = 1, Mongoose `maxlength` đếm `.length` (= 2, emoji có `️` = 3) → tên/mô tả nhiều emoji qua DTO nhưng Mongo từ chối → **500**. **Không sửa** (user: tên phòng không dùng emoji), đã bỏ test. `UpdateRoomDto` (Task 4) cũng dính lỗi này.
  - Tên chỉ gồm ký tự vô hình (`​`) được nhận. **Không sửa** (chỉ là chuyện hiển thị), đã bỏ test.
- **Lệch khỏi plan:** thêm `Logger` + `.catch()` ở rollback của `createRoom` (bản nháp plan gọi `deleteOne` trần). Thêm `dto/create-room.dto.spec.ts` dù Global Constraints ghi "không test DTO" — user yêu cầu.
- **Chưa chạy được:** chưa gọi `POST /rooms` qua app thật (Docker) — để Task 10.
- **Task sau cần biết:** interface đúng như plan (`RoomsService(roomModel, memberModel, access, redis)`, `toRoomResponse`, helper test `query/q/fakeRoom/build/duplicateKeyError`) → Task 3–8 không cần sửa. `redis` đã inject nhưng chưa dùng (Task 3 dùng cho rate limit). `isDuplicateKey` là hàm module-level không export — Task 3 gọi trực tiếp trong cùng file.
