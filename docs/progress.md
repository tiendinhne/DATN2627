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
