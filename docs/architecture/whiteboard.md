# Whiteboard

## 1. Mô hình đồng bộ — LWW per-element [CONFIRMED]

Dùng đúng cơ chế sẵn có của Excalidraw:

```
version cao hơn thắng
hoà version → versionNonce nhỏ hơn thắng
isDeleted = true là trạng thái (tombstone), KHÔNG xoá khỏi mảng
```

Luật LWW: server trong Lua, client dùng `reconcileElements` của Excalidraw — cùng luật, client thêm lớp giữ thao tác đang dở (ADR-028). Hằng số dùng chung ở `backend/src/shared/whiteboard.ts`.

Xem ADR-003 cho lý do không dùng CRDT.

## 2. Luồng [CONFIRMED]

```
Excalidraw onChange (throttle 50 ms)
 → diff element có version thay đổi so với lần gửi trước
 → emit wb:ops (BATCH, KHÔNG gửi toàn bộ scene)
 → Backend: validate + socket đã ở kênh meeting:{id}
 → Backend: Redis INCR seq (trong script Lua)
 → Lua wb-apply merge LWW vào Redis Hash (atomic, ADR-028)
 → broadcast qua Redis adapter tới MỌI instance
 → client khác reconcile + updateScene()
```

## 3. Bẫy đã biết [CONFIRMED]

| Bẫy | Xử lý |
|---|---|
| **Echo loop**: client nhận op của chính mình → `updateScene` → `onChange` → gửi lại | map id → version đã gửi / nhận ở client (ADR-031) |
| Gửi toàn bộ scene mỗi lần `onChange` | chỉ gửi element có version thay đổi |
| Cursor làm `seq` tăng vô nghĩa | cursor đi kênh riêng `wb:pointer`, throttle 50ms, không tăng seq, không lưu |
| Clear board bằng cách xoá mảng | set `isDeleted = true` cho tất cả |
| Freedraw hàng nghìn point | giới hạn kích thước payload |
| Element không được phép (embeddable…) | client lọc theo `shared/whiteboard.ts`, server từ chối cả batch |
| AI sinh element "sạch" không có version | layout engine **bắt buộc** gán `version` + `versionNonce` hợp lệ |

## 4. Persistence [CONFIRMED]

| Tầng | Nơi lưu | Mục đích |
|---|---|---|
| Live state | Redis `wb:{meetingId}` | nguồn đọc snapshot khi join |
| Persisted snapshot | Mongo `whiteboards` | khôi phục sau restart |
| Historical | Mongo, gắn meeting ENDED | review sau meeting |

**Không ghi Mongo mỗi op.** Sau op có thay đổi: `SET wb:persist-lock:{id} NX PX 15000`, instance giành được khoá ghi nền; `endMeeting` ghi bản cuối rồi xoá key Redis (ADR-030). Không timer RAM, không cron, không ghi khi graceful shutdown (state ở Redis).

Trade-off cho báo cáo: đổi write amplification lấy RPO ~15 s khi đang vẽ; 15 s cuối nằm ở Redis tới khi kết thúc.

Key Redis: `wb:{id}` (Hash element, gồm tombstone), `wb:alive:{id}` (số element còn hiển thị), `wb:seq:{id}`, `wb:persist-lock:{id}`.

**Guard chống ghi đè ngược** (bắt buộc khi đa instance):

```js
updateOne(
  { meetingId, lastSeq: { $lt: incomingSeq } },
  { $set: { elementsGzip, elementCount, lastSeq: incomingSeq, lastPersistedAt } },
  { upsert: true },
)
```

Filter không khớp vì đã có `lastSeq` ≥ seq → upsert ném E11000 → bắt và bỏ qua (đã có bản mới hơn).

**Ràng buộc 16 MB/document:** elements lưu `gzip(JSON)` → `Buffer`. Hard limit 5.000 element/board, vượt thì báo lỗi rõ ràng; 5.000 tính element còn hiển thị, Mongo không lưu tombstone.

## 5. Late joiner / reconnect

Join / reconnect luôn nhận full snapshot (gồm tombstone) — ADR-029.

## 6. Permission

**Mọi thành viên phòng đều được vẽ, sửa, xoá element của người khác và clear board** — không có hành động whiteboard nào trong bảng quyền `backend/src/shared/permissions.ts` (user chốt 2026-11-02).

- Truy vết: đề cương §5.6 "Người dùng có thể cùng tạo, chỉnh sửa, di chuyển và xóa các đối tượng trên bảng vẽ" — không phân biệt HOST/MEMBER; `docs/rule/role.md` cho MEMBER ✅ ở "Vẽ whiteboard" và "Xoá element người khác / clear board".
- Backend vẫn enforce (ràng buộc #4): `meeting:join` kiểm là thành viên phòng + meeting ACTIVE; `wb:*` chỉ nhận từ socket đã join kênh `meeting:{meetingId}`.
- Bỏ 3 quyền `DRAW_WHITEBOARD`, `DELETE_OTHERS_ELEMENT`, `CLEAR_BOARD` ghi ở bản trước.
- **NOTE — sau này chia quyền:** khi có role mới (vd VIEWER chỉ xem, xem mục "Mở rộng" của `role.md`) thì thêm các hành động này vào `RoomAction` + `ROOM_PERMISSIONS` và kiểm ở handler `wb:ops`. Ngoài scope hiện tại.
