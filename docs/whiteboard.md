# Whiteboard

Trạng thái: thuật toán merge **[IMPLEMENTED]** ở `shared/src/whiteboard/lww-merge.ts` (14/14 test pass). Phần còn lại **[PLANNED]**.

## 1. Mô hình đồng bộ — LWW per-element [CONFIRMED]

Dùng đúng cơ chế sẵn có của Excalidraw:

```
version cao hơn thắng
hoà version → versionNonce nhỏ hơn thắng
isDeleted = true là trạng thái (tombstone), KHÔNG xoá khỏi mảng
```

Hàm merge nằm ở `shared/`, **client và server dùng chung một bản**. Không viết hai bản.

Xem ADR-003 cho lý do không dùng CRDT.

## 2. Luồng [CONFIRMED]

```
Excalidraw onChange (debounce ~150ms)
 → diff element có version thay đổi so với lần gửi trước
 → emit wb:ops (BATCH, KHÔNG gửi toàn bộ scene)
 → Backend: validate + permission + Redis INCR seq
 → merge LWW vào Redis live state
 → broadcast qua Redis adapter tới MỌI instance
 → client khác reconcile + updateScene()
```

## 3. Bẫy đã biết [CONFIRMED]

| Bẫy | Xử lý |
|---|---|
| **Echo loop**: client nhận op của chính mình → `updateScene` → `onChange` → gửi lại | cờ `isApplyingRemote` ở client |
| Gửi toàn bộ scene mỗi 150ms | chỉ gửi element có version thay đổi |
| Cursor làm `seq` tăng vô nghĩa, phá replay buffer | cursor đi kênh riêng `wb:pointer`, throttle 50ms, không tăng seq, không lưu |
| Clear board bằng cách xoá mảng | set `isDeleted = true` cho tất cả |
| Freedraw hàng nghìn point | giới hạn kích thước payload |
| AI sinh element "sạch" không có version | layout engine **bắt buộc** gán `version` + `versionNonce` hợp lệ |

## 4. Persistence [CONFIRMED]

| Tầng | Nơi lưu | Mục đích |
|---|---|---|
| Live state | Redis `wb:{meetingId}` | nguồn đọc snapshot khi join |
| Persisted snapshot | Mongo `whiteboards` | khôi phục sau restart |
| Historical | Mongo, gắn meeting ENDED | review sau meeting |

**Không ghi Mongo mỗi op.** Debounce 15s sau thay đổi cuối; ép ghi mỗi 60s nếu thay đổi liên tục; ghi ngay khi `endMeeting`, participant cuối rời, hoặc graceful shutdown.

Trade-off cho báo cáo: đổi write amplification lấy RPO ~15–60s.

**Guard chống ghi đè ngược** (bắt buộc khi đa instance):

```js
updateOne(
  { meetingId, lastSeq: { $lt: incomingSeq } },
  { $set: { elementsGzip, elementCount, lastSeq: incomingSeq, lastPersistedAt } },
  { upsert: true },
)
```

**Ràng buộc 16 MB/document:** elements lưu `gzip(JSON)` → `Buffer`. Hard limit 5.000 element/board, vượt thì báo lỗi rõ ràng.

## 5. Late joiner / reconnect

Xem `realtime.md` §5. Client gửi `lastSeq`: chênh ≤ 500 → replay diff từ ring buffer; ngược lại → full snapshot đọc từ Redis live state.

## 6. Permission

`DRAW_WHITEBOARD`, `DELETE_OTHERS_ELEMENT`, `CLEAR_BOARD` — xem `security.md`. Ở `LECTURE` mode, MEMBER bị hạ xuống VIEWER cho quyền vẽ.
