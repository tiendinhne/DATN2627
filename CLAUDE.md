# DATN2627 — Hệ thống học nhóm trực tuyến (WebRTC + whiteboard cộng tác)

Khóa luận tốt nghiệp · nhóm 2 người · 2 tháng code.
Trọng tâm chấm điểm là **WebRTC scalability + realtime collaboration + AI whiteboard**, không phải số lượng feature.

Giữ mọi thứ ở mức sinh viên làm đồ án chứ không phải là 1 production chuyên nghiệp có quá nhiều tính năng
Chỉ làm đúng việc tôi yêu cầu. Không tự mở rộng tính năng, không thêm "tiện thể" những thứ tôi không hỏi.
Giải pháp tốt nhất là giải pháp nhỏ nhất giải quyết được vấn đề. Ưu tiên sửa vài dòng hơn là viết lại cả file.
Không thêm abstraction, class, helper, config, hay lớp trung gian mới nếu vấn đề không thật sự cần.
Không thêm dependency mới trừ khi tôi đồng ý.
Trong code nhớ ghi chú cơ bản dễ nhìn vào dễ hiểu
## Nguồn sự thật — theo thứ tự ưu tiên

| # | Tài liệu | Vai trò |
|---|---|---|
| 1 | `docs/DATN_decuong.md` | Văn bản GVHD đã duyệt. **Không gì được mâu thuẫn với file này.** |
| 2 | `docs/PROJECT_CONTEXT.md` | Đặc tả kỹ thuật. `§n` trỏ section n của nó |
| 3 | `docs/decisions.md` | Quyết định kỹ thuật đã chốt — ADR-001…, mỗi ADR một mục |
| 4 | `docs/progress.md` | Đang làm tới đâu. Cập nhật sau **mỗi** task |
| 5 | `docs/api/endpoint.md`, `docs/database/DB_DESIGN.md` | Chi tiết endpoint, schema |

**Quy tắc truy vết:** mọi yêu cầu ở mục 2–3 phải trace được về mục 1. Nếu không (GVHD nói miệng, hoặc phát sinh kỹ thuật khi thiết kế/code), gắn nhãn `[GVHD-verbal]` hoặc `[phát sinh kỹ thuật]` ngay tại chỗ, kèm lý do — không viết như thể đã có trong văn bản gốc. Đây là lý do duy nhất khiến một ADR bị coi là sai dù kỹ thuật đúng.

**Khi skill/plugin mâu thuẫn với 5 mục trên:** dừng lại, nói rõ mâu thuẫn, không tự chọn bên nào. (Nguyên tắc làm việc, PROJECT_CONTEXT.md §23)

## Tech stack
Backend: NestJS · ESM thuần · Mongoose/MongoDB · Socket.IO · Redis
Frontend: Next.js · React · Tailwind · **shadcn/ui**
Media: LiveKit (SFU) · Whiteboard: Excalidraw · AI: Generative AI API qua module `ai-assistant`

# CLAUDE.md

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.

## Lệnh

```powershell
docker compose up -d --build mongo redis livekit backend nginx   # dev: mọi thứ trừ frontend (ADR-016, sửa đổi 2026-11-12)
docker compose logs -f backend

# Frontend dev chạy native (terminal riêng) — không chạy frontend trong Docker khi dev
Set-Location frontend
npm install
npm run dev                         # cổng 3000

# docker compose up -d --build      # cả hệ thống kể cả frontend — chỉ khi cần một lệnh cho tất cả (chậm, xem ADR-016)

# Chỉ khi chạy test / debug backend ngoài Docker (tắt container backend trước)
Set-Location backend
npm install
npx vitest run                      # test backend
npm run start:dev                   # cổng 3001

Set-Location ../frontend
npm install
npm run build                       # kiểm type + lint
```

**Lệnh `npm` bắt buộc chạy bằng PowerShell, không chạy bằng Bash

**ADR-016:** backend chạy qua Docker Compose (config từ `env_file: ./backend/.env`); `npm run start:dev` native chỉ dùng khi cần breakpoint trong IDE. **Frontend dev chạy native** (`npm run dev`), không chạy container `frontend` khi dev — nguyên nhân: `next dev` trong VM Docker 3,3 GB làm cạn RAM, compile trang đầu tới 133–155 s (sửa đổi 2026-11-12). Không chạy đồng thời bản native với container tương ứng (trùng cổng 3001 / 3000)

## 10 ràng buộc cứng

Mỗi dòng đều kiểm chứng được. Hook `PostToolUse` tự chặn hoặc cảnh báo 6 trong số này.

1. **ESM** — mọi import tương đối phải kết thúc bằng `.js`: `from './auth.service.js'`. Dễ quên nhất. (§19)
2. **Response trả `id`, không `_id`** — map ở ranh giới service → controller. (§14)
3. **Validate mọi entry point** — REST DTO qua class-validator, payload WebSocket, file import, response từ AI, webhook LiveKit, biến môi trường. Không ngoại lệ. (§14, P10)
4. **Permission enforce ở backend** bằng bảng tra dữ liệu trong `shared/`. Frontend chỉ ẩn/hiện UI, không bao giờ là nơi quyết định. (§15, P3)
5. **Stateless** — không `Map`/`Set`/biến module giữ state theo user hay room. Trước khi commit đoạn code giữ state, tự hỏi: *"Nếu request sau của user này rơi vào instance khác, có còn đúng không?"* State đi vào Mongo hoặc Redis. (§7.1, P9)
6. **Một publisher duy nhất** — không rải `server.to(...).emit(...)` khắp nơi. Mọi emit đi qua một publisher để gắn envelope nhất quán; sau này thêm log/metrics chỉ sửa một chỗ. (§19.2)
7. **Media và application realtime tách đôi** — media qua LiveKit, application data qua Socket.IO. Không trộn. (P2)
9. **Module có hệ ngoài** (LiveKit, Gemini, storage) tách `ports/` + `adapters/`, đặt tên theo **năng lực** không theo vendor — `media`, không phải `livekit`. Module CRUD thuần giữ layered đơn giản: controller → service → schema. (§19.2)
10. **Thiết kế cho nhiều user** — mọi tính năng realtime phải trả lời được: *"2, 10, 20 user cùng làm hành động này thì sao?"* (P5)

Thứ tự ưu tiên khi phải đánh đổi: `Correctness → Understandability → Testability → Scalability đúng phạm vi → Performance`. Không over-engineer. (P1)

## Quy trình & skill

> Khi skill hoặc plugin mâu thuẫn với `CLAUDE.md` hoặc `PROJECT_CONTEXT.md`. Nói rõ mâu thuẫn trước khi làm. (§0)

Chọn mức quy trình theo loại task, đừng chạy ceremony thừa:

| Loại task | Quy trình |
|---|---|
| Sửa bug · thêm field · thêm endpoint vào module đã có | Nói thiết kế 2–3 câu, đợi duyệt, làm. Không spec, không plan doc |
| Module mới (whiteboard, AI, LiveKit) · đổi realtime contract §9 · đổi schema | Đủ quy trình: thiết kế → spec → plan |
| "Thử xem có được không" (spike ESM + redis-adapter, đo bandwidth) | Trả lời bằng kết quả đo. Code viết ra là đồ bỏ, phải nói rõ là đồ bỏ |

- **Test trước** với service/gateway có logic thật: permission, `lww-merge`, validate, chuyển trạng thái. **Không cần** với schema thuần, DTO, page UI tĩnh.
- **Không nói "xong" / "đã chạy được" khi chưa chạy.** Trước mọi khẳng định như vậy, chạy `/check` và dán output. Đồ án này được chấm bằng số liệu đo thật — thói quen đó bắt đầu từ đây.
- **Tài liệu đi vào `docs/`.** Không tự tạo Claude Docs, Artifact, hay file spec rải rác.

## Sau mỗi task

1. Ghi vào `docs/progress.md`: task đã xong, commit nào, quyết định nảy sinh lúc code, chỗ nào lệch khỏi tài liệu. (`/progress`)
2. Quyết định kỹ thuật mới → `docs/decisions.md`.
3. Endpoint mới → `docs/api/endpoint.md`. (`/api <module>`)

Commit: `<type>: <mô tả ngắn>` với type ∈ `feat` `fix` `refactor` `test` `docs` `chore`.

## Mục tiêu chung
- Chạy bằng Docker Compose
- **Deploy hosting thật, domain riêng + HTTPS**
- Có TURN, kết nối được từ mạng chặn UDP
- **≥2 backend instance sau load balancer, đồng bộ đúng giữa các instance**
- **Thí nghiệm E1 vs E2 chứng minh scale không có code distributed thì vô nghĩa**
- **Input validation ở mọi entry point**
- Persistence và realtime sync ổn định qua reconnect và qua chuyển instance
- **Số liệu benchmark đo thực tế** khi tăng participant và khi tăng số instance
- Mọi lựa chọn kỹ thuật giải thích được trong báo cáo

