# Module Room — chia task

**Loại:** module mới → đủ quy trình (thiết kế → spec → plan) theo `CLAUDE.md`. Task 0 làm trước, các task sau có thể chỉnh theo spec.

**Nguồn:**
- Đề cương §3.2 (tạo, tham gia, quản lý phòng), §5.4 (tham gia qua mã/đường dẫn; chủ phòng quản lý thành viên, kết thúc phòng), §6.1 (một phòng nhiều meeting; thành viên có thể rời phòng, host giải tán), §6.2 (luồng tạo/tham gia).
- `docs/rule/role.md`: chỉ có HOST và MEMBER; HOST kick MEMBER (gọi API xoá member); chỉ thành viên phòng mới vào được meeting.
- `docs/PROJECT_CONTEXT.md` §13 (import/export — `[GVHD-verbal]`), §15 (permission bảng tra trong `shared/`), §16 (join code 8 ký tự base32 không tuần tự; rate limit brute-force join code trong Redis).
- ADR-018: room sống lâu dài, kết thúc phiên chỉ kết thúc meeting.

**Đã có sẵn:** schema `rooms`, `room_members`; `RoomAccessService.assertRoomAccess` (commit 3b55226); auth JWT cho REST.

---

## Task 0 — Thiết kế + spec (brainstorming)

Chốt các câu hỏi mở dưới đây, viết spec cạnh file này.

**Câu hỏi mở:**
1. "Đổi role" (HOST có quyền trong `role.md`) nghĩa là gì khi chỉ có 2 role — chuyển quyền host cho người khác? Có làm không?
2. Kick có chặn vào lại không? `room_members.isBanned` còn dùng hay bỏ (role.md chỉ nói kick)?
3. HOST có được rời phòng không (phải chuyển host trước / chỉ được giải tán)?
4. Có cho sửa tên/mô tả phòng không (đề cương chỉ nói "quản lý phòng")?
5. `rooms.deletedAt` có cần khi đã có `DISSOLVED` + `dissolvedAt`?
6. Giải tán phòng khi đang có meeting ACTIVE: kết thúc meeting luôn (`EndReason.ROOM_DISSOLVED`) — phụ thuộc module meeting chưa có.
7. Bảng quyền trong `shared/` đặt ở đâu, dùng chung frontend thế nào (progress: `enums.ts` chưa chuyển sang thư mục dùng chung).

---

## Task 1 — Bảng quyền HOST/MEMBER trong `shared/`

- Bảng tra hành động → role được phép (theo `docs/rule/role.md`), một hàm kiểm tra.
- Test trước (logic permission).
- Các task sau dùng bảng này thay vì if-else.

## Task 2 — Tạo phòng

- `POST /rooms` `{ name, description? }` — DTO class-validator.
- Sinh `joinCode` 8 ký tự base32 ngẫu nhiên, thử lại khi trùng (unique index).
- Tạo `room_members` với role HOST cho người tạo; `memberCount = 1`.
- Response trả `id`, không `_id`.
- Test: sinh code, trùng code thì thử lại, người tạo thành HOST.

## Task 3 — Tham gia phòng bằng mã

- `POST /rooms/join` `{ code }` (link `/join/:code` phía frontend gọi cùng API).
- Room phải ACTIVE; đã là thành viên thì trả về luôn (idempotent nhờ unique `{roomId, userId}`); bị chặn (nếu Task 0 giữ ban) thì 403.
- Rate limit brute-force join code bằng Redis (§16).
- Tăng `memberCount`.
- Test: code sai, room đã giải tán, đã là thành viên, vượt rate limit.

## Task 4 — Xem phòng

- `GET /rooms` — danh sách phòng của tôi (index `{userId, joinedAt}`), phân trang.
- `GET /rooms/:roomId` — chi tiết, chỉ thành viên (dùng `assertRoomAccess`).
- `GET /rooms/:roomId/members` — danh sách thành viên + role.

## Task 5 — Kick thành viên

- `DELETE /rooms/:roomId/members/:userId` — chỉ HOST, không kick chính mình, không kick HOST.
- Giảm `memberCount`.
- Ghi chú: thu hồi socket đang mở (kênh `room:{roomId}`) làm khi đã có chat gateway — ghi vào progress.
- Test: MEMBER gọi → 403, kick HOST → 403, kick người không có trong phòng → 404.

## Task 6 — Rời phòng

- `DELETE /rooms/:roomId/members/me` — MEMBER tự rời (đề cương §6.1 "out room").
- Quy tắc cho HOST theo câu hỏi 3 ở Task 0.

## Task 7 — Giải tán phòng

- `POST /rooms/:roomId/dissolve` — chỉ HOST → `status = DISSOLVED`, `dissolvedAt`.
- Sau khi giải tán: không join được, `assertRoomAccess` trả 404 (đã có sẵn).
- Kết thúc meeting ACTIVE: để lại khi có module meeting (câu hỏi 6).

## Task 8 — Import / export thành viên `[GVHD-verbal]` (§13)

- Import danh sách email: dialog ghi rõ định dạng, bước review trước khi xác nhận, validate từng dòng; import trùng không tạo bản ghi thứ hai.
- Export danh sách thành viên.
- Chỉ HOST. Làm sau cùng — độc lập với các task khác.

## Task 9 — Frontend

- Trang danh sách phòng, dialog tạo phòng, dialog nhập mã, route `/join/:code` (chưa đăng nhập → `/login?returnUrl=...`).
- Trang chi tiết phòng: thông tin, mã/đường dẫn để chia sẻ, danh sách thành viên; nút kick / giải tán chỉ hiện với HOST (backend vẫn là nơi quyết định).
- Có thể chia theo trang khi làm.

## Task 10 — Tài liệu

- `docs/api/endpoint.md` nhóm Rooms; `docs/progress.md`; quyết định mới vào `docs/decisions.md`.
- Có thể làm dần cuối mỗi task thay vì gom một lần.

---

**Thứ tự đề xuất:** 0 → 1 → 2 → 3 → 4 → 5 → 6 → 7 → 9 → 8.
Sau Task 3 đã có `room_members` thật → chat gateway và meeting mới test được trên app thật.
