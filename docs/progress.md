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
- **Commit:** chưa commit (chờ user).
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
- **Commit:** chưa commit (chờ user).
- **Task sau cần biết:**
  - Làm lại **Task 10 từ Step 1**. Đầu phiên kiểm dữ liệu cũ đã xoá chưa (lệnh ở dưới).
  - Schema mới (chat, meeting, whiteboard, AI đã có sẵn schema đã sửa) — field tham chiếu viết `type: SchemaTypes.ObjectId`, không `Types.ObjectId`. Unit test mock model không bắt được lỗi này; chỉ app thật / đọc `schema.path(x).instance` mới thấy.
  - Lệnh xoá dữ liệu dev cho user (PowerShell, gốc repo): `docker exec mongo-dev mongosh online-group-learning --quiet --eval "printjson({ rooms: db.rooms.deleteMany({}).deletedCount, room_members: db.room_members.deleteMany({}).deletedCount, refresh_tokens: db.refresh_tokens.deleteMany({}).deletedCount })"`
