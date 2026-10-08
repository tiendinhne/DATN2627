progress.md được cập nhật sau mỗi task. Ghi task đã xong, commit nào, quyết định nảy sinh trong lúc code và chỗ nào lệch khỏi tài liệu. Phiên sau chỉ cần đọc file này.


Code hiện có
Phần	Trạng thái
Auth (đăng ký, đăng nhập local, Google OAuth, /auth/me)	Chạy được
9 schema Mongoose + index	Đã có, đúng theo DB_DESIGN.md
Rooms, room-members	REST đầy đủ + frontend (chạy thật qua Docker 2026-10-01); chưa có realtime
Meetings, chat, whiteboard	Mới có schema, chưa có service hay controller
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
- **Commit:** `e633438 feat: tạo phòng với join code ngẫu nhiên` (user duyệt).
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
- **Commit:** `08bd764 feat: xem danh sách, chi tiết, thành viên và sửa phòng` (user duyệt). Commit này gộp luôn dòng hash commit Task 3 ở trên (user chốt).
- **Test:** 7 test service fail trước (`service.listMyRooms is not a function` …) → pass. Thêm `dto/update-room.dto.spec.ts` 2 test (user yêu cầu): đã kiểm bằng cách tạm đổi DTO về `@IsOptional` của plan → 2 test fail đúng ("promise resolved instead of rejecting") → khôi phục → pass. `rooms.service.spec.ts` 26/26. `npm test` toàn bộ **48/48 pass** (permissions 2 + room-access 12 + rooms.service 26 + create-room.dto 6 + update-room.dto 2). `npm run build` pass. Thêm 2 lần chạy test dùng xong bỏ (đã xoá file) kiểm DTO qua `ValidationPipe`: `{}` / chỉ `name` / `description: ""` qua được; query rỗng → `page 1, limit 20`; `page=1e20|1001|0|abc|1.5`, `limit=51` → 400.
- **Lỗ hổng tìm được lúc review plan (user chốt 2026-09-26):**
  - `PATCH {"name": null}`: `@IsOptional` bỏ qua mọi validator khi giá trị là `null`, còn `findOneAndUpdate` không chạy validator của schema → tên phòng trong DB thành `null`. **Đã sửa ở DTO:** đổi `@IsOptional()` → `@ValidateIf((_, value) => value !== undefined)` ở cả 2 field → `null` bị `@IsString` chặn, trả 400. Service giữ `!== undefined` như plan. Không dùng `runValidators: true` (lỗi Mongoose → 500) và không đổi service sang `!= null` (lặng lẽ bỏ qua input sai). `CreateRoomDto` không dính vì service đã có `description ?? ''`.
  - `GET /rooms?page=1e20`: `Number('1e20')` vẫn qua `@IsInt` → `$skip = 2e21` → Mongo báo "Cannot represent as a 64-bit integer" (đã thử trên `mongo-dev`) → 500. **Đã sửa:** thêm `@Max(1000)` cho `page` → 400. Ghi vào `endpoint.md`.
- **Lệch khỏi plan:** 2 sửa ở trên (DTO khác bản nháp, thêm file `update-room.dto.spec.ts`). Import `@nestjs/common` ở service/spec giữ thêm `Logger`. Code service/controller còn lại đúng bản nháp.
- **Sửa ghi chú Task 2:** progress Task 2 viết "`UpdateRoomDto` (Task 4) cũng dính lỗi emoji" — thực tế PATCH **không** trả 500 vì `findOneAndUpdate` không chạy validator `maxlength` của schema; tên nhiều emoji qua DTO sẽ được lưu dù `.length` > 100. Không sửa (user đã chốt tên phòng không dùng emoji).
- **Chưa chạy được:** chưa gọi 4 endpoint qua app thật (Docker) — để Task 10.
- **Task sau cần biết:** interface đúng như plan (`listMyRooms`, `getRoom`, `updateRoom`, `listMembers`, `findMembersWithUser(roomId, userFields)`, `PopulatedMember` không export) → Task 5–10 không cần sửa. Các method mới nằm giữa `joinRoom` và `insertRoomWithUniqueCode`. DTO tuỳ chọn mà ghi thẳng vào DB bằng update query thì dùng `@ValidateIf(v !== undefined)`, không dùng `@IsOptional`.

## 2026-09-26 — Module room: Task 5 (kick thành viên `DELETE /rooms/:roomId/members/:userId`)

- **Xong:** `RoomsService.kickMember(hostId, roomId, targetUserId)` (`userId` sai định dạng → 400 trước khi kiểm quyền → `assertRoomPermission(KICK_MEMBER)` → tự kick → 400 → `removeMember` không xoá được → 404); `private removeMember(roomId, userId)` (`deleteOne`, chỉ `$inc memberCount: -1` khi `deletedCount === 1` → 2 request kick cùng lúc chỉ trừ 1 lần; trả `boolean`, Task 6 dùng lại). Route `DELETE :roomId/members/:userId` (`@HttpCode(204)`). Docs: `endpoint.md` thêm mục kick.
- **Commit:** `6bfbdf9 feat: HOST kick thành viên khỏi phòng` (user duyệt).
- **Test:** 6 test `kickMember` fail trước (`service.kickMember is not a function`) → pass. `rooms.service.spec.ts` 32/32 (plan ghi 22/22 vì chưa tính test Task 2–4 thêm). `npm test` toàn bộ **54/54 pass** (permissions 2 + room-access 12 + rooms.service 32 + create-room.dto 6 + update-room.dto 2). `npm run build` pass (exit 0).
- **Lỗ hổng tìm được lúc review plan (user chốt 2026-09-26):** bản nháp chặn tự kick bằng `targetUserId === hostId`, nhưng `Types.ObjectId.isValid` nhận hex **viết hoa** và Mongoose ép về cùng ObjectId (đã thử: `q.cast()` ra đúng id HOST) → HOST gửi id của mình viết hoa sẽ lọt qua, `deleteOne` xoá bản ghi HOST → phòng không còn HOST, không ai sửa/kick/giải tán được. **Đã sửa:** so sánh `new Types.ObjectId(targetUserId).equals(hostId)`. Thêm test "tự kick bằng id viết hoa → 400, không xoá" — đã kiểm: với code nháp `===` test này fail ("promise resolved instead of rejecting"), 5 test gốc pass; sau khi sửa pass.
- **Lệch khỏi plan:** dòng so sánh tự kick ở trên + thêm 1 test (6 thay vì 5). Phần còn lại đúng bản nháp.
- **Chưa chạy được:** chưa gọi endpoint qua app thật (Docker) — để Task 10.
- **Task sau cần biết:** interface đúng như plan (`kickMember`, `removeMember(roomId, userId): Promise<boolean>`) → Task 6 không cần sửa. `kickMember`/`removeMember` nằm giữa `listMembers` và `findMembersWithUser`. Route `kick` là method cuối controller — Task 6 chèn `leave` **ngay trước** nó; tới lúc đó `DELETE /rooms/:roomId/members/me` đang rơi vào `kick` và trả 400 "userId không hợp lệ". Task 6 plan ghi "PASS 24/24" → thực tế sẽ là 34/34. So sánh userId lấy từ URL với userId khác thì dùng `ObjectId.equals`, không so chuỗi.

## 2026-09-26 — Module room: Task 6 (rời phòng `DELETE /rooms/:roomId/members/me`)

- **Xong:** `RoomsService.leaveRoom(userId, roomId)` (`assertRoomAccess` → HOST → 400 "Host không thể rời phòng, hãy giải tán phòng" → `removeMember`; không xoá được vì request khác vừa rời/kick thì vẫn 204, không trừ count lần 2). Route `DELETE :roomId/members/me` (`@HttpCode(204)`) khai báo **ngay trước** `kick`. Docs: `endpoint.md` thêm mục rời phòng (trước mục kick).
- **Commit:** `b711a89 delete /me user out room` (user commit). Sửa luôn dòng Commit của Task 2, 4, 5 ở trên từ "chưa commit" sang hash thật (`e633438`, `08bd764`, `6bfbdf9`).
- **Test:** 2 test `leaveRoom` fail trước (`service.leaveRoom is not a function`) → pass. `rooms.service.spec.ts` 34/34 (plan ghi 24/24 vì chưa tính test Task 2–5 thêm). `npm test` toàn bộ **56/56 pass** (permissions 2 + room-access 12 + rooms.service 34 + create-room.dto 6 + update-room.dto 2). `npm run build` pass (exit 0). Thêm 1 lần chạy test dùng xong bỏ (đã xoá file) kiểm thứ tự route qua Express thật (`@nestjs/testing` + `supertest`, service giả, guard giả): `DELETE /rooms/R1/members/me` → 204, gọi `leaveRoom('U1','R1')`; `DELETE /rooms/R1/members/abc123` → gọi `kickMember` đúng 1 lần.
- **Lệch khỏi plan:** thêm 1 dòng ghi chú trong `leaveRoom` giải thích vì sao bỏ qua kết quả `removeMember`. Code/test/route còn lại đúng bản nháp. Không tìm thấy lỗ hổng khi review: role lấy từ DB qua `assertRoomAccess` (không so userId trên URL nên không dính lỗi viết hoa của Task 5); không phải thành viên → 403 từ `assertRoomAccess`.
- **Chưa chạy được:** chưa gọi endpoint qua app thật (Docker) — để Task 10.
- **Task sau cần biết:** interface đúng như plan (`leaveRoom(userId, roomId): Promise<void>`) → Task 7 không cần sửa. `leaveRoom` nằm giữa `kickMember` và `removeMember` → Task 7 thêm `dissolveRoom` "sau `leaveRoom`" = trước `removeMember`. Task 7 plan ghi "PASS 26/26" → thực tế sẽ là 36/36.

## 2026-09-26 — Module room: Task 7 (giải tán phòng `POST /rooms/:roomId/dissolve`)

- **Xong:** `RoomsService.dissolveRoom(hostId, roomId)` (`assertRoomPermission(DISSOLVE_ROOM)` → `updateOne({ _id, status: ACTIVE }, { $set: { status: DISSOLVED, dissolvedAt: now } })`, giữ nguyên `room_members`, `TODO(module meeting)` kết thúc meeting ACTIVE). Route `POST :roomId/dissolve` (`@HttpCode(204)`) là method cuối controller. Docs: `endpoint.md` thêm mục giải tán (sau mục kick).
- **Commit:** `e65d9bc feat: HOST giải tán phòng` (user duyệt). Sửa luôn dòng Commit của Task 6 ở trên sang `b711a89`.
- **Test:** 2 test `dissolveRoom` fail trước (`service.dissolveRoom is not a function`) → pass. `rooms.service.spec.ts` 36/36 (plan ghi 26/26 vì chưa tính test Task 2–5 thêm). `npm test` toàn bộ **58/58 pass** (permissions 2 + room-access 12 + rooms.service 36 + create-room.dto 6 + update-room.dto 2). `npm run build` pass (exit 0).
- **Lệch khỏi plan:** thêm 1 dòng ghi chú trong `dissolveRoom` giải thích vì sao lọc `status: ACTIVE`; `endpoint.md` thêm dòng `403: không phải HOST` cho giống các mục khác. Code/test/route còn lại đúng bản nháp. Không tìm thấy lỗ hổng khi review: role lấy từ DB qua `assertRoomPermission`; `roomId` sai định dạng → 400 từ `assertRoomAccess`; 2 request giải tán cùng lúc → request sau `updateOne` khớp 0 bản ghi, vẫn 204, không ghi đè `dissolvedAt`; `POST join` (1 đoạn) không đụng `POST :roomId/dissolve` (2 đoạn).
- **Giới hạn biết trước (không đổi hành vi):** user đang ở giữa `joinRoom` (đã tìm thấy room ACTIVE) đúng lúc HOST giải tán thì vẫn tạo được bản ghi `room_members` + `$inc memberCount` trên phòng đã giải tán. Vô hại: `assertRoomAccess` và `listMyRooms` đều lọc ACTIVE nên phòng không hiện ra, không truy cập được.
- **Chưa chạy được:** chưa gọi endpoint qua app thật (Docker) — để Task 10.
- **Task sau cần biết:** interface đúng như plan (`dissolveRoom(hostId, roomId): Promise<void>`) → Task 8–10 không cần sửa. `dissolveRoom` nằm giữa `leaveRoom` và `removeMember` → Task 8 "thêm vào class (sau `dissolveRoom`)" = trước `removeMember`. Route `dissolve` là method cuối controller. Thứ tự tiếp theo là **Task 9** (frontend) rồi mới Task 8. Task 8 plan ghi "PASS 34/34" → thực tế sẽ là 44/44.

## 2026-09-27 — Module room: Task 9 (review plan — chưa code, dừng theo yêu cầu user)

- **Trạng thái:** chưa viết code. Review plan Task 9 → user chốt 5 quyết định, sinh thêm **Task 9a** (thống nhất npm) và **Task 9b** (cài shadcn), mỗi task một phiên riêng, làm trước Task 9. User chọn dừng phiên này sau khi cập nhật tài liệu.
- **Kiểm đầu phiên:** git status sạch; `npm test` backend **58/58 pass** (5 file).
- **Quyết định (user chốt 2026-09-27):**
  1. **Dùng shadcn/ui** — task `chore` riêng (9b), commit riêng. Chỉ add `button input textarea card badge alert`; Task 8 tự add `dialog`. Vẫn dùng `confirm()` của trình duyệt.
  2. **Nút HOST ẩn/hiện theo `myRole`**, chưa import `shared/permissions.ts` — lệch §15 tạm thời. User dự định đưa frontend vào Docker để cả project chạy bằng `docker compose` → lúc đó build context gốc repo, chuyển sang bảng quyền dùng chung.
  3. **`safeReturnUrl` dùng `new URL(value, window.location.origin)` + so origin** thay cho kiểm chuỗi `startsWith` của bản nháp.
  4. **Test `safeReturnUrl` bằng script Node tạm, dùng xong xoá** (frontend chưa có công cụ test; không thêm vitest). Skill TDD và ràng buộc "không test UI, không thêm dependency" mâu thuẫn → user chọn cách này.
  5. **Chỉ dùng npm, bỏ npm workspace ở gốc — ADR-021** (`docs/decisions.md`). Backend thành dự án npm độc lập, một lockfile `backend/package-lock.json` cho cả máy dev lẫn Docker; 3 `package.json` khai báo `packageManager: npm@10.9.2`. File pnpm giữ nguyên, không dùng. `.npmrc` để nguyên. Làm ở Task 9a.
- **Rà soát package manager + chạy thử (2026-09-27, bản sao trong scratchpad, đồ bỏ — đã xoá):**
  - Hiện trạng: gốc repo là npm workspace chứa `backend`; `backend/node_modules` do **pnpm** tạo (symlink) → `npm test` 58/58 đầu phiên thực ra chạy trên package pnpm cài; gốc có `node_modules` npm; `frontend/node_modules` npm, còn sót `.pnpm/`. File pnpm (`backend/pnpm-lock.yaml`, `frontend/pnpm-lock.yaml`, `frontend/pnpm-workspace.yaml`) và `.npmrc` vào repo ở commit `a0ce5e8`. `.npmrc` viết `"legacy-peer-deps=true"` có ngoặc kép → `npm config get legacy-peer-deps` = `false`.
  - Frontend: `npm ci` lạnh 121,1 s ✅ / cài lại 87,5 s ✅; `pnpm install --frozen-lockfile` lạnh 132,4 s ❌ `ERR_PNPM_IGNORED_BUILDS` (`pnpm-workspace.yaml` còn giá trị mẫu `unrs-resolver: set this to true or false`) / cài lại 30,8 s ✅ sau khi đặt `true`. Lint + build ra **giống hệt** ở hai công cụ.
  - Backend: `npm ci` ❌ — `backend/package-lock.json` thiếu 6 package (`@nestjs/platform-socket.io`, `class-transformer`, `class-validator`, `@types/validator`, `libphonenumber-js`, `validator`); `npm ci --dry-run` ở gốc ❌ thiếu `class-transformer` (thêm bằng pnpm ở `a0ce5e8` nên chỉ `pnpm-lock.yaml` có). `npm install --legacy-peer-deps` (y Dockerfile) 52,8 s ✅ nhưng ra `@nestjs/platform-socket.io` **12.1.0** (máy dev 12.0.3). `pnpm install --frozen-lockfile` 90,9 s ✅. Test **58/58** cả hai (64,8 s / 64,2 s), build pass cả hai.
- **Lỗi có sẵn phát hiện khi chạy thử (không liên quan package manager, chưa sửa):**
  - **Frontend `npm run build` đang fail**: `useSearchParams() should be wrapped in a suspense boundary at page "/auth/callback"`. Task 9 Step 5 sửa đúng chỗ này — trước đó (Task 9a, 9b) build frontend sẽ fail lỗi này.
  - `npm run lint` frontend: 2 lỗi ở `src/context/auth.context.tsx` (setState đồng bộ trong effect; dùng biến trước khi khai báo) + 3 cảnh báo.
  - `@nestjs/cli` kéo `@angular-devkit/*` 22.x yêu cầu Node `^22.22.3 || ^24.15.0 || >=26`; máy đang Node 22.16.0, `backend/Dockerfile` dùng `node:20-alpine` → hiện chỉ là cảnh báo `EBADENGINE`, cài/test/build vẫn qua.
- **Lỗ hổng tìm được lúc review plan:** `safeReturnUrl` bản nháp bị vượt qua bằng `/login?returnUrl=/%09/evil.com` — trình duyệt tự bỏ tab/xuống dòng trong URL. Script tạm (chạy với `node --experimental-strip-types`) cho bản nháp: `FAIL "/\t/evil.com" -> /	/evil.com`, `FAIL "/\n/evil.com"` → `2 FAIL`; bản `new URL`: 9/9 `ALL PASS` (null, đường dẫn hợp lệ, `?query#hash`, `//`, `/\`, tab, xuống dòng, `https://evil.com`, `javascript:`). Mới thử trên file ở scratchpad, chưa tạo file trong repo.
- **Sửa plan (`docs/task/room/room_module_plan.md`, bị gitignore):** thêm Task 9a (thống nhất npm) + Task 9b (cài shadcn); thay khối "cần user duyệt" của Task 9 bằng 4 quyết định đã chốt; Step 3 Task 9 thành script kiểm → thấy fail với bản nháp → bản `new URL`; Task 8 thêm ghi chú dùng `Dialog` shadcn + file `dialog.tsx`; Task 10 Step 4 bỏ dòng "không dùng shadcn"; Global Constraints (dependency, npm), thứ tự làm (`7 → 9a → 9b → 9 → 8 → 10`), File map cập nhật theo.
- **Docs khác:** `docs/decisions.md` thêm ADR-021.
- **Commit:** không có code. Đổi `docs/progress.md`, `docs/decisions.md` (chờ user).
- **Task sau cần biết:**
  - **Task 9a trước.** Bỏ workspace, sinh lại `backend/package-lock.json`, thêm `packageManager`, xoá `node_modules` cũ (có bản pnpm) rồi cài lại bằng npm. Nhắn bạn cùng nhóm (workspace do Hiếu An tạo) cách cài lại sau khi pull.
  - **Task 9b:** CLI shadcn chọn npm nhờ field `packageManager` (đã đọc mã nguồn shadcn 4.21.0: có field thì ưu tiên hơn lockfile). Kiểm sau khi chạy: `package-lock.json` đổi, `pnpm-lock.yaml` không đổi.
  - `shadcn init` viết lại `app/globals.css`; kiểm `components.json` trỏ `app/globals.css` (không phải `src/app/`, có thư mục rỗng `src/app/.gitkeep`).
  - Task 9: bản nháp trang ở plan là Tailwind thuần → đổi sang component shadcn, giữ nguyên logic.
  - Next 16 trong `frontend/node_modules/next/dist/docs/`: `useParams` chỉ cần Suspense khi bật `cacheComponents` (hiện `next.config.ts` không bật); `useSearchParams` ở trang prerender nên bọc Suspense → plan đọc `window.location.search` thay thế là hợp lý.

## 2026-09-27 — Module room: Task 9a (thống nhất npm, backend thành dự án npm độc lập — ADR-021)

- **Xong:** `package.json` gốc bỏ `workspaces` + 5 script (`install:all`, `build`, `start`, `start:dev`, `test`), thêm `"packageManager": "npm@10.9.2"`; `git rm package-lock.json` (gốc); thêm `"packageManager": "npm@10.9.2"` sau `"private": true,` ở `backend/package.json`, `frontend/package.json`; xoá `node_modules` ở gốc, `backend/` (bản pnpm, có `.pnpm/`), `frontend/` (còn sót `.pnpm/`) — kho `J:\.pnpm-store` không đụng. Cài lại backend bằng `npm install --legacy-peer-deps` → `backend/package-lock.json` +60 dòng, không xoá dòng nào: đúng 6 package còn thiếu (`@nestjs/platform-socket.io` 12.1.0, `class-transformer` 0.5.1, `class-validator` 0.14.4, `@types/validator` 13.15.10, `libphonenumber-js` 1.13.14, `validator` 13.15.35).
- **Commit:** `chore: thống nhất npm, backend thành dự án npm độc lập` (user duyệt). Sửa luôn dòng Commit của Task 7 ở trên sang `e65d9bc`.
- **Kiểm đầu phiên:** git status sạch; `npm test` backend **58/58 pass** (chạy trên `node_modules` pnpm cũ); `npm --version` = 10.9.2; container `backend-dev` đang chạy nhưng chỉ mount `./backend/src` (không khoá `node_modules`); 6 tiến trình node đều là MongoDB MCP chạy từ npm cache.
- **Kiểm sau khi làm (backend):** `npm install --legacy-peer-deps` exit 0, 52,8 s, không sinh `package-lock.json` / `node_modules` ở gốc. Xoá `node_modules` → `npm ci --legacy-peer-deps` exit 0, 35,4 s → lockfile khớp. `Test-Path node_modules/.pnpm` = `False`. `@nestjs/platform-socket.io` **12.1.0** (máy dev trước đó 12.0.3, nay bằng bản Docker nhận). `npm test` **58/58 pass** (5 file). `npm run build` exit 0. Cảnh báo `EBADENGINE` của `@angular-devkit/*` 22.x vẫn còn như lúc rà soát.
- **Phạm vi:** `git status` chỉ có `package.json`, `package-lock.json` (gốc, deleted), `backend/package.json`, `backend/package-lock.json`, `frontend/package.json`. File pnpm, `.npmrc`, `Dockerfile`, `docker-compose.yml`, `src/` không đổi. Không file nào khác trong repo gọi script workspace ở gốc (`scripts/dev.ps1` chạy `npm` thẳng trong `backend/`, `frontend/`; `.github/` rỗng).
- **Kiểm frontend (Step 6 — user chạy tay vì auto-mode classifier chặn `npm ci`):** `npm ci` → "added 364 packages … found 0 vulnerabilities" (~1 phút); `Test-Path node_modules/.pnpm` = `False`. `npm run lint` → `✖ 5 problems (2 errors, 3 warnings)`, đúng các lỗi có sẵn: 2 error ở `src/context/auth.context.tsx` (35:7 `react-hooks/set-state-in-effect`, 36:7 `react-hooks/immutability`), warning `router` không dùng ở `app/page.tsx`, 2 warning `window.location.href` ở `auth.context.tsx:102` và `auth.service.ts:25`. `npm run build` → compile + TypeScript qua, chỉ fail lỗi có sẵn `useSearchParams() should be wrapped in a suspense boundary at page "/auth/callback"`.
  - **Vì sao build fail (systematic-debugging, chỉ điều tra, không sửa):** `app/auth/callback/page.tsx` là client component gọi `useSearchParams()` không bọc `<Suspense>`, trang này được prerender tĩnh → Next 16 báo lỗi khi build production (`node_modules/next/dist/docs/.../use-search-params.md` dòng 180–181: lúc `next dev` trang render theo yêu cầu nên không lỗi → vì vậy chưa ai thấy). File không đổi từ commit `a0ce5e8` (trước Task 9a); diff frontend của Task 9a chỉ có 1 dòng `packageManager` → **không do Task 9a**. Task 9 Step 5 thay trang này, đọc `window.location.search` trong `useEffect` thay cho `useSearchParams` → hết lỗi.
- **Kiểm Docker (Step 7 — user chạy tay vì auto-mode classifier chặn):** `docker compose build backend` build xong, không lỗi (user báo).
- **Lệch khỏi plan:** không lệch nội dung. Step 6 và Step 7 do user chạy tay.
- **Task sau cần biết:**
  - **Task 9b Step 1:** `frontend/package.json` đã có `packageManager`; `frontend/node_modules` đã cài lại bằng `npm ci` (user chạy).
  - Lệnh cài backend từ nay: `Set-Location backend; npm install --legacy-peer-deps`. `CLAUDE.md` mục "Lệnh" vẫn ghi `npm install` (không cờ) — chưa sửa, ngoài phạm vi Task 9a.
  - **Nhắn bạn cùng nhóm sau khi pull:** xoá `node_modules` ở gốc và `backend/` (`cmd /c "rmdir /s /q node_modules"`), rồi `Set-Location backend; npm install --legacy-peer-deps`; frontend `npm ci`; không dùng pnpm.

## 2026-09-27 — Module room: Task 9b (cài shadcn/ui)

- **Xong:** `npx shadcn@4.21.0 init -d -b radix` → `frontend/components.json` (`style: radix-nova`, `tailwind.css: app/globals.css` — đúng, không phải `src/app/`; `aliases.ui: @/components/ui`, `aliases.utils: @/lib/utils`), `src/lib/utils.ts` (`export { cn } from "cn"`), viết lại `app/globals.css`. `npx shadcn@4.21.0 add button input textarea card badge alert` → 6 file trong `src/components/ui/` (`button.tsx` do `init` tạo, `add` bỏ qua vì giống hệt). Dependency CLI tự cài: `class-variance-authority` 0.7.1, `cn` 0.4.0, `lucide-react` 1.48.0, `radix-ui` 1.6.7, `shadcn` 4.21.0, `tw-animate-css` 1.4.0. Không sửa trang nào, `layout.tsx` không đổi.
- **Commit:** gộp chung một commit với Task 9 (user chốt 2026-09-28): `feat: frontend module room — cài shadcn/ui, danh sách, tạo, nhập mã, link join, chi tiết phòng`.
- **Kiểm đầu phiên:** git status sạch; `npm test` backend **58/58 pass** (5 file); `frontend/package.json` có `packageManager: npm@10.9.2`, không có `node_modules/.pnpm`.
- **CLI dùng npm:** có — `package-lock.json` đổi, `pnpm-lock.yaml` / `pnpm-workspace.yaml` **không** đổi. (`pnpm --version` trong `frontend` giờ báo `ERR_PNPM_OTHER_PM_EXPECTED` — chính pnpm cũng tôn trọng field `packageManager`.) `npm ls --depth=0` exit 0; 6 package wasm (`@emnapi/*`, `@img/sharp-wasm32`, `@napi-rs/wasm-runtime`, `@tybys/wasm-util`) hiện `extraneous` nhưng mục của chúng trong lockfile giống hệt bản trước Task 9b → không do task này.
- **`globals.css` đổi gì:** thêm `@import "tw-animate-css"`, `@import "shadcn/tailwind.css"`, `@custom-variant dark (&:is(.dark *))`, bộ biến màu oklch (`--primary`, `--muted`, `--border`, …, `.dark`), `--radius-*`, `@layer base` (`* border-border outline-ring/50`, `body bg-background text-foreground`, `html font-sans`). Bẫy font đúng như dự đoán: CLI ghi `--font-sans: var(--font-sans)` (tự trỏ vòng) → **đã sửa** về `var(--font-geist-sans)`; `--font-mono` CLI giữ đúng `var(--font-geist-mono)`; `--font-heading: var(--font-sans)` giữ nguyên.
- **Ảnh hưởng tới trang cũ (ghi lại, không sửa trang):** (1) font đổi từ Arial sang Geist — CSS cũ có `body { font-family: Arial, … }` đè lên Geist, nay bỏ; (2) mất dark mode tự động theo hệ điều hành (`@media (prefers-color-scheme: dark)` bị thay bằng class `.dark`, chưa ai gắn) → trang luôn nền sáng; (3) `* { border-border }` không đổi gì vì mọi class `border` ở trang cũ đều có màu riêng.
- **Lint** (`npm run lint`): `✖ 5 problems (2 errors, 3 warnings)` — đúng 5 lỗi có sẵn như Task 9a (`auth.context.tsx` 35:7, 36:7; warning `app/page.tsx` 9:9, `auth.context.tsx:102`, `auth.service.ts:25`), không có lỗi ở file CLI sinh.
- **Build frontend** (`npm run build`): `✓ Compiled successfully`, `Finished TypeScript` → chỉ fail đúng lỗi có sẵn `useSearchParams() should be wrapped in a suspense boundary at page "/auth/callback"` (Task 9 Step 5 sửa). Không có lỗi từ `globals.css` / `src/components/ui`.
- **Dev** (`npm run dev`, không mở được trình duyệt → dùng `curl`): `/login`, `/dashboard`, `/` đều **200**, log không lỗi; CSS đã biên dịch có `--font-sans: var(--font-geist-sans)`, `<html>` vẫn gắn class biến font Geist. Chưa nhìn bằng mắt.
- **Backend:** không đổi. `npm run build` exit 0.
- **Lệch khỏi plan:**
  - `init -d -b radix` thay cho `init -d`: đọc mã nguồn shadcn 4.21.0, `-d` = `--template=next --preset=base-nova` và đặt `base = options.base || "base"` → **Base UI**, không phải Radix như plan ghi. Thêm `-b radix` để giữ đúng ý plan (Radix), các mặc định khác giữ nguyên (preset `nova`: Lucide / Geist / neutral). Đã sửa ghi chú Step 2 trong plan.
  - Ghim `shadcn@4.21.0` thay cho `@latest` — cùng bản (`npm view shadcn version` = 4.21.0 lúc làm), là bản đã đọc mã nguồn.
  - CLI cài `cn` (package chính chủ shadcn, repo `shadcn-ui/cn`, "drop-in replacement for clsx + tailwind-merge") thay cho `clsx` + `tailwind-merge` như plan dự đoán. Interface `cn()` từ `@/lib/utils` không đổi.
- **Task sau cần biết:**
  - Component theo **Radix** (`asChild` trên `Button` dùng được, `Slot` từ `radix-ui`). Export: `Button, buttonVariants`; `Input`; `Textarea`; `Card, CardHeader, CardFooter, CardTitle, CardAction, CardDescription, CardContent`; `Badge, badgeVariants`; `Alert, AlertTitle, AlertDescription, AlertAction`.
  - Task 8 `npx shadcn@latest add dialog` sẽ theo `components.json` (`radix-nova`) → vẫn Radix. Kiểm lại `pnpm-lock.yaml` không đổi như Step 4.
  - Dark mode giờ chỉ bật bằng class `.dark` trên `<html>` — Task 9 không cần làm dark mode.

## 2026-09-27/28 — Module room: Task 9 (frontend: danh sách, tạo, nhập mã, link `/join/:code`, chi tiết phòng)

- **Xong:** `src/types/room.ts`; `src/services/room.service.ts` (`request<T>` + 9 hàm gọi API); `src/lib/return-url.ts` (`safeReturnUrl`); trang `app/rooms/page.tsx`, `app/rooms/[roomId]/page.tsx` (có `reloadKey` + `run(action, after)` cho Task 8), `app/join/[code]/page.tsx` — dùng `Card`/`Button`/`Input`/`Textarea`/`Badge`/`Alert` của shadcn, logic/state/gọi API giữ đúng bản nháp. Sửa `app/login/page.tsx` (đọc `returnUrl`, cất vào `sessionStorage` trước khi sang Google), `app/auth/callback/page.tsx` (đọc query trong `useEffect`, `window.location.replace(returnUrl)`), `app/dashboard/page.tsx` (link "Phòng của tôi") — 3 trang này không chuyển sang shadcn.
- **Commit:** gộp chung một commit với Task 9b (user chốt 2026-09-28): `feat: frontend module room — cài shadcn/ui, danh sách, tạo, nhập mã, link join, chi tiết phòng`.
- **Quy trình:** user yêu cầu thêm skill TDD + requesting-code-review giữa chừng. TDD mâu thuẫn với CLAUDE.md/quyết định 4 (không test page UI, không thêm dependency) → hỏi user → **user bỏ TDD**, giữ script tạm như plan. Code review: 1 subagent review riêng các file Task 9 → 1 Critical + 1 Important (đã sửa, bên dưới) + 6 Minor (không sửa, ghi lại).
- **Kiểm `safeReturnUrl` (script tạm ở scratchpad, đã xoá):**
  - Bản nháp cũ (`startsWith`): `FAIL "/\t/evil.com" -> /	/evil.com`, `FAIL "/\n/evil.com"` → `2 FAIL` (đúng dự kiến plan).
  - Bản `new URL` + so origin của plan: 9/9 `ALL PASS`.
  - **Code review tìm ra lỗ hổng mới — bản `new URL` của plan vẫn bị vượt qua:** `"/.//evil.com"`, `"/join/..//evil.com"`, `"/./\evil.com"` → cùng origin nhưng `pathname = "//evil.com"` → hàm trả `//evil.com` → `router.push('//evil.com')` ở login = sang `http://evil.com/` ngay sau khi đăng nhập bằng mật khẩu (đã kiểm bằng Node: `new URL('//evil.com', 'http://localhost:3000/login').href` = `http://evil.com/`). Luồng Google không dính vì callback gọi `safeReturnUrl` lần nữa. Thêm 3 case vào script → `3 FAIL` → **sửa:** thêm điều kiện `!url.pathname.startsWith('//')` → **12/12 `ALL PASS`**. Ghi chú "9/9 ALL PASS" ở mục Task 9 (review plan) phía trên là chưa đủ case.
- **Sửa theo code review — Google login mất `returnUrl` khi chạy dev:** App Router bật Strict Mode mặc định (không có `reactStrictMode` trong `next.config.ts`) → effect của callback chạy 2 lần liền; lần 1 đọc `/join/X` rồi `removeItem`, lần 2 đọc `null` → `location.replace('/dashboard')` đè lên. **Sửa:** bỏ dòng `sessionStorage.removeItem('returnUrl')` (để lại vô hại: nút Google ở `/login` là nơi duy nhất bắt đầu OAuth và luôn ghi đè trước khi chuyển; `loginWithGoogle` trong `auth.service.ts` không ai gọi). Chưa kiểm bằng trình duyệt — để Task 10.
- **Minor từ code review (không sửa, ngoài bản nháp):** (1) effect danh sách/chi tiết không bỏ response cũ — bấm "Trang sau" 2 lần nhanh có thể hiện dữ liệu trang 2 khi `page` = 3; (2) lỗi danh sách không tự xoá khi tải lại thành công; (3) phòng bị giải tán / bị kick trong lúc đang xem → vẫn hiện dữ liệu cũ kèm thông báo lỗi; (4) `navigator.clipboard` không có trên origin HTTP không bảo mật (vd mở bằng IP LAN) → nút sao chép không làm gì, không có phản hồi "đã chép"; (5) dev Strict Mode gọi `joinRoom` 2 lần ở `/join/[code]` → tốn 2/10 lượt rate limit, dữ liệu vẫn đúng (API idempotent); (6) form sửa phòng không có label.
- **Đã kiểm, không phải lỗ hổng:** `roomId` từ `useParams` ghép thẳng vào đường dẫn API — Next 16 giữ tham số ở dạng đã encode (`canonicalizeURLPart` = `encodeURIComponent(decodeURIComponent(part))` trong `node_modules/next/dist/client/route-params.js`), trình duyệt tự chuẩn hoá `%2E%2E` → không đổi được đường dẫn API. Đã thử thêm `encodeURIComponent` rồi bỏ lại (thừa).
- **Lint** (`npm run lint`): `✖ 5 problems (2 errors, 3 warnings)` — đúng 5 lỗi có sẵn ở `app/page.tsx`, `src/context/auth.context.tsx`, `src/services/auth.service.ts`; không có lỗi ở file Task 9.
- **Build** (`npm run build`): exit 0 — **lỗi có sẵn `/auth/callback` (`useSearchParams`) đã hết**. Route: `○ /rooms`, `ƒ /rooms/[roomId]`, `ƒ /join/[code]`.
- **Backend:** không đổi. `npm test` **58/58 pass** (5 file).
- **Lệch khỏi tài liệu:** nút HOST ẩn/hiện theo `room.myRole === 'HOST'`, chưa import `shared/permissions.ts` → **lệch §15 tạm thời** (quyết định 2, user chốt 2026-09-27): chuyển sang bảng quyền dùng chung khi đưa frontend vào Docker với build context ở gốc repo.
- **Lệch khỏi plan:** điều kiện `!url.pathname.startsWith('//')` trong `safeReturnUrl` + 3 case mới trong script; callback bỏ `removeItem`. Đã sửa plan Step 3a/3c và Step 5 cho khớp. Còn lại đúng bản nháp (chỉ đổi UI sang shadcn).
- **Chưa chạy được:** chưa mở trình duyệt thử các trang / luồng `returnUrl` với backend thật — để Task 10.
- **Task sau cần biết:**
  - Task 8: `run(action, after)`, `reload()`, `notice`/`setNotice` (hiện chưa có chỗ nào đặt giá trị khác rỗng — dành cho kết quả import) nằm trong `app/rooms/[roomId]/page.tsx`. Chưa có `dialog` — Task 8 tự `add`.
  - Task 10 chạy tay cần thử: `/join/:code` khi chưa đăng nhập → login mật khẩu và Google đều quay lại đúng phòng; `/login?returnUrl=/.//evil.com` → về `/dashboard`.
  - `useProtectedRoute` vẫn đẩy sang `/login` không kèm `returnUrl` → mở link `/rooms/<id>` khi chưa đăng nhập thì đăng nhập xong về `/dashboard` (plan chỉ yêu cầu `returnUrl` cho `/join`).

## 2026-09-28 — Module room: Task 8a (HOST thêm 1 thành viên bằng email `POST /rooms/:roomId/members`)

- **Vì sao có task này:** user chốt 2026-09-28 — plan Task 8 nhảy thẳng vào import hàng loạt (dryRun, review, CSV) trong khi chưa có API thêm 1 thành viên; import là bản hàng loạt của thao tác này. Trace: đề cương §5.4 "Chủ phòng có quyền quản lý thành viên", `role.md` "Quản lý / kick member". Không cần spec/plan riêng (thêm endpoint vào module có sẵn — CLAUDE.md), thiết kế user duyệt trong chat.
- **Xong:**
  - Backend: `RoomAction.ADD_MEMBER` trong `shared/permissions.ts`; `rooms/dto/add-member.dto.ts` (trim + chữ thường, `@IsEmail`); `RoomsService.addMember(hostId, roomId, email)` — `assertRoomPermission(ADD_MEMBER)` → tìm user theo email, không có → 404 "Email này chưa đăng ký tài khoản" → tạo `room_members` MEMBER với `invitedBy = hostId` → trùng unique `{roomId, userId}` → 409 "Người này đã ở trong phòng" (2 request thêm cùng lúc cũng chỉ 1 cái qua) → `$inc memberCount: 1` → 201 `{ userId, displayName, avatarUrl, role, joinedAt }`. Constructor `RoomsService` thêm `userModel` ở cuối; `rooms.module.ts` đăng ký model `User`. Route `POST :roomId/members`.
  - Frontend: `addMember()` trong `room.service.ts`; trang chi tiết phòng — HOST thấy ô email + nút "Thêm" trong khung "Thành viên", thêm xong xoá ô nhập và `reload()`.
  - Docs: `endpoint.md` thêm mục `POST /rooms/:roomId/members`. Plan: thêm mục Task 8a, thứ tự `… → 9 → 8a → 8 → 10`, ghi chú đầu Task 8.
- **Commit:** `feat: HOST thêm thành viên vào phòng bằng email` (user duyệt 2026-09-28).
- **Test (TDD):** 4 test `addMember` viết trước → fail đúng (`service.addMember is not a function`, 36 test cũ vẫn pass) → viết code → pass. `npm test` toàn bộ **62/62 pass** (permissions 2 + room-access 12 + rooms.service 40 + create-room.dto 6 + update-room.dto 2). `npm run build` backend exit 0. Frontend: `npm run lint` chỉ còn 5 lỗi có sẵn (không có ở file sửa); `npm run build` exit 0.
- **Quyết định nảy sinh lúc code:**
  - Tìm user bằng `userModel` inject thẳng, không dùng `UsersService.findByEmail` vì hàm đó `select('+password')`.
  - Ghi `invitedBy = hostId` — field có sẵn trong schema, DB_DESIGN ghi "dùng cho import hàng loạt"; thêm đơn lẻ cũng là "ai thêm người này", bỏ trống thì mất thông tin.
  - Không thêm rate limit và thông báo "đã thêm" (không nằm trong thiết kế đã duyệt). Biết trước: HOST có thể dùng API này để dò email nào đã có tài khoản (404 vs 409/201) — giống bước review của import sẽ có; nếu cần chặn thì thêm `checkRateLimit` như join.
- **Chưa chạy được:** chưa gọi endpoint qua app thật / chưa bấm thử trên trình duyệt — để Task 10.
- **Task sau cần biết:**
  - **Task 8 phải chốt lại thiết kế với user trước khi làm:** user muốn import gọn, dùng lại logic `addMember`. Thiết kế cũ trong plan (dryRun + `bulkWrite` upsert + rate limit) viết trước Task 8a. Phần constructor/`User` model/helper `userModel` của Task 8 đã làm ở 8a (ghi ở đầu Task 8 trong plan).
  - `addMember` nằm giữa `listMembers` và `kickMember` trong service; route `addMember` ngay sau `GET :roomId/members` trong controller.

## 2026-09-28 — Module room: hoãn Task 8 (import / export thành viên)

- **Quyết định (user chốt 2026-09-28):** import/export thành viên bằng file **để làm sau**, trước mắt dùng "thêm thành viên bằng email" (Task 8a). **Chỉ hoãn, không bỏ** — là yêu cầu `[GVHD-verbal]` (PROJECT_CONTEXT §13), §3 để trong phạm vi, `role.md` có dòng "Import members / Export" → phải làm trước khi bảo vệ.
- **Rà ảnh hưởng khi hoãn:** không ảnh hưởng DB hay code khác.
  - DB: không cần collection/field mới; import sau này dùng lại unique `{roomId, userId}`, `invitedBy` (8a đã ghi), `memberCount`; export chỉ đọc `users` + `room_members` → dữ liệu tạo ra từ giờ không phải migrate.
  - Backend: route dự kiến `POST :roomId/members/import`, `GET :roomId/members/export` không đè route hiện có; `userModel` + model `User` có sẵn từ 8a; `IMPORT_MEMBERS`/`EXPORT_MEMBERS` giữ trong bảng quyền (chưa dùng, vô hại).
  - Không module nào phụ thuộc (đã grep `docs/task`, code chat/meeting/whiteboard/AI).
- **Đã làm theo quyết định:**
  - Xoá state `notice` ở `app/rooms/[roomId]/page.tsx` (chỉ để hiện kết quả import, luôn rỗng khi chưa có import) — ghi chú "Task 8 dùng `notice`/`setNotice`" ở mục Task 9 phía trên không còn đúng; làm import thì thêm lại.
  - Plan: thứ tự thành `… → 9 → 8a → 10`, Task 8 đánh dấu **HOÃN** kèm kết quả rà ảnh hưởng; Task 10 Step 3 mục 3–4 đổi từ kiểm Import/Export sang kiểm ô "Thêm" thành viên.
- **Commit:** không commit (user chọn 2026-09-28) — `docs/progress.md` + `frontend/app/rooms/[roomId]/page.tsx` cố ý để lại trong working tree, phiên Task 10 thấy git status không sạch là do 2 file này.
- **Task sau cần biết:** task tiếp theo của module room là **Task 10** (chạy thật qua Docker + chốt tài liệu). Khi quay lại import/export: dùng lại logic `addMember`; cân nhắc làm CSV export chung với export chat/meeting/whiteboard (ADR-010).

## 2026-10-01 — Module room: Task 10 (chạy thật qua Docker) — **dừng giữa chừng ở Step 2**

- **Kiểm đầu phiên:** git status chỉ có 2 file cố ý để lại từ phiên hoãn Task 8 (`docs/progress.md`, `frontend/app/rooms/[roomId]/page.tsx`) — không đụng tới. `npm test` backend **62/62 pass** (5 file).
- **Step 1 — lần đầu boot: app KHÔNG khởi động.** `docker compose up -d --build` → `UnknownDependenciesException: Nest can't resolve dependencies of the JwtAuthGuard (?). Please make sure that the argument AuthModuleOptions at index [0] is available in the RoomsModule module.`
  - **Nguyên nhân gốc:** `@nestjs/core` 12.0.3 `injector.js` — `reflectConstructorParams` dùng `Reflect.getMetadata` (kế thừa → `JwtAuthGuard` nhận `[AuthModuleOptions]` từ `MixinAuthGuard`), còn `reflectOptionalParams` dùng `Reflect.getOwnMetadata` (không kế thừa → mất `@Optional()` của lớp cha). Đã kiểm trên `dist/`: paramtypes = `['AuthModuleOptions']`, optional của `JwtAuthGuard` = `undefined`, của lớp cha = `[0]`. `AuthController` chạy được vì `AuthModule` có `PassportModule.register(...)`; `RoomsModule` thì không.
  - **Đã sửa:** `rooms.module.ts` import `PassportModule.register({ session: false })` (cùng option với `AuthModule`; đúng thông báo của thư viện "import PassportModule in each place where AuthGuard() is being used"). Module sau dùng `JwtAuthGuard` (chat REST, meeting) cũng phải thêm dòng này.
  - Sau khi sửa, log: `Mapped {/rooms, POST}` … `Mapped {/rooms/:roomId/dissolve, POST}` (10 route), `[RedisService] Redis connected`, `Nest application successfully started`, `Backend is running on: http://127.0.0.1:3001` → **Step 1 đạt**.
- **Step 2 — smoke test API: FAIL.** Output (nguyên văn, rút gọn phần lặp):
  ```
  --- register: h.user.id= m.user.id= tokenH=False tokenM=False
  --- 1. POST /rooms (HOST)        → id 6abe6c21c2611e8f97b71ada, joinCode 6M2O6RDY, memberCount 1, myRole HOST   ✅
  --- 2. POST /rooms/join (6m2o6rdy) → memberCount 2, myRole MEMBER   ✅
  --- 3. GET /rooms (MEMBER)       → page=1 limit=20 hasMore=False items=0   ❌ (phải có phòng vừa vào)
  --- 4. GET /rooms/:id/members (HOST) → 403 {"message":"Bạn không phải thành viên room này"}   ❌
  --- 5. POST dissolve (MEMBER)    → Forbidden   (đúng mã nhưng sai lý do — xem dưới)
  --- 6. DELETE members/:userId    → 404 "Cannot DELETE /rooms/6abe…ada/members/"   ❌ (userId rỗng)
  --- 7. GET /rooms/:id (MEMBER)   → Forbidden
  --- 8. POST dissolve (HOST)      → 403 "Bạn không phải thành viên room này"   ❌
  --- 9. GET /rooms/:id (HOST)     → Forbidden   ❌ (phải NotFound)
  ```
  - **Lỗi 1 — script trong plan:** biến PowerShell **không phân biệt hoa thường** → `$H = @{…}` ghi đè `$h`, `$M` ghi đè `$m` → `$h.user.id` rỗng (dòng 6). Token vẫn đúng vì lấy trước khi bị ghi đè. **Đã sửa plan:** header đổi tên `$hAuth`/`$mAuth`.
  - **Lỗi 2 — schema (nguyên nhân dòng 3, 4, 8, 9):** mongosh cho thấy `rooms.ownerId` và `room_members.userId` lưu dạng **string** (`'6abe6c21c2611e8f97b71ad6'`), `roomId` lưu ObjectId (vì code truyền sẵn `room._id`). `RoomMemberSchema.path('userId').instance` = **`Mixed`** (cả `roomId`, `invitedBy`, `rooms.ownerId`). Nguyên nhân: `@nestjs/mongoose` 12 `DefinitionsFactory.inspectTypeDefinition` coi `Types.ObjectId` (class BSON) là class schema lồng nhau → `{}` → Mixed → không ép kiểu. `assertRoomAccess` query `roomId` string ≠ ObjectId đã lưu → 403; `listMyRooms` `$match { userId: ObjectId }` ≠ string đã lưu → 0 item. Thử `@Prop({ type: Schema.Types.ObjectId })` → `ObjectId`, lưu đúng kiểu. Chỉ có 1 bản mongoose (9.10.1) — không phải trùng package. Unit test không bắt được vì model bị mock.
  - **Phạm vi lỗi 2:** 23 field / 9 file schema (ai-request 3, refresh-token 1, message 4, meeting-participant 2, meeting 3, room-member 3, file 3, room 1, whiteboard 3). Dữ liệu dev lưu sai kiểu: `rooms` 1, `room_members` 2 (`userId`), `refresh_tokens` 3; collection khác rỗng; `users` 7.
- **Quyết định (user chốt 2026-10-01):**
  1. **Dừng Task 10.** Sửa schema tách thành **Task 10a** (`fix:`) ở phiên riêng, xong làm lại Task 10 từ Step 1. Phạm vi (cả 9 file hay chỉ module room) chốt đầu phiên 10a.
  2. Dữ liệu dev: **xoá** `rooms`, `room_members`, `refresh_tokens` — làm trong Task 10a **sau khi** sửa schema (xoá trước thì thao tác trong lúc chờ vẫn ghi sai kiểu). Chưa xoá ở phiên này.
  3. Test: **không** thêm spec schema (CLAUDE.md); smoke test Step 2 là bước tái hiện.
- **Step 3–5:** chưa làm (frontend chạy tay, chốt tài liệu, commit).
- **Kiểm cuối phiên (sau khi sửa `rooms.module.ts`):** `npm test` → `Test Files 5 passed (5)`, `Tests 62 passed (62)`; `npm run build` → exit 0.
- **Lệch khỏi plan:** sửa code backend trong Task 10 (plan chỉ ghi sửa docs) — `rooms.module.ts` thêm `PassportModule`; sửa script Step 2. Plan: thêm Task 10a, thứ tự `… → 8a → 10 (dừng) → 10a → 10`, ghi chú đầu Task 10.
- **Commit:** `bbff68b fix: RoomsModule import PassportModule để JwtAuthGuard khởi động được`.
- **Task sau cần biết:**
  - Task 10a: danh sách field + cách sửa + bước kiểm ghi ở plan. Import `Schema` của mongoose trùng tên decorator `Schema` của `@nestjs/mongoose` → đặt alias.
  - Ghi chú Task 5 ở trên ("Mongoose ép về cùng ObjectId … `q.cast()`") đúng với schema ObjectId thật, **không đúng** với code lúc đó (path là Mixed). Code chặn tự kick dùng `new Types.ObjectId(targetUserId).equals(hostId)` nên vẫn đúng; sau 10a nên chạy lại case id viết hoa trong smoke test tay.
  - Container `backend-dev` đang chạy bản đã sửa `rooms.module.ts`.

## 2026-10-01 — Module room: Task 10a (`fix` — field tham chiếu Mixed → ObjectId)

- **Kiểm đầu phiên:** git status chỉ có 3 file cố ý để lại từ phiên hoãn Task 8 + phiên Task 10 (`rooms.module.ts`, `docs/progress.md`, `app/rooms/[roomId]/page.tsx`) — không đụng tới. `npm test` **62/62 pass**.
- **Tìm cách sửa gọn (user yêu cầu nghĩ đơn giản trước):** không có cách sửa một chỗ — `@nestjs/mongoose` 12.0.0 là bản mới nhất (`npm view`), `DefinitionsFactory` không có tuỳ chọn nào; mongoose tự hiểu `Types.ObjectId` nhưng `@nestjs/mongoose` đổi nó thành `{}` trước khi tới mongoose. Cách chuẩn (docs NestJS, StackOverflow/blog): `type: mongoose.Schema.Types.ObjectId`. Chọn dạng gọn nhất: `SchemaTypes.ObjectId` — named export của mongoose (`SchemaTypes === Schema.Types`, có khai báo TS) → không cần alias.
- **Phạm vi (user chốt 2026-10-01):** cả 9 file, 23 field.
- **Đã làm:**
  - 9 file schema: import `{ Document, SchemaTypes, Types }` + 1 dòng ghi chú lý do; `type: Types.ObjectId` → `type: SchemaTypes.ObjectId`. Kiểu TS field giữ `Types.ObjectId`. Không đổi service/test/DTO (mọi chỗ so sánh field tham chiếu đã bọc `String(...)`; auth chỉ ghi `refresh_tokens`, không đọc theo `userId`).
  - `docs/database/DB_DESIGN.md`: 23 mẫu code đổi tương tự + 1 ghi chú đầu Phần C `[phát sinh kỹ thuật]` để module sau không chép lại lỗi.
- **Kiểm (output thật):**
  - Script đồ bỏ đọc `schema.paths` từ `dist/`: **trước** 23/23 field `Mixed`; **sau** 23/23 `ObjectId` (AiRequest 3, RefreshToken 1, Message 4, MeetingParticipant 2, Meeting 3, RoomMember 3, File 3, Room 1, Whiteboard 3).
  - `npm test` → `Test Files 5 passed (5)`, `Tests 62 passed (62)`; `npm run build` → exit 0.
  - `docker compose up -d --build` → 10 route `/rooms` mapped, `Redis connected`, `Nest application successfully started`.
  - Smoke test Task 10 Step 2 — **9/9 đúng**: 1. tạo phòng `myRole HOST` · 2. join mã viết thường → `memberCount 2`, `MEMBER` · 3. `GET /rooms` (MEMBER) `items=1` (trước: 0) · 4. members: HOST đứng đầu (trước: 403) · 5. MEMBER giải tán → 403 "Bạn không có quyền thực hiện thao tác này" (trước: 403 sai lý do "không phải thành viên") · 6. kick → 204 · 7. MEMBER bị kick xem phòng → 403 · 8. HOST giải tán → OK (trước: 403) · 9. xem phòng đã giải tán → 404 (trước: 403).
  - mongosh (chỉ đọc) trên phòng vừa tạo: `ownerId`, `room_members.roomId`, `room_members.userId` đều `ObjectId`.
  - Case id viết hoa (ghi chú Task 5): HOST tự kick bằng id viết hoa → 400 "Không thể tự mời mình ra khỏi phòng", HOST còn nguyên; HOST kick MEMBER bằng id viết hoa → 204, MEMBER bị xoá (Mongoose giờ ép kiểu đúng) → ghi chú Task 5 nay đúng với code.
- **Lệch khỏi plan:**
  - `SchemaTypes.ObjectId` thay cho alias `Schema as MongooseSchema` (cùng hành vi).
  - Thêm sửa `DB_DESIGN.md` (plan không ghi).
  - **Chưa xoá dữ liệu dev** `rooms`/`room_members`/`refresh_tokens`: auto-mode chặn lệnh `deleteMany` → để user tự chạy. Còn 1 room, 2 room_members, 3 refresh_tokens kiểu string (cũ) + dữ liệu smoke test mới (đúng kiểu, phòng đã giải tán). Vì vậy kiểm mongosh làm trên bản ghi phòng mới, không đếm cả collection.
- **Commit:** `ff59027 fix: field tham chiếu trong schema lưu đúng ObjectId`.
- **Task sau cần biết:**
  - Làm lại **Task 10 từ Step 1**. Đầu phiên kiểm dữ liệu cũ đã xoá chưa (lệnh ở dưới).
  - Schema mới (chat, meeting, whiteboard, AI đã có sẵn schema đã sửa) — field tham chiếu viết `type: SchemaTypes.ObjectId`, không `Types.ObjectId`. Unit test mock model không bắt được lỗi này; chỉ app thật / đọc `schema.path(x).instance` mới thấy.
  - Lệnh xoá dữ liệu dev cho user (PowerShell, gốc repo): `docker exec mongo-dev mongosh online-group-learning --quiet --eval "printjson({ rooms: db.rooms.deleteMany({}).deletedCount, room_members: db.room_members.deleteMany({}).deletedCount, refresh_tokens: db.refresh_tokens.deleteMany({}).deletedCount })"`


## 2026-10-01 — Module room: Task 10 (làm lại sau Task 10a) — xong

- **Kiểm Task 10a đầu phiên:** không còn `type: Types.ObjectId` trong `backend/src`; script đồ bỏ đọc `schema.paths` trên `dist/` vừa build → field có `ref`: `{ ObjectId: 23 }`. `npm test` **62/62**, `npm run build` exit 0. Dữ liệu dev cũ **chưa xoá** (còn `rooms.ownerId` string 1, `room_members.userId` string 2, `refresh_tokens.userId` string 3) → xoá theo quyết định user 2026-10-01: `{ rooms: 3, room_members: 4, refresh_tokens: 7 }`; `users` giữ nguyên.
- **Step 1:** `docker compose up -d --build` → 10 route `/rooms` mapped, `[RedisService] Redis connected`, `Nest application successfully started`, `Backend is running on: http://127.0.0.1:3001`.
- **Step 2 — smoke test: 9/9 đúng** (script plan đã sửa `$hAuth`/`$mAuth`). Output:
  ```
  --- 0. register: h.user.id=6abe7cfeb3c55a2bb208d34a m.user.id=6abe7cfeb3c55a2bb208d34c
  --- 1. POST /rooms (HOST)          → id 6abe7cfeb3c55a2bb208d34e, joinCode CUMRVWNG, ownerId …d34a, status ACTIVE, memberCount 1, myRole HOST
  --- 2. POST /rooms/join (cumrvwng)  → memberCount 2, myRole MEMBER
  --- 3. GET /rooms (MEMBER)          → page=1 limit=20 hasMore=False items=1 (Nhom test, MEMBER, 2)
  --- 4. GET /rooms/:id/members (HOST) → …d34a Host HOST 15:32:14.716Z / …d34c Member MEMBER 15:32:14.802Z
  --- 5. POST dissolve (MEMBER)      → 403 {"message":"Bạn không có quyền thực hiện thao tác này"}
  --- 6. DELETE members/…d34c (HOST) → ok (204)
  --- 7. GET /rooms/:id (MEMBER)      → 403 {"message":"Bạn không phải thành viên room này"}
  --- 8. POST dissolve (HOST)        → ok (204)
  --- 9. GET /rooms/:id (HOST)        → 404 {"message":"Room không tồn tại"}
  ```
  mongosh (chỉ đọc) phòng vừa tạo: `ownerId`, `room_members.roomId/userId` đều `ObjectId`; `status DISSOLVED`, có `dissolvedAt`. Cả DB: 0 bản ghi string ở `room_members.userId`, `rooms.ownerId`, `refresh_tokens.userId`.
- **Kiểm thêm API của Step 3 mục 4 (thêm thành viên):** thêm `"  M…@TEST.com "` → MEMBER; thêm lại → `409 "Người này đã ở trong phòng"`; email chưa đăng ký → `404 "Email này chưa đăng ký tài khoản"`; MEMBER thêm người → `403`; `memberCount` 2.
- **Dev server frontend cũ hỏng (không phải lỗi code):** tiến trình `next dev` user mở lúc 21:02 (pid 9420) trả **404 cho mọi route lồng 2 cấp** — `/auth/callback`, `/join/[code]`, `/rooms/[roomId]`; manifest dev chỉ có `/dashboard`, `/login`, `/rooms`. File type nó sinh (`.next/dev/types/routes.d.ts`, `validator.ts`) thiếu route + có rác ở cuối (ghi nội dung ngắn hơn đè lên mà không cắt file) → `npm run build` frontend fail TS1109/TS1128 trong `.next/dev/types` (vì `tsconfig` include thư mục này). Không có symlink, ổ J: NTFS. **Tắt + chạy lại `npm run dev` (không xoá cache, user cho phép) → cả 5 route 200**, file type sinh lại đủ 8 route, build frontend exit 0. Chưa rõ vì sao tiến trình cũ bỏ sót route — gặp lại thì tắt `next dev` chạy lại.
- **Sửa lỗi đăng ký thiếu `displayName` (user báo khi test tay; ngoài phạm vi room, cần để test Step 3):** `RegisterDto` bắt buộc `displayName` 1–20 ký tự từ `a2e5cd4` (2026-09-16), form `/register` (`a0ce5e8`, 2026-09-19) chưa từng có ô này, chỉ gửi `{ email, username, password }` → mọi lần đăng ký qua UI bị 400 `["Display name tối đa 20 ký tự","Display name không được để trống","displayName must be a string"]`. Smoke test không bắt được vì gửi thẳng `displayName`.
  - **User duyệt hướng sửa frontend** (giữ nguyên API): `app/register/page.tsx` thêm ô "Tên hiển thị" (`required`, `maxLength={20}`); `src/context/auth.context.tsx` `register(email, username, displayName, password)` gửi thêm `displayName`. `register()` trong `src/services/auth.service.ts` không ai import → để nguyên.
  - Kiểm: đăng ký qua API với body UTF-8 `"Nguyễn Văn Ánh"` → có `accessToken`, Mongo lưu đúng tên có dấu (lần thử đầu ra `Nguy?n Van A` là do Git Bash đổi mã tham số curl, không phải backend). `npm run lint` frontend: đúng 5 lỗi có sẵn (`auth.context.tsx` 35:7, 36:7; 3 warning), không lỗi mới. `npm run build` frontend exit 0.
  - **User chốt giữ cả `username` và `displayName`** (không gộp): `username` để đăng nhập (`identifier`), unique, chỉ `a-zA-Z0-9_`; `displayName` để hiển thị, có dấu, được trùng.
- **Step 3 — chạy tay trên trình duyệt:** user test, báo **"các api ok"** (2026-10-01). Không kiểm được **đăng nhập Google** (và `returnUrl` qua Google): `backend/.env` không có `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` → `GoogleStrategy` không đăng ký.
- **Kiểm cuối:** backend `npm test` → `Test Files 5 passed (5)`, `Tests 62 passed (62)`; backend `npm run build` exit 0; frontend `npm run build` exit 0 (9 route: `○ /`, `/_not-found`, `/auth/callback`, `/dashboard`, `/login`, `/register`, `/rooms`; `ƒ /join/[code]`, `/rooms/[roomId]`).
- **`docs/api/endpoint.md`:** không đổi — mã trả về chạy thật khớp tài liệu.

### Tổng kết module room (Task 1–10)

| Task | Commit |
|---|---|
| 1 bảng quyền + `assertRoomPermission`, bỏ `isBanned` | `60b6944` |
| 2 tạo phòng | `e633438` |
| 3 tham gia bằng mã + rate limit Redis | `803fe2f` |
| 4 xem / sửa phòng, danh sách thành viên | `08bd764` |
| 5 kick | `6bfbdf9` |
| 6 rời phòng | `b711a89` |
| 7 giải tán | `e65d9bc` |
| 9a thống nhất npm (ADR-021) | `8c1db97` (docs), `c25581a` |
| 9b + 9 shadcn + frontend room | `774291a` |
| 8a HOST thêm thành viên bằng email | `316c249` |
| 10 sửa boot (`PassportModule`) | `bbff68b` |
| 10a field tham chiếu Mixed → ObjectId | `ff59027` |
| 10 sửa form đăng ký + progress | chưa commit (chờ user) |
| 8 import / export thành viên | **HOÃN** — phải làm trước bảo vệ (`[GVHD-verbal]` §13) |

- **Lệch khỏi tài liệu:** frontend ẩn/hiện nút HOST theo `myRole`, không import bảng quyền `shared/` → **lệch §15 tạm thời**; chuyển sang bảng dùng chung khi đưa frontend vào Docker (build context gốc repo).
- **Sửa ngoài phạm vi room nhưng cần cho luồng join / test:** callback Google đổi sang `window.location.replace` (trước đó AuthProvider không đọc được token sau khi chuyển trang); login đọc `returnUrl`; form đăng ký gửi `displayName` (ở trên).
- **Để lại task sau:**
  - Thu hồi socket khi kick / rời phòng — chat gateway (`TODO(chat gateway)` trong `rooms.service.ts`).
  - Kết thúc meeting ACTIVE khi giải tán — module meeting (`TODO(module meeting)`).
  - Import / export thành viên (Task 8, hoãn); mời qua email (spec §6).
  - Kiểm đăng nhập Google + `returnUrl` khi có credentials.
  - Module nào dùng `JwtAuthGuard` phải import `PassportModule.register({ session: false })`; schema mới viết `type: SchemaTypes.ObjectId`.
  - `/auth/register` chưa có trong `docs/api/endpoint.md`; `register()` trong `frontend/src/services/auth.service.ts` là code chết (thiếu `displayName`).

## 2026-10-05 — Module meeting: Task 0 (thiết kế + spec)

- **Xong:** spec `docs/task/meeting/meeting_module_spec.md` — 10 câu hỏi đã chốt, hạ tầng LiveKit dev, cấu trúc port/adapter (`MediaPort`), 4 REST + webhook, xử lý webhook idempotent theo `sid`, `endMeeting`/`finalize`, 5 đường tự hồi phục, tích hợp kick/rời/giải tán, frontend (trang room + trang meeting), test, 11 kịch bản kiểm với LiveKit thật, giới hạn, danh sách tài liệu cần sửa.
- **Commit:** `docs: spec module meeting + LiveKit, đưa docs/task vào git` (kèm bỏ dòng `docs/task` khỏi `.gitignore`, commit toàn bộ `docs/task/` — user chốt 2026-10-05).
- **Quyết định (user chốt 2026-10-04 / 05):**
  - Bỏ `ACTING_HOST` khỏi `architecture.md` (trái ADR-020).
  - Kick / rời phòng → `removeParticipant` + webhook `participant_joined` kiểm membership (LiveKit tự host không thu hồi token).
  - TURN để bước deploy; audio-only để bước benchmark.
  - 4 dependency: `livekit-server-sdk`; `livekit-client`, `@livekit/components-react`, `@livekit/components-styles`.
  - Tự kết thúc meeting bằng `emptyTimeout`/`departureTimeout` của LiveKit + `room_finished` (ADR-022 sẽ viết, `[phát sinh kỹ thuật]`, lệch PROJECT_CONTEXT §7.5).
  - ADR ghi vào `docs/decisions.md`; sửa dòng 3 bảng nguồn trong `CLAUDE.md` (đang trỏ `docs/adr/` không tồn tại).
  - Grant: một hằng số `MEMBER_GRANT` (không bảng theo role); peak ghi Mongo `$max`, bỏ key `presence:peak`.
- **Đã đối chiếu mã nguồn LiveKit (không đoán):** `livekit/livekit` `pkg/telemetry/events.go` (joined gửi khi `ParticipantActive`; left **hoặc** connection_aborted theo `IsConnected()`); `livekit/protocol` (`RoomEndReason`, `room_end_reason` = 13; webhook xếp hàng theo resource, `MaxAge` 30 s); `components-js` `useLiveKitRoom.ts` (listener gỡ trước `disconnect` khi unmount; effect kết nối gọi lại `room.connect` mỗi khi deps đổi); `client-sdk-js` `Room.connect` (chỉ chặn `Connected` + `connectFuture`, không chặn `Reconnecting`), `defaults.ts` (camera mặc định h720, simulcast bật).
- **Lệch khỏi tài liệu (sửa trong plan, spec §15):** PROJECT_CONTEXT §7.5, §15; `architecture.md` §4–§6; `webrtc.md` §2–§5; DB_DESIGN dòng 46, C.6, dòng 254/506, Phần E; `CLAUDE.md` dòng 3.
- **Phát hiện phụ:** `CLAUDE.md` nhắc `/check` nhưng repo không có `.claude/commands/` → kiểm bằng `npm test` / `build` / `lint` như các task trước.
- **Spec sửa theo review (commit `8ce2d14`, user duyệt):** `roomExists` lỗi → 502, không chốt meeting; Zod kiểm env trong constructor adapter (`npm test` không cần biến LiveKit); `webhook.urls` = `host.docker.internal:3001` cho cả backend container lẫn native.
- **Plan:** `docs/task/meeting/meeting_module_plan.md` — Task 1–10 (1 hạ tầng + spike LiveKit thật, 2 tài liệu, 3 adapter, 4–7 backend, 8–9 frontend, 10 chạy thật 11 kịch bản), mỗi session một task, thứ tự 1→10. Số test mong đợi: 62 → 75 → 90 → 101 → 113 → 128. API `livekit-server-sdk` / `@livekit/components-react` trong plan đã đối chiếu docs (context7); chỗ chưa chắc (mã lỗi "không tìm thấy", tuỳ chọn timeout, `roomEndReason`) để Task 1 đo rồi sửa plan. Chưa bắt đầu code.

## 2026-10-06 — Module meeting: Task 1 (hạ tầng LiveKit + spike)

- **Xong:** service `livekit` trong `docker-compose.yml`; `infrastructure/livekit/livekit.yaml`; `LIVEKIT_URL` của backend → `http://livekit:7880`; 6 biến LiveKit trong `backend/.env.example`; `backend/.env` thêm `LIVEKIT_PUBLIC_URL`, đổi `LIVEKIT_URL` sang `http://`; cài `livekit-server-sdk` `^2.19.1`. Chạy thật LiveKit + 2 trình duyệt + webhook (spike đã xoá, không commit).
- **Test:** `npm test` 62 passed (không đổi, task này không thêm test); `npm run build` backend OK. Backend container chạy lại, log `Nest application successfully started`.
- **Commit:** `6353ee4` `chore: LiveKit dev trong Docker Compose, cài livekit-server-sdk`.
- **Phiên bản ghim:** `livekit/livekit-server:v1.13.7` (tag mới nhất lúc đo; image có shell, binary `/livekit-server`).
- **Khai báo key một chỗ: cách A** — `entrypoint` của service ghép `LIVEKIT_KEYS="$LIVEKIT_API_KEY: $LIVEKIT_API_SECRET"` từ `env_file: backend/.env`. Tên key trong `livekit.yaml` (`webhook.api_key: devkey`) phải trùng `LIVEKIT_API_KEY`.
- **Đo được (spec §3.3):**
  - Hai trình duyệt (Chrome, camera giả) vào cùng room: cả hai `TrackSubscribed audio + video` từ người kia; webhook có `participant_joined` kèm `sid` (`PA_…`) cho từng người. ICE chạy ngay với `node_ip: 127.0.0.1`, không phải sửa gì.
  - Lỗi "không tìm thấy" của SDK: `ServerError` với `code: 'not_found'`, `status: 404` (`deleteRoom` room lạ, `removeParticipant` room lạ / người lạ). `listRooms(['room lạ'])` **không lỗi**, trả `[]`. LiveKit không chạy: `TypeError: fetch failed` (không có `code`/`status`) → `roomExists` ném lỗi, đúng spec §4.2. **`isNotFound` ở Task 3 (`code === 'not_found'` / `status === 404`) đúng, không phải sửa plan.**
  - Timeout request: có — `new RoomServiceClient(host, key, secret, { requestTimeout })`, **đơn vị giây** → Task 3 đặt `requestTimeout: 5`.
  - `roomEndReason` có trong webhook và SDK đọc ra: room trống → `room_finished` đúng 60 s sau `participant_left` cuối, `roomEndReason=2` (`ROOM_END_IDLE_TIMEOUT`); `deleteRoom` khi có người → `participant_left` rồi `room_finished` `roomEndReason=1` (`API_DELETE`), lý do đóng participant `SERVICE_REQUEST_DELETE_ROOM`. `room_started` có `roomEndReason=0`.
  - Chữ ký sai (`Authorization: abc`) → `WebhookReceiver.receive` ném `Invalid Compact JWS` → 401.
  - **Khoảng gửi lại webhook** (backend luôn trả 500): **5 lần thử trong ~15 s** (t = 0, +1, +3, +7, +15 s), rồi `giving up after 5 attempt(s)`. LiveKit dùng `webhook/resource_url_notifier.go` (ResourceURLNotifier) — khớp ước tính trong spec §3.3.6. Cửa sổ tự hồi phục thật sự chỉ ~15 s: webhook lỡ khi backend sập lâu hơn thế **không được gửi lại** → phải dựa vào đường tự hồi phục (spec §9).
- **Lệch khỏi plan:**
  - Trang `lk-test.html` thêm tự kết nối khi URL có `#<token>`, và tôi mở Chrome bằng `--use-fake-ui-for-media-stream` để chạy không cần thao tác tay (đồ bỏ).
  - Step 12 `requestTimeout` tìm thấy trong `ClientOptions.d.ts` (không cần sửa plan).
  - `backend/.env` thực tế chưa có `LIVEKIT_PUBLIC_URL` và `LIVEKIT_URL` là `ws://` → đã sửa theo Step 5. Secret dài 32 ký tự (đạt ≥ 32).
- **Task sau cần biết:**
  - Webhook tới `host.docker.internal:3001` đã kiểm với tiến trình **chạy trên host** (spike). Đường tới backend **container** (cổng publish 3001) chưa kiểm bằng webhook thật vì endpoint chưa có (hiện 404) → Task 6 Step 7 kiểm cả hai chế độ.
  - Khởi động lại container LiveKit làm mất room trong RAM (spec §3.4).
  - Frontend `lk-test.html` ở Task 6/10: tạo lại từ Phụ lục A (đã xoá).
  - `npm install` báo 1 vulnerability mức high (chưa xem, chưa chạy `npm audit fix`).

## 2026-10-06 — Module meeting: Task 2 (sửa tài liệu thiết kế theo spec §15)

- **Xong (chỉ tài liệu, không code):**
  - `CLAUDE.md` dòng 3 bảng nguồn: `docs/adr/*.md` → `docs/decisions.md` (spec câu 6).
  - `docs/decisions.md`: thêm **ADR-022** — tự kết thúc meeting bằng `emptyTimeout`/`departureTimeout` của LiveKit + webhook `room_finished`, `[phát sinh kỹ thuật]`, loại phương án cron + lock (§7.5).
  - `architecture.md`: §4 tên file module `meetings`; §5 `participant.left` hết "check rỗng → auto-end", thêm dòng `room.finished`, ghi chú `room.dissolved` / kick / rời hiện gọi thẳng `MeetingsService` `[phát sinh kỹ thuật]`; §6 lifecycle trỏ ADR-022, **xoá dòng `ACTING_HOST`**.
  - `PROJECT_CONTEXT.md`: §7.5 auto-end không dùng job (ADR-022), giữ quy tắc lock cho job khác; §15 thêm dòng `MEMBER_GRANT`.
  - `webrtc.md`: §2 token flow (`name`, `MEMBER_GRANT`, `LIVEKIT_TOKEN_TTL_HOURS`, response `{ token, livekitUrl, myRole, meeting }`); §3 webhook flow (raw body, 401, idempotent theo `sid`, peak `$max` Mongo, realtime để bước gateway, thêm `participant_connection_aborted`); §4 ghi chú dev Docker Desktop Windows.
- **Kiểm Step 6:** `Select-String ... -Pattern 'ACTING_HOST|toLiveKitGrant|docs/adr|check rỗng'` → không in gì.
- **Test:** `npm test` 62 passed (không đổi); `npm run build` backend OK. Line ending CRLF của các file giữ nguyên, `git diff --check` sạch.
- **Commit:** `b47c6e3` (user commit chung với Task 3).
- **Lệch khỏi plan:**
  - PROJECT_CONTEXT §7.5: ngoài câu plan thay, đổi luôn ví dụ `SET lock:auto-end-meetings ...` → `SET lock:<tên-job> ...` — để nguyên thì mâu thuẫn với câu "auto-end không dùng job" ngay phía trên.
  - ADR-022 không thêm câu "endedAt dư departureTimeout" vì Task 1 đã xác nhận `roomEndReason` có trong webhook.
  - Sửa dòng **Commit** của mục Task 1 thành `6353ee4` (lúc ghi còn "chưa").
- **Task sau cần biết:**
  - Còn ghi chú cũ chưa sửa, đúng lịch plan: `DB_DESIGN.md` dòng 254, 506 (index "job auto-end"), dòng 533 (`presence:peak`) → Task 6; `webrtc.md` §5 (đánh dấu đã làm / chưa làm) → Task 10; `webrtc.md` dòng 3 vẫn ghi "[PLANNED] — chưa có code".
  - `architecture.md` §4 vẫn liệt kê `DistributedLockService` trong `common/redis/` — không đụng (lock vẫn giữ cho job khác, spec không yêu cầu sửa).

## 2026-10-06 — Module meeting: Task 3 (`MediaPort` + adapter LiveKit)

- **Làm cùng session với Task 2** (user yêu cầu, Task 2 chỉ là tài liệu). Lúc bắt đầu Task 3 git status chưa sạch: còn thay đổi tài liệu của Task 2 chưa commit; Task 3 chỉ tạo file mới trong `backend/src/modules/meetings/` nên không đụng nhau.
- **Xong:**
  - `backend/src/modules/meetings/ports/media.port.ts`: `MEDIA_PORT`, `interface MediaPort` (6 hàm), `type MediaEvent` (4 dạng).
  - `backend/src/modules/meetings/adapters/livekit-media.adapter.ts`: `LivekitMediaAdapter` (Zod kiểm env trong constructor), hàm thuần `livekitEnvSchema`, `computeEndedAt`, `isNotFound`, `toMediaEvent`; hằng `MEMBER_GRANT`.
  - `livekit-media.adapter.spec.ts`: 13 test (env 4, `computeEndedAt` 3, `isNotFound` 2, `toMediaEvent` 4). Viết test trước, chạy thấy fail (chưa có file adapter), rồi mới viết code.
  - Chưa đăng ký vào `MeetingsModule` (Task 4) → app khởi động như cũ.
- **Test:** adapter spec 13 passed; `npm test` **75 passed** (62 → 75); `npm run build` exit 0. Thêm (ngoài plan): `npx tsc --noEmit -p tsconfig.json` không lỗi nào trong `modules/meetings` (chỉ còn lỗi có sẵn `test/app.e2e-spec.ts` thiếu `supertest/types`); `npx oxlint src/modules/meetings` exit 0.
- **Commit:** `b47c6e3` `feat: MediaPort và adapter LiveKit (token, room, webhook) gồm ports/ và adapters/` (user commit, gồm cả tài liệu Task 2).
- **Đối chiếu `.d.ts` của SDK đã cài (`livekit-server-sdk` 2.19.1, zod 3.25.76):** `CreateOptions` có `departureTimeout` (không phải nâng SDK); `ClientOptions.requestTimeout` đơn vị giây; `WebhookEvent.createdAt: bigint`, `roomEndReason: RoomEndReason` (`API_DELETE = 1`, `IDLE_TIMEOUT = 2`); `WebhookEvent` gán được vào `LkWebhookEvent` không cần ép kiểu.
- **Lệch khỏi plan:** `RoomServiceClient` truyền tham số thứ 4 `{ requestTimeout: 5 }` qua hằng `REQUEST_TIMEOUT_SEC` — plan ghi "nếu Task 1 thấy có tuỳ chọn timeout thì thêm", Task 1 đã thấy. Comment `isNotFound` ghi hình dạng lỗi đo ở Task 1. Không đổi interface.
- **Task sau cần biết:**
  - Task 4 đăng ký `{ provide: MEDIA_PORT, useClass: LivekitMediaAdapter }`; service inject bằng `@Inject(MEDIA_PORT)` + `import type { MediaPort }` (Global Constraints, `isolatedModules`).
  - Khi đăng ký adapter, container backend **phải có đủ 6 biến LiveKit** (`backend/.env` đã có từ Task 1) — thiếu thì app không khởi động (đúng fail-fast).
  - `toMediaEvent` không kiểm `roomName` / `identity` có phải ObjectId — việc đó ở service (Task 6, spec §6.2).

## 2026-10-06 — Module meeting: Task 4 (`MeetingsService` — bắt đầu, lịch sử, `endMeeting` / `finalize`)

- **Làm cùng session với Task 2, 3** (user yêu cầu). Task 2 + 3 user đã commit chung `b47c6e3`.
- **Xong:**
  - `meetings.service.ts`: `startMeeting` (HOST; LiveKit trước Mongo sau; tự hồi phục khi meeting ACTIVE mà room LiveKit đã đóng; `roomExists` lỗi → 502 không chốt gì; trùng index → `closeRoom` + 409; `$inc meetingCount`), `listMeetings` (lấy dư 1 để tính `hasMore`), `endMeeting` (update có điều kiện `status: ACTIVE`, `endedAt ≥ startedAt`) + `finalize` (đóng session mở, tính lại `totalDurationSeconds`, `totalParticipants`, `durationSeconds`, `DEL presence`), `toMeetingResponse`, `systemEndReason`, `viaMedia`.
  - `meetings.controller.ts`: `POST` / `GET /rooms/:roomId/meetings`. DTO `start-meeting.dto.ts`, `list-meetings-query.dto.ts`.
  - `meetings.module.ts`: thêm model `Room`, `RoomMembersModule`, `PassportModule`, controller, service, `{ provide: MEDIA_PORT, useClass: LivekitMediaAdapter }`; export `MeetingsService`.
  - `docs/api/endpoint.md`: nhóm **Meetings** (2 endpoint của task này) giữa Rooms và Chat.
- **Test:** viết `meetings.service.spec.ts` trước, chạy thấy fail (chưa có service), rồi mới viết code → 15 passed. `npm test` **90 passed** (75 → 90); `npm run build` exit 0; `tsc --noEmit` không lỗi mới (chỉ lỗi có sẵn `test/app.e2e-spec.ts`); `oxlint src/modules/meetings` 0 lỗi, 1 warning `failingQuery` chưa dùng — giữ nguyên vì là code test của plan, Task 6/7 dùng.
- **Chạy thật:** `docker compose up -d --build backend` → log `Mapped {/rooms/:roomId/meetings, POST}`, `Mapped {/rooms/:roomId/meetings, GET}`, `Nest application successfully started` (adapter đọc đủ 6 biến LiveKit). Phụ lục B — B1 dòng 1–4:
  ```
  # 1. MEMBER bắt đầu buổi học → 403
  403
  # 2. HOST bắt đầu → có id, status ACTIVE
  6ac504bdb7810c05010c6e85 Buoi 1 ACTIVE
  # 3. HOST bắt đầu lần 2 → 409
  409
  # 4. Lịch sử (MEMBER) → 1 dòng ACTIVE
  6ac504bdb7810c05010c6e85 Buoi 1 ACTIVE
  ```
  Kiểm thêm: response có đủ 12 field, không có `_id`; `listRooms` từ trong container backend → room LiveKit `6ac504bdb7810c05010c6e85` có thật, `emptyTimeout: 180`, `departureTimeout: 180`.
- **Commit:** `1613082` (user commit chung với Task 5).
- **Lệch khỏi plan:** không lệch code. Chỉ chạy `docker compose up -d --build backend` (thay vì cả stack) để không đụng container LiveKit — kết quả như nhau vì compose chỉ tạo lại service đổi.
- **Task sau cần biết:**
  - Meeting smoke `6ac504bdb7810c05010c6e85` (room `6ac504bdb7810c05010c6e82`) còn ACTIVE trong Mongo dev: room LiveKit trống tự đóng sau 180 s, nhưng `POST /webhooks/livekit` chưa có (Task 6) → `room_finished` nhận 404 → LiveKit bỏ. Dữ liệu rác vô hại; HOST bắt đầu buổi mới ở room đó sẽ đi đường tự hồi phục.
  - Task 5 thêm vào `MeetingsController` (`join`, `end`) — `@Controller()` không prefix, route viết đủ `meetings/:meetingId/...`.

## 2026-10-06 — Module meeting: Task 5 (vào meeting bằng token + HOST kết thúc)

- **Làm cùng session với Task 2–4** (user yêu cầu). Task 4 **chưa commit** lúc bắt đầu → diff Task 4 + 5 chung một working tree (cùng sửa `meetings.service.ts`, spec, controller, `endpoint.md`).
- **Xong:**
  - `meetings.service.ts`: `joinMeeting` (tìm meeting → `assertRoomAccess` → ENDED 409 → `roomExists` false thì tự hồi phục + 409, lỗi thì 502 → `createJoinToken` → `{ token, livekitUrl, myRole, meeting }`), `endByHost` (`assertRoomPermission MANAGE_MEETING` → `endMeeting HOST_ENDED` → `closeRoom`, lỗi 502; idempotent), private `findMeeting` (400 / 404).
  - `meetings.controller.ts`: `POST /meetings/:meetingId/join` (200), `POST /meetings/:meetingId/end` (204).
  - `docs/api/endpoint.md`: thêm 2 endpoint vào nhóm Meetings.
- **Test:** thêm 11 test vào `meetings.service.spec.ts` trước, chạy thấy 11 fail / 15 pass, rồi mới viết code → 26 passed. `npm test` **101 passed** (90 → 101); `npm run build` exit 0; `tsc --noEmit` không lỗi mới; `oxlint` 0 lỗi (vẫn 1 warning `failingQuery`, Task 6/7 dùng).
- **Đối chiếu trước khi code:** `JwtStrategy.validate` trả document User; `User.displayName` bắt buộc, ≤ 60 ký tự (khớp `MeetingParticipant.displayName`) → `req.user.displayName` luôn có.
- **Chạy thật:** `docker compose up -d --build backend` → log có thêm `Mapped {/meetings/:meetingId/join, POST}`, `Mapped {/meetings/:meetingId/end, POST}`, `Nest application successfully started`. Phụ lục B — B1 toàn bộ:
  ```
  # 1. MEMBER bắt đầu → 403            403
  # 2. HOST bắt đầu → ACTIVE           6ac507f61d778de28bf0f43b Buoi 1 ACTIVE
  # 3. HOST bắt đầu lần 2 → 409         409
  # 4. Lịch sử → 1 dòng ACTIVE          6ac507f61d778de28bf0f43b Buoi 1 ACTIVE
  # 5. MEMBER vào                       ws://localhost:7880 / MEMBER / token 359 ký tự
  # 6. MEMBER kết thúc → 403            403
  # 7. HOST kết thúc → OK; bấm lại → OK OK / OK
  # 8. MEMBER vào lại → 409             409
  # 9. Lịch sử → ENDED, HOST_ENDED      Buoi 1 ENDED HOST_ENDED 11
  ```
  Dòng 5 = container backend gọi được LiveKit qua `http://livekit:7880` (`roomExists`).
- **Kiểm thêm (ngoài plan) — `finalize` lần đầu chạy trên Mongo thật:** script đồ bỏ chèn tay vào Mongo 1 `meeting_participants` (session 1 đã đóng 1 s, session 2 còn mở) + `SADD presence:{id}` — giả dữ liệu webhook Task 6 sẽ ghi — rồi HOST kết thúc. Kết quả đọc thẳng Mongo / Redis:
  - Meeting: `ENDED`, `HOST_ENDED`, `endedBy` lưu đúng ObjectId, `durationSeconds 11` = `endedAt − startedAt`, `totalParticipants 1`.
  - `updateMany` + `arrayFilters`: session 1 giữ `leftAt` cũ, session 2 `leftAt` = `endedAt`; `totalDurationSeconds 9` = 1 + 8 (đúng giá trị tính tay).
  - Bấm kết thúc lần 2: `endedAt` không đổi (`14:38:57.920Z` cả hai lần).
  - Key `presence:{id}` đã xoá (`EXISTS` 1 → 0).
  - LiveKit: `listRooms` sau `/end` → `[]`; lần bấm 2 gọi `DeleteRoom` room đã mất → `isNotFound` nuốt lỗi → vẫn 204 (kiểm được với LiveKit thật).
- **Commit:** `1613082` `feat: bắt đầu / vào / kết thúc buổi học bằng LiveKit, lịch sử buổi học` (user commit, gồm cả Task 4).
- **Lệch khỏi plan:** không lệch code. `docker compose up -d --build backend` thay vì cả stack (như Task 4).
- **Task sau cần biết:**
  - Dữ liệu thử trong Mongo dev: meeting `6ac507f61d778de28bf0f43b` có 1 `meeting_participants` chèn tay (session có field `sid` — schema chưa có tới Task 6). Vô hại.
  - Log LiveKit có `sent webhook room_finished` tới `host.docker.internal` lúc HOST kết thúc — backend chưa có route (Task 6), chưa xem backend trả mã gì.

## 2026-10-06 — Module meeting: Task 6 (webhook LiveKit — `meeting_participants`, presence, tự kết thúc)

- **Làm cùng session với Task 2–5** (user yêu cầu). Task 4 + 5 user đã commit `1613082`; bắt đầu Task 6 git status sạch, `npm test` 101 passed.
- **Xong:**
  - `meetings.service.ts`: `handleMediaEvent` (bỏ qua `ignored` / room không phải ObjectId 24 hex / không có meeting / identity không phải userId; `room_finished` → `endMeeting` lý do hệ thống), `onParticipantJoined` (meeting ENDED hoặc không còn thành viên → `removeParticipant`; lỗi không phải `HttpException` → ném 500; upsert participant, `$push` session theo `sid`, `SADD` + `EXPIRE 86400`, `$max peakParticipants`), `onParticipantLeft` (đóng session theo `sid` bằng `arrayFilters`; hết session mở → `SREM`).
  - `media-webhook.controller.ts` (`POST /webhooks/livekit`, không JWT, 200 / 401 / 500); đăng ký trong `meetings.module.ts`.
  - `meeting-participant.schema.ts`: `ParticipantSession.sid` (bắt buộc). `redis.service.ts`: `scard`. `main.ts`: `rawBody` + parser `application/webhook+json`.
  - `docs/database/DB_DESIGN.md`: dòng 46 (peak `$max`), C.5 comment thống kê, index `{status, startedAt}` (dòng 254 + bảng tổng hợp), C.6 `sid` + đoạn Idempotent, Phần E bỏ `presence:peak`. `docs/api/endpoint.md`: `POST /webhooks/livekit`.
- **Test:** thêm 12 test vào `meetings.service.spec.ts` trước → 12 fail / 26 pass → viết code → 38 passed. `npm test` **113 passed** (101 → 113); `npm run build` exit 0; `tsc --noEmit` không lỗi mới; `oxlint` (meetings, `main.ts`, `redis.service.ts`) sạch — warning `failingQuery` hết vì test Task 6 đã dùng.
- **LỖI TRONG PLAN — `main.ts` (đã sửa, đo bằng request thật):** code plan `app.useBodyParser('json', { type: 'application/webhook+json' })` làm **mất body JSON của mọi route REST**. Nguyên nhân (đọc `@nestjs/platform-express` 12.0.3 `ExpressAdapter`): `useBodyParser` gọi trước `init()` đăng ký middleware tên `jsonParser`; lúc `init()`, `registerParserMiddleware` thấy `isMiddlewareApplied('jsonParser')` → **bỏ qua parser JSON mặc định** (`application/json`). Đo: build container với code plan → `POST /auth/register` body hợp lệ trả `400` (mọi field báo thiếu). Unit test + build không bắt được (113 passed). Sửa 1 dòng: `type: ['application/json', 'application/webhook+json']` — parser của mình thay luôn parser mặc định, cùng tuỳ chọn (limit mặc định, `verify` lưu rawBody). Sau sửa: register `OK`, webhook không chữ ký `401`.
- **Chạy thật — chế độ container:** log `Mapped {/webhooks/livekit, POST}`.
  1. `curl` không chữ ký → `401`.
  2. B1 dòng 1–5: 403 / ACTIVE / 409 / 1 dòng ACTIVE / `ws://localhost:7880 MEMBER token 359`.
  3. Sau khi MEMBER vào (Chrome): `meeting_participants` 1 bản ghi `displayName 'Member'`, `roleAtJoin 'MEMBER'`, 1 session `sid 'PA_AEoVgTohDBYg'`, `leftAt: null`; `presence:{id}` = `[userId MEMBER]`, TTL 86371; meeting `ACTIVE`, `peakParticipants: 1`.
  4. Tắt Chrome → session `leftAt 15:18:29` (LiveKit báo rời ~20 s sau khi tắt đột ngột — chờ client kết nối lại); presence đã xoá (`EXISTS 0`).
  5. Room trống → LiveKit `room closed` 15:21:29.118 (đúng 180 s) → `room_finished` → meeting `ENDED`, `AUTO_EMPTY`, `endedAt 15:18:29` = `leftAt` của MEMBER (**lệch 0 s** — `roomEndReason` IDLE_TIMEOUT thật), `totalParticipants 1`, `durationSeconds 84`, `totalDurationSeconds` MEMBER 67 (= 15:18:29 − 15:17:22).
  - Thêm: meeting `6ac50f4913eb08e65b1e423e` (lần vào thất bại, xem dưới) cũng tự chốt `AUTO_EMPTY` qua `room_finished`, `endedAt` = lúc kết nối hỏng rời room.
- **Sự cố hạ tầng lúc chạy thật — LiveKit vào room chậm 14 s (đã điều tra, chưa rõ gốc):** lần vào đầu, client hết hạn chờ signal 15 s (`room connection has timed out (signal)`). Bằng chứng: LiveKit log `starting RTC session` chậm 14 s sau khi client mở WebSocket; 3 lần thử `startConnection` (mã nguồn v1.13.7 `rtcservice.go`: thử lại với timeout 3 / 4 / 5 s) đều treo trước `StartSession`; IPv4 / IPv6 tới `localhost:7880` đều ~1 ms (loại giả thuyết mạng). Log Task 1 cũng có dấu hiệu tương tự (2 trình duyệt cùng "starting RTC session" cách nhau 2 ms, chậm 12,8 s — lúc đó chưa vượt 15 s nên không lộ). **Khởi động lại container LiveKit (đã chạy 8 giờ) → vào được ngay (signal 0,6–1,3 s)**, kiểm cả log level `debug` lẫn `info`. Không tìm được gốc trong phạm vi task; ghi để Task 9/10 để ý (nếu lặp lại: `docker compose restart livekit`, bật `logging.level: debug` để xem).
- **Commit:** `2e1385a` `feat: webhook LiveKit ghi người tham gia, presence, tự kết thúc meeting` (user cho phép 2026-10-06; kèm ghi chú sửa `main.ts` trong plan Task 6 Step 6).
- **Lệch khỏi plan:**
  - `main.ts`: sửa như trên (lỗi kỹ thuật, giữ đúng hành vi plan muốn).
  - Step 7 không đặt `lk-test.html` vào `frontend/public` + `npm run dev`: dùng Phụ lục A (thêm tự kết nối khi URL có `#<token>`, như Task 1) trong scratchpad, mở bằng **Chrome headless** `--use-fake-device-for-media-stream --use-fake-ui-for-media-stream` qua `file://` (spec §13 cho phép). "Đóng tab" = tắt tiến trình Chrome. Không có file nào trong repo phải dọn.
  - Tạm đổi `infrastructure/livekit/livekit.yaml` `logging.level` → `debug` để điều tra, **đã trả về `info`** (`git diff` rỗng).
  - `docker compose up -d --build backend` thay vì cả stack (như Task 4, 5).
- **Task sau cần biết:**
  - Task 7 (`removeFromActiveMeeting`, `endActiveMeetingOfRoom`) dùng lại `endMeeting`, `media.removeParticipant`, `media.closeRoom`; webhook `participant_joined` đã chặn người không còn là thành viên (spec §1 câu 2).
  - Khởi động lại LiveKit lúc 15:17 và 15:22 → mọi room cũ trong RAM mất; meeting thử `6ac5121613eb08e65b1e4250` (MEMBER đã rời) sẽ tự chốt `AUTO_EMPTY` sau 3 phút.
  - Dữ liệu thử trong Mongo dev: các meeting `6ac50f49…`, `6ac510ef…`, `6ac51216…` + user `h*/m*/probe*@test.com`.

## 2026-10-07 — Module meeting: Task 7 (kick / rời / giải tán phòng → đưa ra khỏi call, kết thúc meeting)

- **Bắt đầu:** git status sạch (Task 6 đã commit `2e1385a`), `npm test` 113 passed.
- **Xong:**
  - `meetings.service.ts`: `removeFromActiveMeeting(roomId, userId)` (có meeting ACTIVE → `removeParticipant`), `endActiveMeetingOfRoom(roomId)` (tìm meeting ACTIVE → (a) `endMeeting ROOM_DISSOLVED` → (b) `closeRoom`, mỗi bước try/catch riêng, (a) lỗi vẫn chạy (b)). Cả hai **không bao giờ ném lỗi**, chỉ ghi log (spec §8).
  - `rooms.service.ts`: constructor thêm tham số thứ 6 `meetings: MeetingsService`; `kickMember` gọi `removeFromActiveMeeting` **sau** khi xoá thành viên thành công; `leaveRoom` luôn gọi (kể cả khi `deleteOne` xoá 0 bản ghi); `dissolveRoom` gọi `endActiveMeetingOfRoom` sau `updateOne` DISSOLVED (thay `TODO(module meeting)`). `rooms.module.ts` import `MeetingsModule`.
  - `docs/api/endpoint.md` nhóm Rooms: lỗi LiveKit không đổi mã `204`; rời / kick → bị đưa ra khỏi cuộc gọi; giải tán → `ROOM_DISSOLVED` (bỏ dòng "Chưa làm").
- **Test:** 8 test meetings viết trước → 8 fail (`is not a function`) / 38 pass → code → 46 passed. 7 test rooms viết trước → 4 fail / 43 pass (3 test "không gọi meeting" pass sẵn) → code → pass. `npm test` **128 passed** (113 → 128); `npm run build` exit 0; `tsc --noEmit` không lỗi mới (chỉ lỗi có sẵn `test/app.e2e-spec.ts`); `oxlint src/modules/meetings src/modules/rooms` exit 0.
- **Chạy thật — container:** `docker compose up -d --build backend` → `MeetingsModule dependencies initialized`, `RoomsModule dependencies initialized`, `Nest application successfully started` (không lỗi DI vòng). Phụ lục B — B1 + B2:
  ```
  # 1–9 (B1)                                     403 / ACTIVE / 409 / 1 dòng ACTIVE / ws://localhost:7880 MEMBER 359 / 403 / OK OK / 409 / ENDED HOST_ENDED
  # 10. kick MEMBER (không ở trong room LiveKit) OK
  # 11. HOST giải tán                            OK
  # 12. meeting vừa tạo                          status 'ENDED', endReason 'ROOM_DISSOLVED', endedAt 13:46:31.133Z
  # 13. log backend                              không có dòng lỗi
  ```
  Log LiveKit: dòng 10 `RemoveParticipant` → `404` (adapter nuốt "không tìm thấy", kick vẫn 204); dòng 11 `DeleteRoom` `200` (`API_DELETE`) sau khi Mongo đã chốt, `room_finished` gửi tới backend.
- **Chạy thật thêm (ngoài plan) — người đang Ở TRONG call** (B2 chỉ thử khi MEMBER không ở trong call; đường này mock không kiểm được). 3 Chrome headless (camera giả) mở trang `lk-test.html` đồ bỏ trong scratchpad (Phụ lục A + tự kết nối khi URL có `#<token>`, in `RoomEvent.Disconnected` ra console). HOST + Member1 + Member2 cùng vào: presence 3, `peakParticipants 3`.
  1. **HOST kick Member1** → `204`; Member1 bị ngắt `reason=4 PARTICIPANT_REMOVED`; webhook `participant_left` → session `leftAt 13:50:55`, ra khỏi presence.
  2. **Member1 vào lại bằng token LiveKit cũ** (bật cam + mic) → `Connected`, **1,9 s** sau bị ngắt `PARTICIPANT_REMOVED`; Mongo không có session mới, presence không có Member1 (spec §13 kịch bản 10 — code Task 6).
  3. **Member2 tự rời phòng** → `204`; bị ngắt `PARTICIPANT_REMOVED` ngay khi request trả về; session đóng, ra khỏi presence; `GET /rooms/:id` → `403`.
  4. **HOST giải tán khi còn trong call** → `204`; HOST bị ngắt `reason=5 ROOM_DELETED`. Meeting `ENDED`, `ROOM_DISSOLVED`, `endedBy null`, `endedAt 13:59:11.116` (sau `dissolvedAt 13:59:11.073`), `totalParticipants 3`, `durationSeconds 620` (= endedAt − startedAt). Session HOST được `finalize` đóng bằng `endedAt`; `totalDurationSeconds` 600 / 104 / 267 (đúng tính tay). Key `presence:{id}` đã xoá. `room_finished` tới sau không ghi đè `endedAt`. Sau đó join → `404`, bắt đầu buổi mới → `404`.
  - Log backend suốt đợt chạy: không có dòng WARN / ERROR. Chrome headless đã tắt hết; không có file nào trong repo phải dọn.
- **Commit:** gộp chung một commit với Task 8 + 9 (user chốt 2026-10-08: "commit 1 lần") — xem mục Task 9.
- **Lệch khỏi plan:**
  - Log của 2 hàm mới in thêm id cho đủ spec §8 ("ghi log kèm `roomId`, `meetingId`, `userId`"): `removeFromActiveMeeting` giữ `meetingId` trong biến (`'?'` khi Mongo lỗi trước lúc biết id); log bước (a), (b) của `endActiveMeetingOfRoom` in thêm `roomId`. Hành vi không đổi. Đã chú thích dưới Step 3 trong plan.
  - `docker compose up -d --build backend` thay vì cả stack (như Task 4–6).
- **Task sau cần biết:**
  - Spec §12.1 ghi "kick lỗi (400 / 403 / 404) → không gọi meeting"; plan chỉ test 403 / 404. Đường 400 (userId sai / tự kick) `throw` trước `removeMember` nên không thể gọi meeting — không thêm test (giữ đúng bộ test của plan).
  - Kick bằng `userId` **viết hoa** (chỉ khi gửi request tay; frontend luôn gửi id thường): Mongo vẫn xoá đúng thành viên, nhưng identity LiveKit phân biệt hoa thường → `removeParticipant` báo "không tìm thấy" (bị nuốt) → người đó còn trong call tới khi tự thoát (như giới hạn spec §14.1; vào lại vẫn bị webhook chặn). Chưa sửa — ngoài plan.
  - Spec §13 kịch bản 10 mong log backend có dòng "không phải thành viên → removeParticipant", nhưng `onParticipantJoined` (Task 6) không ghi log ở nhánh này; plan Task 10 Step 5 chỉ kiểm "không có lỗi" → Task 10 kiểm bằng log LiveKit (`participant closing … SERVICE_REQUEST_REMOVE_PARTICIPANT`, `RemoveParticipant` 200) hoặc thêm 1 dòng log.
  - Độ trễ request có gọi LiveKit — **chưa rõ gốc**, không do code Task 7: lần gọi đầu sau vài phút backend nghỉ có lúc chậm (join 1,18 s so với 50–120 ms các lần sau; rời phòng 1,8 s, trong đó ~1 s nằm giữa lúc ghi Mongo và lúc LiveKit nhận `RemoveParticipant`), có lúc không (giải tán 0,39 s). DNS `livekit` trong container 17–71 ms → không phải DNS. Bước benchmark đo join latency (`webrtc.md` §7) nên tách lần gọi đầu.
  - Dữ liệu thử trong Mongo dev: phòng `6ac64d32…` (B2), `6ac64dc1…` (chạy thật) đã giải tán; user `h*/m*/rth*/rtm*/rtn*@test.com`.

## 2026-10-07 — Module meeting: Task 8 (frontend — khu "Buổi học" ở trang phòng)

- **Bắt đầu:** Task 7 chưa commit (user: "không cần commit") → git status không sạch, Task 8 chỉ sửa `frontend/` nên không đụng nhau. Backend `npm test` 128 passed (chạy lại cuối task — backend không đổi).
- **Xong:**
  - `src/services/room.service.ts`: `export` hàm `request` (dùng lại, không tạo helper mới — spec §11.1).
  - `src/types/meeting.ts`: `Meeting`, `MeetingListResponse`, `JoinMeetingResponse`, `MeetingStatus`, `EndReason` — đã đối chiếu `toMeetingResponse` / `joinMeeting` backend (đủ 12 field).
  - `src/services/meeting.service.ts`: `startMeeting`, `listMeetings` (20 buổi gần nhất), `joinMeeting`, `endMeeting`.
  - `src/features/meetings/meeting-section.tsx`: `MeetingSection` — `items[0]` ACTIVE → tên + **Tham gia** (+ **Kết thúc** cho HOST, có `confirm`); không có buổi ACTIVE → HOST thấy ô tên (không bắt buộc — bỏ trống thì tên "Buổi học dd/MM HH:mm" theo giờ **lúc bấm**, xem "Sửa sau review" dưới) + **Bắt đầu** → chuyển thẳng `/meetings/<id>`; lỗi (409…) → hiện lỗi + tải lại danh sách; lịch sử có thời lượng, tối đa / tổng số người, nhãn lý do kết thúc.
  - `app/rooms/[roomId]/page.tsx`: gắn `<MeetingSection>` giữa khối "Mời người khác vào phòng" và "Thành viên".
- **Kiểm:** frontend `npm run build` exit 0; `npm run lint` 5 problems (2 errors, 3 warnings) — **đúng y các lỗi có sẵn** trước khi sửa (`auth.context.tsx` 35:7, 36:7, 103:5; `auth.service.ts` 25:3; `app/page.tsx` 9:9), không lỗi mới. Không viết unit test (page UI — CLAUDE.md).
- **Sự cố môi trường (đã xử lý, không phải code):** build gốc **trước khi sửa** đã fail `TS1005` / `TS1128` trong `.next/dev/types/routes.d.ts` + `validator.ts` — file do `next dev` tự sinh (2026-10-06 13:58), bị lặp phần đuôi (ghi đè nội dung ngắn hơn mà không cắt), danh sách route còn thiếu `/rooms/[roomId]`. Xoá `.next/dev/types` (gitignore, `next dev` tự sinh lại) → build gốc exit 0. Gốc chưa rõ; nghi `next dev` và `next build` (hoặc 2 dev server) cùng ghi một lúc → task này chỉ build khi đã tắt dev server.
- **Chạy thật (Step 6) — tự động bằng 2 Chrome headless** (2 profile = 2 localStorage), điều khiển qua DevTools Protocol bằng script đồ bỏ trong scratchpad (chỉ dùng `fetch` / `WebSocket` có sẵn của Node 22, không thêm package); đăng nhập = đặt `accessToken` vào localStorage; bấm nút thật, đọc DOM, đọc Mongo, chụp màn hình để xem giao diện. Backend + LiveKit trong Docker, `npm run dev`. Kết quả lần chạy cuối (bản **trước** "Sửa sau review" — dòng 6.1 đầu tiên là hành vi cũ "điền sẵn"):
  ```
  PASS  6.1 ô tên điền sẵn "Buổi học dd/MM HH:mm" theo giờ máy   ["Buổi học 07/10 21:45" / máy "Buổi học 07/10 21:45"]
  PASS  6.1 thứ tự khối: Mời người khác → Buổi học → Thành viên
  PASS  6.1 Bắt đầu → chuyển sang /meetings/<id>   [6ac65af6a9f21d32c13423c0]
  PASS  6.1 trang /meetings/<id> chưa có → 404 (đúng ở task này)
  PASS  6.1 Mongo lưu đúng tên đã điền, ACTIVE
  PASS  6.1 HOST: tên buổi + "Đang diễn ra từ" / link Tham gia → /meetings/<id> / có Kết thúc, không còn ô Bắt đầu
  PASS  6.2 MEMBER: thấy buổi đang diễn ra + Tham gia; không có Kết thúc, không có ô Bắt đầu
  PASS  6.3 có hộp xác nhận "Kết thúc buổi học? Mọi người trong cuộc gọi sẽ bị ngắt."
  PASS  6.3 buổi học xuống lịch sử, nhãn "Host kết thúc"; ô Bắt đầu hiện lại; Mongo ENDED HOST_ENDED
        lịch sử: Buổi học 07/10 21:45 · 21:45:11 7/10/2026 · 0 phút · tối đa 0 / tổng 0 người · Host kết thúc
  PASS  MEMBER (không có buổi ACTIVE): "Chưa có buổi học nào đang diễn ra." + lịch sử
  PASS  409: (buổi bắt đầu qua API khi trang HOST còn ô Bắt đầu) hiện lỗi "Phòng đang có buổi học diễn ra",
        danh sách tải lại thấy buổi đang diễn ra, vẫn ở trang phòng; bấm Kết thúc xoá lỗi cũ
  PASS  6.4 bấm 2 lần → đúng 1 buổi ACTIVE, chỉ tạo thêm 1 buổi   [ACTIVE=1, thêm 1] — trang chuyển sang /meetings/<id>
  console error/warning + exception — HOST: 0, MEMBER: 0
  ALL PASS
  ```
  - 6.4 có **2 request song song thật**: log LiveKit 14:45:43.821 / .845 hai `CreateRoom` (`…c5`, `…c4`) rồi `DeleteRoom …c4` — request thứ hai qua được bước kiểm ACTIVE, bị unique partial index chặn ở `Meeting.create` → `closeRoom` room thừa → 409 (đúng spec §5.2 bước 4).
  - Thêm (ngoài plan): buổi của 6.4 không ai vào → LiveKit tự đóng sau 180 s → `AUTO_EMPTY`, `endedAt` = `startedAt` (thời lượng 0, spec §7.2) → trang MEMBER hiện nhãn **"Tự kết thúc"**. Nhãn "Phòng giải tán" không xem được trên UI (phòng giải tán thì trang phòng trả 404).
  - Ảnh chụp đã xem: khối Buổi học khi chưa có buổi / đang diễn ra (HOST có Kết thúc, MEMBER không) / lỗi 409 / lịch sử — bố cục đúng, cùng kiểu card với trang phòng.
- **Sửa sau review — tên buổi học (user chốt 2026-10-07):**
  - Lỗi của bản plan: `useState(defaultTitle)` tính giờ **một lần lúc khối Buổi học hiện ra** → để trang phòng mở lâu rồi mới bấm Bắt đầu (kể cả lần đầu, hoặc sau khi bấm Kết thúc ngay trên trang) thì tên mang giờ lúc mở trang. Chỉ sai tên hiển thị; `startedAt` do server ghi vẫn đúng.
  - User hỏi tên có quan trọng không (Google Meet không đặt tên) → đề cương không yêu cầu tên (chỉ "Lịch sử meeting sẽ được lưu lại trong phòng"); `title` chỉ để hiển thị. User chọn **giữ ô để đặt tên riêng**.
  - Sửa `meeting-section.tsx`: `useState('')`, bỏ `required`, thêm `placeholder="Tên buổi học (bỏ trống: Buổi học + ngày giờ bắt đầu)"`; `start()` gửi `title.trim() || defaultTitle()` → bỏ trống / chỉ dấu cách thì tên tính **lúc bấm**. Gợi ý không ghi giờ cụ thể vì giờ trong gợi ý cũng sẽ cũ như lỗi đang sửa. Backend, API, schema không đổi.
  - Tài liệu sửa theo: spec §5.2 + §11.2 (`[user chốt 2026-10-07]`), `endpoint.md` (dòng `title`), comment `start-meeting.dto.ts`, ghi chú dưới Step 3 Task 8 trong plan.
  - Kiểm: frontend build exit 0, lint 5 problems có sẵn (không lỗi mới); backend `npm test` 128 passed, build exit 0. Chạy thật (Chrome headless):
    ```
    PASS  ô tên để trống, có gợi ý, không bắt buộc   [{"value":"","placeholder":"Tên buổi học (bỏ trống: Buổi học + ngày giờ bắt đầu)","required":false}]
          trang mở lúc 22:54:31, chờ 30 s sang phút mới rồi mới bấm
    PASS  không gõ gì → tên theo giờ lúc bấm, không phải giờ mở trang   ["Buổi học 07/10 22:55" / lúc mở "Buổi học 07/10 22:54" / lúc bấm "Buổi học 07/10 22:55"]
    PASS  gõ tên riêng → lưu đúng tên (đã bỏ khoảng trắng 2 đầu)   [Ôn thi chương 3]
    PASS  chỉ gõ dấu cách → tên mặc định theo giờ lúc bấm, không lỗi 400   [Buổi học 07/10 22:55]
    console error/warning + exception: 0
    ALL PASS
    ```
  - Trục trặc của script test (không phải code app): (1) dùng lại profile Chrome cũ còn token hết hạn → `AuthProvider` gọi `/auth/me` bị 401 và `removeItem` xoá luôn token mới đặt → trang đá về `/login`; sửa script dùng profile mới mỗi lần. (2) Một lần `fetch failed` ở client Node khi gọi `POST /meetings/:id/end` (backend vẫn chạy bình thường) — nghi kết nối keep-alive bị server đóng, **chưa xác nhận**; thêm thử lại 1 lần, lần chạy cuối không gặp lại. Buổi bị bỏ dở lúc đó tự kết thúc `AUTO_EMPTY` sau đúng 180 s.
- **Commit:** gộp chung một commit với Task 7 + 9 (user chốt 2026-10-08) — xem mục Task 9.
- **Lệch khỏi plan:**
  - Code đúng như plan; chỉ thêm 1 dòng ghi chú trên `export async function request` (lý do export).
  - Step 6 (chạy tay 2 profile Chrome) làm tự động bằng Chrome headless + CDP thay vì bấm tay; kiểm thêm đường 409, MEMBER khi không có buổi ACTIVE, nhãn `AUTO_EMPTY`.
- **Task sau cần biết:**
  - Task 9 tạo `app/meetings/[meetingId]/page.tsx` — hiện `/meetings/<id>` là 404 (đúng). Dùng `joinMeeting` / `endMeeting` / kiểu `JoinMeetingResponse` từ Task 8.
  - Nếu `next build` báo lỗi TS trong `.next/dev/types/*`: xoá `.next/dev/types` rồi build lại; không chạy `next build` khi `next dev` đang chạy.
  - **Phiên đăng nhập frontend chỉ sống 15 phút** (`JWT_EXPIRES_IN=15m`; backend có schema `refresh-token` nhưng không có endpoint làm mới, frontend không làm mới token — PROJECT_CONTEXT thiết kế "access 15m + refresh rotation" nhưng chưa làm). Ảnh hưởng Task 9 / 10: HOST ở trong cuộc gọi > 15 phút bấm "Kết thúc buổi học" sẽ nhận 401 (cuộc gọi LiveKit vẫn chạy vì token LiveKit 6h); tải lại trang thì bị đưa về `/login`. Có sẵn từ module auth, ngoài phạm vi module meeting — cần quyết khi test kịch bản dài.
  - Container backend chạy `nest start --watch` nhưng **không thấy file đổi từ ổ Windows** (sửa `start-meeting.dto.ts` không làm backend khởi động lại) → sửa code backend vẫn phải `docker compose up -d --build backend` như Task 4–7.
  - Dữ liệu thử trong Mongo dev: 4 phòng "Phong UI Task 8", 3 phòng "Phong UI ten buoi hoc", user `uih*/uim*/uit*@test.com`; mọi buổi thử đã ENDED.

## 2026-10-07/08 — Module meeting: Task 9 (frontend — trang cuộc gọi `/meetings/[meetingId]`)

- **Bắt đầu:** Task 7 + 8 chưa commit (user: "không cần commit") → git status không sạch; Task 9 chỉ tạo file mới trong `frontend/` + sửa `package.json` / lock nên không đụng nhau. Backend `npm test` 128 passed.
- **Xong:**
  - Cài 3 package đã duyệt: `livekit-client` `^2.22.3`, `@livekit/components-react` `^2.9.24`, `@livekit/components-styles` `^1.2.0` (`npm install`, **không lỗi peer dependency**, không cần `--legacy-peer-deps`).
  - `src/features/meetings/meeting-stage.tsx`: `MeetingStage` — `useTracks` (camera có placeholder + màn hình chia sẻ) → `GridLayout` / `ParticipantTile`, `ControlBar controls={{ chat: false }}`, `RoomAudioRenderer`. Đúng như plan.
  - `app/meetings/[meetingId]/page.tsx`: gọi `joinMeeting` có cờ huỷ, chỉ render `<LiveKitRoom>` khi có token; `ROOM_OPTIONS` cấp module (adaptiveStream, dynacast, quay 360p); 4 callback `useCallback` deps cố định, cờ "đã kết nối" trong `useRef`; thông báo theo `DisconnectReason`; banner lỗi thiết bị; HOST có "Kết thúc buổi học". Theo plan + 2 chỗ sửa dưới.
- **Đối chiếu mã thật trước khi tin plan:** `LiveKitRoomProps` (`.d.ts` 2.9.24) khớp mọi prop plan dùng. `src/hooks/useLiveKitRoom.ts` bản đã cài **giống phân tích spec §11.4**: effect gắn listener khai báo trước effect `disconnect` khi unmount; effect kết nối deps `[connect, token, JSON.stringify(connectOptions), room, onError, serverUrl, simulateParticipants]`; `Room` tạo trong effect. `ControlBar`: nút chat chỉ hiện khi `canPublishData && controls.chat`. Docs Next 16 trong `node_modules/next/dist/docs` (theo `frontend/AGENTS.md`): `useParams` dùng trong client component, import CSS của package được ở bất kỳ đâu trong `app/`.
- **LỖI TRONG PLAN 1 — lỗi thiết bị thành màn hình chặn (đã sửa, đo trước / sau):** `useLiveKitRoom` bật cam / mic ở `RoomEvent.SignalConnected` — trước khi chờ ICE và trước `Connected` (`livekit-client` `Room.ts` dòng 1090 → 1119 → 1139); `LocalParticipant.setTrackEnabled` gặp lỗi `getUserMedia` thì phát `MediaDevicesError` **rồi ném lại** → `Promise.all` reject → `onError(e)`. ⇒ Chặn quyền camera: `onError` chạy khi `connectedRef` còn `false` → code plan hiện màn hình "Không kết nối được buổi học". Đo bằng Chrome headless chặn camera, giữ micro:
  ```
  # code plan (tạm bỏ dòng sửa)
  MEMBER sau 8 s: "Không kết nối được buổi học: Client initiated disconnect  Vào lại  ← Về phòng"   ô=0
  FAIL  MEMBER thấy banner lỗi camera / FAIL vẫn ở trong cuộc gọi / FAIL HOST thấy ô MEMBER + nghe micro MEMBER
  # sau khi sửa
  MEMBER sau 8 s: "Không bật được camera: trình duyệt chưa được cấp quyền. Bạn vẫn nghe và xem được mọi người; …"   ô=2
  PASS ×3   ALL PASS
  ```
  Sửa 1 dòng đầu `onError`: `if (err instanceof DOMException) return;` — lỗi `getUserMedia` (`NotAllowedError`, `NotFoundError`, `NotReadableError`) là `DOMException`; lỗi kết nối của LiveKit là `ConnectionError` / `Error` thường → vẫn chặn như spec. (`MediaDeviceFailure.getFailure` không dùng được để phân biệt: trả `Other` cho mọi `Error`.) Giữ đúng hành vi spec §11.5; ghi chú dưới Step 3 Task 9 trong plan + 1 dòng ở spec §11.5.
- **LỖI TRONG PLAN 2 — tên buổi học không nhìn thấy (đã sửa):** `data-lk-theme="default"` ở div ngoài → CSS `[data-lk-theme]{ color: var(--lk-fg) }` làm `<h1>` tên buổi học chữ trắng trên nền trắng (thấy trên ảnh chụp, DOM vẫn có chữ). Chuyển `data-lk-theme` xuống `<LiveKitRoom>` (nhận HTML attribute, tự có nền tối `.lk-room-container`). Kiểm: màu chữ `<h1>` `lab(2.75 0 0)` trên nền `lab(100 0 0)`, vùng cuộc gọi `rgb(17, 17, 17)`.
- **Kiểm (code cuối):**
  ```
  frontend  npm run build   ✓ Compiled successfully · Finished TypeScript · route ƒ /meetings/[meetingId] · exit 0
  frontend  npm run lint    ✖ 5 problems (2 errors, 3 warnings) — đúng y lỗi có sẵn: auth.context.tsx 35:7, 36:7, 103:5; auth.service.ts 25:3; app/page.tsx 9:9
  backend   npm test        Test Files 7 passed (7) · Tests 128 passed (128)
  backend   npm run build   nest build · exit 0
  ```
  Không viết unit test (page UI — CLAUDE.md). Build chỉ chạy khi đã tắt `next dev`.
- **Chạy thật (Step 5) — tự động bằng Chrome headless + DevTools Protocol** (script đồ bỏ trong scratchpad, chỉ `fetch` / `WebSocket` của Node 22 như Task 8): mỗi bên 1 Chrome (camera / mic giả), đăng nhập = đặt `accessToken`; HOST bấm **Bắt đầu** ở trang phòng, MEMBER bấm **Tham gia**; đọc DOM, Mongo, Redis, chụp ảnh. Backend + LiveKit trong Docker, `npm run dev` (Strict Mode). Lần chạy cuối (code cuối):
  ```
  PASS  hai bên thấy nhau: mỗi trang 2 ô camera có hình   [Host T9:640x360, Member T9:640x360]
  PASS  hai bên nghe nhau: mỗi trang có <audio> track micro của người kia đang chạy   [HOST=1 MEMBER=1]
  PASS  thanh điều khiển không có nút chat   [Microphone | Camera | Share screen | Leave]
  PASS  HOST có nút "Kết thúc buổi học", MEMBER không có
  PASS  tên buổi học ở header nhìn thấy được; vùng cuộc gọi vẫn nền tối theo theme LiveKit
  PASS  Strict Mode (npm run dev): ở yên 5 s vẫn trong cuộc gọi, không bị đá về trang phòng
  PASS  Mongo: 2 participant, mỗi người đúng 1 session có sid, leftAt null
  PASS  Redis presence 2 userId · PASS peakParticipants = 2
  PASS  MEMBER chia sẻ màn hình → HOST thấy ô màn hình có hình   [960x540; nút MEMBER đổi thành "Stop screen share"]
  PASS  MEMBER bấm Rời → về trang phòng, không hiện "Mất kết nối"
  PASS  Mongo: session MEMBER có leftAt · PASS presence chỉ còn HOST · PASS HOST vẫn trong cuộc gọi, còn 1 ô
  PASS  MEMBER vào lại khi camera bị chặn → banner "Không bật được camera: trình duyệt chưa được cấp quyền…"
  PASS  MEMBER vẫn ở trong cuộc gọi, vẫn xem camera HOST · HOST thấy ô MEMBER (placeholder) + nghe micro MEMBER
  PASS  Mongo: MEMBER có session thứ 2 (vào lại)
  PASS  có hộp xác nhận "Kết thúc buổi học cho mọi người?"
  PASS  HOST bấm Kết thúc buổi học → cả hai thấy "Buổi học đã kết thúc" (không có nút "Vào lại")
  PASS  Mongo: ENDED, HOST_ENDED, totalParticipants 2, durationSeconds 85 · mọi session đã đóng · key presence đã xoá
  ALL PASS
  ```
  - Console 2 trang: chỉ có **warning**, không có error / exception: `Item with key lk-user-choices does not exist in local storage` (ControlBar đọc lựa chọn thiết bị đã lưu, lần đầu chưa có), `could not createOffer with closed peer connection` (lúc room bị xoá), `error waiting for media permissons` + `NotAllowedError` (trình duyệt chặn camera — đúng).
  - Ảnh chụp đã xem: lưới 3 ô (2 camera + ô "Member T9's screen"), thanh điều khiển Microphone / Camera / Share screen / Leave; banner lỗi camera + ô placeholder; màn hình "Buổi học đã kết thúc" + "← Về phòng".
  - Strict Mode: API `join` bị gọi **2 lần** mỗi lần vào (thấy ở Network) nhưng LiveKit chỉ có **1** `starting RTC session` / người, Mongo 1 session — đúng spec §11.4.
- **Đo thời gian vào (dev + headless, 3 lần đo, chỉ để tham khảo):** MEMBER bấm Tham gia → thấy 2 ô có hình: 12,3 s / 9,6 s / 7,0 s. Tách theo Network + log LiveKit: API `join` xong sau ~1,1–1,5 s (backend nhanh: `ListRooms` 1–8 ms); ICE + publish sau khi LiveKit nhận phiên ~2–3 s. **Mỗi lần có một khoảng ~3–4 s "chết" ở chỗ khác nhau:** lần 2 và 4 nằm **phía trình duyệt** giữa lúc nhận token và lúc tạo WebSocket tới LiveKit (+1,45 → +5,03 s; +1,09 → +3,88 s — trong `Room.connect` không thấy chỗ nào chờ lâu như vậy: không phải LiveKit Cloud nên bỏ region, backoff chỉ áp dụng sau lần lỗi); lần 3 nằm ở **đường trả response** của request `join` thứ 2 (`ListRooms` 2 ms lúc 07:43:59.3, trình duyệt nhận response lúc ≈07:44:02.6). Gốc **chưa rõ** — giống hiện tượng chậm Task 6 / 7 đã ghi; không do code Task 9.
- **Sự cố lúc chạy (không phải code app):**
  1. Cờ `--use-fake-ui-for-media-stream` tự đồng ý mọi quyền, **đè** `Browser.setPermission(camera: denied)` → lần thử đầu tiền điều kiện FAIL (camera vẫn bật được), kết quả vô hiệu. Sửa script: người bị chặn camera dùng Chrome **không** có cờ đó, cấp micro qua `Browser.grantPermissions(['audioCapture'])`, chặn camera.
  2. **Máy ngủ giữa một lần chạy** (log 2026-10-07 16:15 UTC → 2026-10-08 07:38 UTC): thức dậy thì token LiveKit (6 h) đã hết hạn → client tự kết nối lại bị `401 invalid authorization token: token is expired`, room đóng. Buổi đó tự chốt `AUTO_EMPTY`, `durationSeconds 54921` (gồm cả lúc ngủ). Bỏ lần chạy đó, chạy lại.
  3. Một lần (không lặp lại ở lần sau): Chrome mới mở trang phòng thì bị đưa về `/login` — 2 request `GET /auth/me` (Strict Mode) không thấy hoàn tất, `AuthProvider` xoá token. Backend không có dòng lỗi. Đây là hành vi có sẵn của `auth.context.tsx` (`/auth/me` lỗi / không OK → đăng xuất); script lúc đó chưa ghi mã HTTP nên chưa biết là 401 hay lỗi mạng — giống "fetch failed" không rõ gốc ở Task 8.
- **`npm install`:** cảnh báo `EBADENGINE` — `machina@7.0.1` (dependency của `livekit-client`) đòi Node ≥ 22.22, máy đang 22.16 (chỉ cảnh báo; build, chạy thật đều ổn). `npm audit` báo 13 vulnerability — **đều có sẵn** (next, shadcn, eslint-config-next, sharp…), không cái nào từ 3 gói LiveKit. Chưa chạy `npm audit fix`.
- **Commit:** một commit chung cho Task 7 + 8 + 9 (user chốt 2026-10-08: "commit 1 lần") — `feat: đưa người ra khỏi cuộc gọi khi kick / rời / giải tán phòng, khu buổi học và trang cuộc gọi LiveKit`.
- **Lệch khỏi plan:**
  - 2 chỗ sửa code ở trên (lỗi kỹ thuật, giữ hành vi spec); ghi chú dưới Step 3 Task 9 trong plan.
  - Step 5 (chạy tay 2 profile Chrome) làm tự động bằng Chrome headless + CDP; kiểm thêm: tên buổi học nhìn thấy được, Mongo / Redis sau mỗi bước, lỗi thiết bị (một phần kịch bản 11 Task 10), nút xác nhận kết thúc.
- **Task sau cần biết (Task 10):**
  - Kịch bản 11 tự động bằng headless: **không** dùng `--use-fake-ui-for-media-stream` cho trình duyệt cần chặn quyền (xem sự cố 1). Chặn bằng biểu tượng khoá ở Chrome thường thì không bị.
  - Kịch bản 9 "console không có lỗi đỏ": sẽ thấy các warning vàng ở trên (`lk-user-choices`…) — không phải lỗi.
  - Khoảng chậm ~3–4 s lúc vào: bước tạm bật `setLogLevel('debug')` ở kịch bản 11 cho mốc thời gian `connecting` → mở WebSocket, xem khoảng chậm phía trình duyệt nằm ở đâu; bước benchmark đo join latency nên đo trên `next build` + `next start`, không trên `npm run dev`.
  - Tắt sleep của máy khi chạy kịch bản dài (kịch bản 5, 7 chờ 3 phút+): máy ngủ làm token LiveKit hết hạn và cuộc gọi đứt.
  - `frontend/AGENTS.md` (do `next dev` sinh) không bị đổi trong task này.
  - Dữ liệu thử trong Mongo dev: 8 phòng "Phong T9 …", user `t9h*/t9m*@test.com`; mọi buổi thử đã ENDED.
