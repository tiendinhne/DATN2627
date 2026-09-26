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

## 2026-09-26 — Module room: Task 3 (tham gia phòng `POST /rooms/join`)

- **Xong:** `rooms/dto/join-room.dto.ts` (trim + uppercase, `/^[A-Z2-7]{8}$/`); `RoomsService.joinRoom` (rate limit → tìm room `{ joinCode, status: ACTIVE, deletedAt: null }` → sai mã/đã giải tán cùng 404 → insert MEMBER, trùng unique `{roomId, userId}` thì trả role hiện có, không tăng count → thành công `$inc memberCount: 1`); `private checkRateLimit(key, limit, message)` (Redis `INCR`, lần đầu `EXPIRE 60`, > limit → 429); route `POST /rooms/join` (`@HttpCode(200)`). Docs: `endpoint.md` thêm `POST /rooms/join`.
- **Commit:** `803fe2f feat: tham gia phòng bằng mã, rate limit trong Redis` (user duyệt).
- **Test:** 5 test `joinRoom` fail trước (`service.joinRoom is not a function`) → pass. `rooms.service.spec.ts` 19/19 (plan ghi 10/10 vì chưa tính 9 test "case lạ" Task 2 thêm). `npm test` toàn bộ **39/39 pass** (permissions 2 + room-access 12 + rooms.service 19 + create-room.dto 6). `npm run build` pass.
- **Lệch khỏi plan:** import `@nestjs/common` ở service/spec giữ thêm `Logger` (plan viết trước khi Task 2 dùng `Logger`). `checkRateLimit` đặt cuối class (sau `insertRoomWithUniqueCode`, gom các hàm private) thay vì ngay sau `joinRoom` — chữ ký không đổi.
- **Giới hạn biết trước (chưa sửa, không đổi hành vi):** `INCR` và `EXPIRE` là 2 lệnh riêng — nếu `EXPIRE` lỗi/instance chết đúng giữa 2 lệnh thì key không có hạn, user bị 429 mãi sau 10 lần. Xác suất rất thấp; sửa được bằng `MULTI` hoặc kiểm `TTL` nếu cần.
- **Chưa chạy được:** chưa gọi `POST /rooms/join` qua app thật (Docker) — để Task 10.
- **Task sau cần biết:** interface đúng như plan (`joinRoom(userId, code)`, `checkRateLimit(key, limit, message)`, hằng `RATE_WINDOW_SECONDS` để Task 8 thêm hằng số bên dưới) → Task 4–8 không cần sửa. Task 4 "thêm method sau `joinRoom`, trước `checkRateLimit`" → đặt giữa `joinRoom` và `insertRoomWithUniqueCode`.

## 2026-09-26 — Module room: Task 4 (xem + sửa phòng: `GET /rooms`, `GET /rooms/:roomId`, `PATCH /rooms/:roomId`, `GET /rooms/:roomId/members`)

- **Xong:** `rooms/dto/list-rooms-query.dto.ts` (page 1–1000, limit 1–50, mặc định 1/20); `rooms/dto/update-room.dto.ts` (name 1–100 trim, description ≤500, cả hai tuỳ chọn nhưng không nhận `null`); `RoomsService.listMyRooms` (một aggregate trên `room_members`: `$match userId` ObjectId → `$sort joinedAt -1` → `$lookup rooms` → lọc ACTIVE → `$skip`/`$limit limit+1` để tính `hasMore`), `getRoom` (`assertRoomAccess` → room + `myRole`), `updateRoom` (`assertRoomPermission(UPDATE_ROOM)` → chỉ `$set` field được gửi, rỗng → 400 → `findOneAndUpdate` room ACTIVE, `returnDocument: 'after'`), `listMembers` (`assertRoomAccess` → populate user, HOST đứng đầu, bỏ bản ghi user đã bị xoá), `private findMembersWithUser(roomId, userFields)` + type `PopulatedMember`. 4 route trong `rooms.controller.ts`. Docs: `endpoint.md` thêm 4 endpoint.
- **Commit:** chưa commit (chờ user duyệt). Commit này gộp luôn dòng hash commit Task 3 ở trên (user chốt).
- **Test:** 7 test service fail trước (`service.listMyRooms is not a function` …) → pass. Thêm `dto/update-room.dto.spec.ts` 2 test (user yêu cầu): đã kiểm bằng cách tạm đổi DTO về `@IsOptional` của plan → 2 test fail đúng ("promise resolved instead of rejecting") → khôi phục → pass. `rooms.service.spec.ts` 26/26. `npm test` toàn bộ **48/48 pass** (permissions 2 + room-access 12 + rooms.service 26 + create-room.dto 6 + update-room.dto 2). `npm run build` pass. Thêm 2 lần chạy test dùng xong bỏ (đã xoá file) kiểm DTO qua `ValidationPipe`: `{}` / chỉ `name` / `description: ""` qua được; query rỗng → `page 1, limit 20`; `page=1e20|1001|0|abc|1.5`, `limit=51` → 400.
- **Lỗ hổng tìm được lúc review plan (user chốt 2026-09-26):**
  - `PATCH {"name": null}`: `@IsOptional` bỏ qua mọi validator khi giá trị là `null`, còn `findOneAndUpdate` không chạy validator của schema → tên phòng trong DB thành `null`. **Đã sửa ở DTO:** đổi `@IsOptional()` → `@ValidateIf((_, value) => value !== undefined)` ở cả 2 field → `null` bị `@IsString` chặn, trả 400. Service giữ `!== undefined` như plan. Không dùng `runValidators: true` (lỗi Mongoose → 500) và không đổi service sang `!= null` (lặng lẽ bỏ qua input sai). `CreateRoomDto` không dính vì service đã có `description ?? ''`.
  - `GET /rooms?page=1e20`: `Number('1e20')` vẫn qua `@IsInt` → `$skip = 2e21` → Mongo báo "Cannot represent as a 64-bit integer" (đã thử trên `mongo-dev`) → 500. **Đã sửa:** thêm `@Max(1000)` cho `page` → 400. Ghi vào `endpoint.md`.
- **Lệch khỏi plan:** 2 sửa ở trên (DTO khác bản nháp, thêm file `update-room.dto.spec.ts`). Import `@nestjs/common` ở service/spec giữ thêm `Logger`. Code service/controller còn lại đúng bản nháp.
- **Sửa ghi chú Task 2:** progress Task 2 viết "`UpdateRoomDto` (Task 4) cũng dính lỗi emoji" — thực tế PATCH **không** trả 500 vì `findOneAndUpdate` không chạy validator `maxlength` của schema; tên nhiều emoji qua DTO sẽ được lưu dù `.length` > 100. Không sửa (user đã chốt tên phòng không dùng emoji).
- **Chưa chạy được:** chưa gọi 4 endpoint qua app thật (Docker) — để Task 10.
- **Task sau cần biết:** interface đúng như plan (`listMyRooms`, `getRoom`, `updateRoom`, `listMembers`, `findMembersWithUser(roomId, userFields)`, `PopulatedMember` không export) → Task 5–10 không cần sửa. Các method mới nằm giữa `joinRoom` và `insertRoomWithUniqueCode`. DTO tuỳ chọn mà ghi thẳng vào DB bằng update query thì dùng `@ValidateIf(v !== undefined)`, không dùng `@IsOptional`.
