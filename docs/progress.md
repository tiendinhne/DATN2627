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
