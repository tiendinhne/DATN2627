[done]
# Task: Bỏ `Meeting.mode` (DISCUSSION / LECTURE) khỏi code và tài liệu

**Lý do:** `docs/decisions.md` ADR-009 đã ghi "Bỏ phần chia mode này" — ngoài scope hiện tại, meeting chỉ còn meeting đơn thuần (xem `docs/progress.md`). Quyền trong meeting dùng thẳng role gốc của `RoomMember`.

**Loại task:** sửa nhỏ — nói thiết kế 2–3 câu, đợi duyệt, làm. Không spec, không plan.

## Code

| File | Việc |
|---|---|
| `backend/src/shared/enums.ts` | Xoá `enum MeetingMode` |
| `backend/src/modules/meetings/schemas/meeting.schema.ts` | Xoá field `mode` và `MeetingMode` khỏi import |

Grep lại `MeetingMode` / `LECTURE` / `DISCUSSION` sau khi sửa — phải không còn trong `backend/src`.

## Tài liệu còn nhắc tới mode

| File | Chỗ |
|---|---|
| `docs/database/DB_DESIGN.md` | enum §C.0 (dòng `MeetingMode`), field `mode` trong §C.5 `meetings` |
| `docs/architecture/webrtc.md` | "resolve effective role theo Meeting.mode", `toLiveKitGrant(role, mode)` → chỉ còn `role` |
| `docs/architecture/whiteboard.md` | câu "Ở `LECTURE` mode, MEMBER bị hạ xuống VIEWER…" |
| `docs/PROJECT_CONTEXT.md` | kiểm tra lại §4 và §15 (chú thích ¹ về LECTURE) |

## Không làm

- Không đụng tới phần chat / `ai_requests` (đang làm ở spec `2026-09-23-chat-room-scope-ai-requests-design.md`).

## Kiểm tra xong

- `npm run build` trong `backend` (PowerShell) không lỗi.
- Ghi `docs/progress.md`.
