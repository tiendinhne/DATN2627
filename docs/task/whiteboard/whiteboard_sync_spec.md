# Whiteboard — đồng bộ realtime + lưu trữ (phần lõi) — spec

Ngày chốt: 2026-11-03. Plan: `whiteboard_sync_plan.md` (cùng thư mục, viết sau khi spec được duyệt).

**Nguồn:** đề cương §3.2, §5.6, §5.8, §6.1, §6.6, §8 · `docs/rule/role.md` · PROJECT_CONTEXT §7, §9, §10, §11, §14, §15 · `docs/architecture/whiteboard.md` · DB_DESIGN §C.8, Phần E · ADR-001, ADR-003, ADR-004, ADR-005, ADR-014, ADR-015, ADR-022, ADR-024.

**Mục tiêu:** nhiều thành viên cùng vẽ trên một board của meeting, thay đổi hiện ở máy người khác với **độ trễ thấp nhất có thể** (user chốt: ưu tiên độ trễ realtime), đúng khi chạy ≥2 instance, board được lưu xuống Mongo và lưu bản cuối khi meeting kết thúc (đề cương §5.6, §5.8, §6.6).

**Hiện trạng trước task:** Excalidraw 0.18.1 đã nhúng ở `WhiteboardCanvas.tsx` nhưng chỉ chạy local (progress 2026-10-22). Backend có schema `whiteboards`, handler `wb:ops` chỉ ghi log. Gateway `/meeting` đã có JWT handshake, `room:subscribe`, `validatePayload`, `RealtimePublisher`; Redis adapter đã bật ở `main.ts`.

---

## 1. Câu hỏi mở — đã chốt

| # | Câu hỏi | Chốt | Lý do |
|---|---|---|---|
| 1 | Quyền vẽ | Mọi thành viên phòng vẽ / sửa / xoá element người khác / clear board. Không thêm hành động vào bảng quyền | Đề cương §5.6 không phân biệt HOST/MEMBER; `role.md` cho MEMBER ✅. Đã sửa `whiteboard.md` §6, kèm NOTE chia quyền sau này. User chốt 2026-11-02 |
| 2 | Live state trong Redis khi nhiều instance cùng ghi | **Hash theo element + 1 script Lua** (atomic) | String gzip + đọc–merge–ghi làm mất op khi 2 instance ghi cùng lúc; WATCH/MULTI phải retry liên tục với ~130 op/s/board. Excalidraw không gặp vì server của nó chỉ relay (đã đọc `excalidraw-room/src/index.ts`) |
| 3 | Hàm merge dùng chung `shared/` (§10) | **Không viết hàm TS.** Server: luật LWW nằm trong Lua. Client: `reconcileElements` của Excalidraw. Test Lua bằng đúng các ca của `shouldDiscardRemoteElement` | Hàm TS ở `shared/` sẽ không ai gọi. `reconcileElements` còn giữ element đang gõ / kéo / vẽ dở — hàm thuần không làm được `[phát sinh kỹ thuật]` |
| 4 | Thứ tự trên server | **Lua trước rồi mới phát** (cách B) | Thêm ~1 round-trip Redis (<1 ms, cùng Docker host) nhưng không bao giờ "đã phát mà không lưu"; giới hạn 5.000 từ chối được trước khi ai thấy. CLAUDE.md: Correctness trước Performance. User chốt 2026-11-03 |
| 5 | Ring buffer 500 op + `wb:resync` (§9) | **Bỏ.** Join và reconnect luôn nhận full snapshot | Đề cương không yêu cầu; bớt 1 key Redis, 1 event, 1 nhánh logic. Board học nhóm nhỏ `[phát sinh kỹ thuật]` |
| 6 | Lưu Mongo không dùng timer RAM | `SET NX PX 15000` sau mỗi op có thay đổi; bản cuối ở `endMeeting` | Timer `setTimeout` nằm ở 1 instance → vi phạm ràng buộc #5. Không cần cron / lock nhả bằng Lua (cùng lý do ADR-022) `[phát sinh kỹ thuật]` |
| 7 | Client gửi op | **Throttle 50 ms** (không debounce 150 ms như §10) | Debounce chỉ gửi khi người dùng dừng tay → kéo hình liên tục người khác không thấy gì tới khi thả `[phát sinh kỹ thuật]` |
| 8 | Chống echo | Map `syncedVersions` (id → version đã gửi / nhận), không dùng cờ `isApplyingRemote` (§10) | `onChange` có thể chạy sau khi cờ đã tắt; Excalidraw cũng dùng version |
| 9 | Phạm vi | Chỉ phần lõi. **Xem lại board đã kết thúc + clone board buổi trước** → spec sau (gộp). **Ảnh trong board** → spec riêng sau | User chốt 2026-11-03 |
| 10 | Socket frontend | Whiteboard mở 1 kết nối riêng (như `useRoomChat`) | Gộp chung kết nối phải sửa module chat — ngoài phạm vi |
| 11 | Element không được phép (vd `embeddable` — toolbar 0.18.1 luôn có) | Client đặt `aiEnabled={false}` + **lọc trước khi gửi** theo danh sách type / giới hạn cỡ dùng chung ở `backend/src/shared/whiteboard.ts` (ADR-024); element bị lọc vẫn ghi vào `syncedVersions` + báo 1 lần. Server **vẫn từ chối cả batch** khi gặp element sai | Nếu không lọc: cả batch bị 400 → element hợp lệ đi cùng mất lặng lẽ (version đã ghi vào map lúc gửi). `aiEnabled={false}` tắt hộp thoại text-to-diagram và magicframe (AI là module riêng). Server từ chối cả batch giữ validate chặt — chỉ client lỗi / cố ý mới chạm. Review 2026-11-03, user chốt |
| 12 | Tombstone (`isDeleted`) và giới hạn 5.000 | Giới hạn **5.000 tính element còn hiển thị** (key `wb:alive:{id}`), thêm trần tổng **20.000** (cả tombstone) chống phình Redis. Tombstone **giữ trong Redis** (snapshot cần), **không ghi xuống Mongo** | Đếm `HLEN` → vẽ rồi clear vài lần là chạm giới hạn dù bảng trống. Xoá tombstone khỏi Redis → người mất mạng lúc người khác xoá, reconnect vẫn thấy "hồn ma" (`reconcileElements` giữ bản local không có trong snapshot). ADR-014 đặt 5.000 vì trần 16 MB document Mongo — Mongo chỉ cần element còn hiển thị. Review 2026-11-03, user chốt `[phát sinh kỹ thuật]` |

---

## 2. Phạm vi

**Làm:**
- Event `meeting:join`, `meeting:leave`, `wb:ops`, `wb:pointer` (client → server); `meeting:snapshot`, `wb:ops`, `wb:pointer` (server → client).
- Live state Redis (Hash + Lua), lưu Mongo nền + bản cuối khi `endMeeting`.
- Ép socket rời kênh `meeting:{id}` khi kick / rời phòng / meeting kết thúc.
- Frontend: đồng bộ element, con trỏ người khác, tắt công cụ ảnh.
- Script đo độ trễ `tests/load/wb-latency.mjs` (giữ lại — benchmark là sản phẩm nộp).

**Không làm (task sau):** xem lại board meeting ENDED, clone board (`clonedFrom`), ảnh / `files`, AI (`ai:generate`), export, đồng bộ `appState` (nền, zoom — mỗi người tự xem), đo 2 instance (chờ task nginx — `infrastructure/nginx` đang rỗng).

---

## 3. Realtime contract

Namespace `/meeting` (đã có). **Kênh mới:** `meeting:{meetingId}` — chỉ socket đã `meeting:join` thành công mới ở trong.

### 3.1 Client → Server

| Event | Payload | Server xử lý |
|---|---|---|
| `meeting:join` | `{ meetingId }` | validate → tìm meeting (không có → 404) → `assertRoomAccess(userId, meeting.roomId)` → meeting phải `ACTIVE` (không → 409) → `socket.join('meeting:{id}')` → **sau đó** đọc snapshot → `meeting:snapshot` gửi riêng socket này |
| `meeting:leave` | `{ meetingId }` | validate → `socket.leave('meeting:{id}')` |
| `wb:ops` | `{ meetingId, elements[] }` | validate (§6) → socket phải ở kênh (không → 403) → Lua `wb-apply` (§4.2) → có element thắng → phát `wb:ops` tới kênh **trừ người gửi** → thử giành khoá persist (§5) |
| `wb:pointer` | `{ meetingId, x, y }` | validate → socket phải ở kênh (không → 403) → phát `volatile` tới kênh trừ người gửi. Không Redis, không seq, không lưu |

- Kiểm "socket ở kênh" bằng `socket.rooms.has('meeting:{id}')` — trong RAM, **không query Mongo/Redis mỗi op** (quyền đã kiểm 1 lần ở `meeting:join`; thu hồi bằng cách ép rời kênh, §3.3).
- **Join vào kênh trước rồi mới đọc snapshot:** op phát ra trong khoảng giữa vẫn tới được socket; LWW không phụ thuộc thứ tự nên client reconcile ra cùng kết quả.
- Reconnect: client gửi lại `meeting:join` (không có `lastSeq`).

### 3.2 Server → Client

Mọi event qua `RealtimePublisher` (ràng buộc #6), envelope chuẩn §9 `{ v, seq, ts, actorId, roomId, meetingId, data }`.

| Event | `seq` | `data` | Gửi tới |
|---|---|---|---|
| `meeting:snapshot` | seq hiện tại (`null` nếu board chưa có gì) | `{ elements[] }` | riêng socket vừa join |
| `wb:ops` | seq Lua trả về | `{ elements[] }` — **chỉ element thắng** | kênh `meeting:{id}` trừ người gửi |
| `wb:pointer` | `null` | `{ userId, displayName, x, y }` | kênh trừ người gửi, `volatile` |
| `error` | — | `{ statusCode, error, message }` (đã có) | người gửi |

Publisher thêm method; phát "trừ người gửi" dùng `namespace.to(channel).except(socket.id)` (chạy qua Redis adapter).

### 3.3 Ép rời kênh

| Khi | Ở đâu | Làm gì |
|---|---|---|
| Kick / rời phòng | `MeetingsService.removeFromActiveMeeting` (đã tìm được meeting ACTIVE) | `namespace.in('user:{userId}').socketsLeave('meeting:{id}')` |
| Meeting kết thúc (mọi lý do) | `MeetingsService.endMeeting`, **sau** khi update ENDED, **trước** persist bản cuối | `namespace.in('meeting:{id}').socketsLeave('meeting:{id}')` |

Cả hai chạy được trên mọi instance nhờ Redis adapter. Lỗi ở bước này ghi log, không ném (giống `removeFromActiveMeeting` hiện tại).

### 3.4 Khác §9 hiện tại (sửa PROJECT_CONTEXT khi xong)

- `meeting:join` bỏ `lastSeq`; bỏ `wb:resync`; bỏ ring buffer.
- `meeting:snapshot` chỉ còn `{ elements[] }` (bỏ `members[]` — LiveKit đã có; bỏ `recentMessages[]` — chat có REST lịch sử).
- `wb:ops`, `wb:pointer` client → server có thêm `meetingId` (1 socket có thể ở nhiều kênh).
- Thêm `meeting:leave`.

---

## 4. Redis

### 4.1 Key (sửa DB_DESIGN Phần E)

| Key | Kiểu | TTL | Nội dung |
|---|---|---|---|
| `wb:{meetingId}` | **Hash** `elementId → JSON element` | 24 h, làm mới mỗi op | Live state (thay String gzip) |
| `wb:seq:{meetingId}` | String (`INCR`) | 24 h | Seq |
| `wb:alive:{meetingId}` | String (số) | 24 h | Số element **chưa xoá** trong Hash — chỉ Lua sửa |
| `wb:persist-lock:{meetingId}` | String | 15 s (`PX 15000`) | Khoá giới hạn tần suất ghi Mongo |
| ~~`wb:ops:{meetingId}`~~ | | | Bỏ |

### 4.2 Script `wb-apply` (atomic)

Gọi bằng `client.eval(script, { keys: [hashKey, seqKey, aliveKey], arguments: [...] })` (node-redis 4.7.1).
`ARGV`: `maxAlive (5000)`, `maxTotal (20000)`, `ttlSeconds (86400)`, rồi mỗi element 5 giá trị `id, version, versionNonce, isDeleted (0|1), json`.

Giá trị trả về là **mảng** (Lua không trả được `nil` trong table): `{'LIMIT'}` · `{'NOOP'}` · `{'OK', seq, idx1, idx2, …}` (idx = vị trí element thắng trong batch, đếm từ 0).

**Lượt 1 — tính, chưa ghi gì.** Với mỗi element:
- Chưa có trong Hash → **thắng**; là id mới (`newIds + 1`); bản tới chưa xoá → `aliveDelta + 1`.
- Đã có → `cjson.decode` bản đang lưu, **bỏ bản tới** khi
  `stored.version > in.version` **hoặc** (`stored.version == in.version` **và** `stored.versionNonce < in.versionNonce`);
  ngược lại **thắng**. (Chép đúng `shouldDiscardRemoteElement` của Excalidraw 0.18.1, dấu `<`, bỏ phần "đang sửa" vì server không có.)
  Thắng thì: đang sống → bản tới xoá: `aliveDelta − 1`; đang xoá → bản tới sống: `aliveDelta + 1`.

**Kiểm giới hạn:** `alive + aliveDelta > maxAlive` **hoặc** `HLEN + newIds > maxTotal` → trả `{'LIMIT'}`, không ghi gì. (Batch chỉ xoá / chỉ sửa có `aliveDelta ≤ 0`, `newIds = 0` → luôn qua, nên bảng đầy vẫn xoá được.)

**Lượt 2 — ghi.** Không element nào thắng → `{'NOOP'}`, không `INCR`, server không phát. Ngược lại `HSET` các element thắng, `INCRBY alive aliveDelta`, `INCR` seq, `EXPIRE` 3 key → `{'OK', seq, idx…}`.

Lua **không encode lại JSON** — lưu nguyên chuỗi server nhận (`JSON.stringify` của element đã validate), tránh lỗi `cjson` với mảng / object rỗng. `version`, `versionNonce`, `isDeleted` của bản tới truyền riêng qua ARGV nên không cần decode bản tới.

**Tombstone ở lại Hash** (không `HDEL`) vì snapshot phải mang chúng tới người reconnect — nếu không, element đã bị người khác xoá lúc họ mất mạng vẫn còn trên màn hình của họ.

### 4.3 Snapshot

`MULTI { HGETALL wb:{id}; GET wb:seq:{id} }` → `elements = Object.values(hash).map(JSON.parse)` (**gồm cả tombstone**, lý do ở §4.2). Redis trống → `elements: []`, `seq: null`.

---

## 5. Lưu Mongo

`WhiteboardService.persist(meetingId)`:

1. `MULTI { HGETALL; GET seq }` — state và seq đọc cùng lúc (nếu đọc riêng: state cũ có thể bị gắn seq mới → bản cuối bị guard chặn).
2. Hash rỗng hoặc seq không có → **không ghi** (tránh `endMeeting` chạy lại lần 2 ghi board rỗng đè Mongo).
3. `elements` = chỉ element **`isDeleted !== true`** (Mongo chỉ dùng để xem lại / clone — không cần tombstone; cỡ document bị chặn bởi 5.000 element còn hiển thị, đúng ý ADR-014). Hash có dữ liệu nhưng mọi element đã xoá → vẫn ghi `[]` (board bị clear là trạng thái thật). `elementCount = elements.length`, `raw = JSON.stringify(elements)`, `elementsGzip = gzip(raw)`.
4. `updateOne({ meetingId, lastSeq: { $lt: seq } }, { $set: { elementsGzip, elementCount, rawSizeBytes, lastSeq: seq, lastPersistedAt: now }, $setOnInsert: { roomId } }, { upsert: true })` — `roomId` đọc từ document Meeting.
5. **Lỗi E11000 → bỏ qua** (filter không khớp vì đã có `lastSeq >=` → upsert cố insert trùng `meetingId` unique → nghĩa là đã có bản mới hơn). Code mẫu ở §11 / `whiteboard.md` §4 thiếu bước này — sửa tài liệu.

**Khi nào gọi:**

| Khi | Cách |
|---|---|
| Sau mỗi `wb:ops` có element thắng | `SET wb:persist-lock:{id} 1 NX PX 15000` → giành được thì `persist` chạy nền (không await, lỗi → `Logger.error`) |
| `endMeeting` (HOST kết thúc, giải tán, `room_finished`, tự hồi phục — mọi đường đều qua đây) | Sau `socketsLeave` (§3.3): `persist` bắt buộc, không khoá → thành công thì `DEL` 3 key Redis (`wb:`, `wb:seq:`, `wb:alive:`). Lỗi → log, **giữ key** (TTL 24 h), không chặn kết thúc meeting |

**Bỏ "ghi khi graceful shutdown" (§11):** state nằm ở Redis, không ở RAM instance.

**RPO (báo cáo):** đang vẽ → Mongo chậm tối đa ~15 s so với Redis; thay đổi trong 15 s cuối nằm ở Redis tới khi meeting kết thúc. Chỉ mất khi Redis chết giữa buổi.

---

## 6. Validate (§14)

Dùng `validatePayload` có sẵn của gateway. Hằng số dùng chung server (validate) + client (lọc, chia batch) ở **`backend/src/shared/whiteboard.ts`** (frontend import qua `@shared/whiteboard`, ADR-024): `WB_ELEMENT_TYPES`, `WB_MAX_BATCH_ELEMENTS = 100`, `WB_MAX_BATCH_BYTES = 512 * 1024`, `WB_MAX_ALIVE_ELEMENTS = 5000`, `WB_MAX_TOTAL_ELEMENTS = 20000`. Chỉ hằng số — không code NestJS / React.

| Event | Luật |
|---|---|
| `meeting:join`, `meeting:leave` | `meetingId`: `IsMongoId` |
| `wb:pointer` | `meetingId`: `IsMongoId`; `x`, `y`: số hữu hạn, `|v| ≤ 1e7` |
| `wb:ops` | `meetingId`: `IsMongoId`; `elements`: mảng 1–100 phần tử; `JSON.stringify(elements)` ≤ 512 KB |

**Từng element — hàm kiểm tay `isValidElement`, không dùng DTO lồng** (`whitelist` / `forbidNonWhitelisted` sẽ xoá / từ chối hàng chục field của Excalidraw):

- object thường (không mảng, không null)
- `id`: chuỗi `^[A-Za-z0-9_-]{1,64}$`; **không trùng id trong cùng batch**
- `version`: số nguyên ≥ 1 · `versionNonce`: số nguyên · `isDeleted`: boolean
- `type` ∈ `WB_ELEMENT_TYPES` = `rectangle, diamond, ellipse, arrow, line, freedraw, text, frame`
  - chặn `image` (spec ảnh sau), `embeddable` / `iframe` (nhúng URL tuỳ ý thành iframe), `selection`, `magicframe`

Sai → `error` 400 cho người gửi, **từ chối cả batch**, không phát. Client đã lọc theo cùng hằng số (§9) nên đường này chỉ gặp khi client lỗi hoặc cố ý gửi sai.

---

## 7. Xử lý lỗi

| Tình huống | Kết quả |
|---|---|
| Payload sai | `error` 400 |
| `meeting:join` meeting không tồn tại / không phải thành viên / meeting ENDED | `error` 404 / 403 / 409 |
| `wb:*` khi socket chưa ở kênh | `error` 403 |
| Lua trả `LIMIT` | `error` 400 "Bảng vẽ đã đạt giới hạn 5.000 đối tượng", không phát (trần tổng 20.000 dùng chung thông báo — chỉ chạm khi tạo / xoá bất thường) |
| Redis lỗi khi chạy Lua / snapshot | không phát / không gửi snapshot, ném lỗi như các handler hiện có (không phải `HttpException` → log) |
| `persist` nền lỗi | `Logger.error`; lần giành khoá sau thử lại |
| `persist` ở `endMeeting` lỗi | log, giữ key Redis, meeting vẫn kết thúc |

---

## 8. Cấu trúc backend

```
shared/
  whiteboard.ts               hằng số dùng chung (§6) — type cho phép, giới hạn batch / element
modules/whiteboard/
  whiteboard.module.ts        đăng ký Whiteboard + Meeting model, import RoomMembersModule, export WhiteboardService
  whiteboard.service.ts       join (kiểm quyền + snapshot), applyOps (Lua), persist, tryPersistInBackground
  whiteboard.lua.ts           chuỗi script wb-apply (hằng số)
  element.validator.ts        isValidElement + kiểm batch (dùng hằng số shared/whiteboard.ts)
  dto/                        WbOpsDto, WbPointerDto, MeetingIdDto
modules/realtime/
  gateways/meeting.gateway.ts thêm 4 handler
  realtime-publisher.service.ts thêm sendSnapshot, publishWbOps, publishWbPointer, leaveMeeting, closeMeetingChannel
modules/meetings/
  meetings.service.ts         endMeeting: closeMeetingChannel + persist; removeFromActiveMeeting: leaveMeeting
```

**Phụ thuộc module (không vòng):** `Realtime → Whiteboard`; `Meetings → Whiteboard`, `Meetings → Realtime`; `Rooms → Realtime, Meetings` (đã có). `WhiteboardModule` tự đăng ký model Meeting, không import `MeetingsModule`.

---

## 9. Frontend

**File:** `features/whiteboard/hooks/useWhiteboardSync.ts` (mới — tự mở socket bằng `io(...)` 3 dòng như `chatService.connect`, không tách file service), `WhiteboardCanvas.tsx` (sửa), `MeetingWorkspace.tsx` (truyền `token`, `meetingId`). Xoá `features/whiteboard/types.ts` mock (grep 2026-11-03: không file nào dùng `WhiteboardElement` / `WhiteboardState`).

`WhiteboardCanvas` nhận thêm `token?`, `meetingId?`; giữ `excalidrawAPI` qua prop `excalidrawAPI`; `UIOptions={{ tools: { image: false } }}` (chặn cả nút, dán, kéo thả ảnh — `isToolSupported("image")`); **`aiEnabled={false}`** (tắt hộp thoại text-to-diagram / Mermaid và magicframe — AI là module riêng). Hai prop đều có trong types 0.18.1. `embeddable` vẫn còn ở menu "thêm công cụ" (không tắt được bằng prop) → xử lý bằng bước lọc dưới đây. Không có `meetingId` (bản preview) → chạy local như cũ.

**Hook:**

| Việc | Cách |
|---|---|
| Kết nối | Socket mở khi có `token` + `meetingId`. Mỗi lần `connect` (kể cả reconnect) → `meeting:join` |
| Nhận snapshot / `wb:ops` | `reconcileElements(local, remote, appState)` → `updateScene({ elements, captureUpdate: CaptureUpdateAction.NEVER })` (không vào undo/redo) → ghi version các element nhận vào `syncedVersions` |
| Gửi | `onChange` gọi `scheduleFlush()` — throttle 50 ms (chạy ngay lần đầu + lần cuối chu kỳ, tự viết, không thêm dependency). `flush`: lấy `getSceneElementsIncludingDeleted()`, chọn element có `version > syncedVersions.get(id)` (gồm tombstone `isDeleted`) → **lọc** (dưới) → chia batch theo `WB_MAX_BATCH_ELEMENTS` **và** `WB_MAX_BATCH_BYTES` → gửi → ghi version vào map (ghi lúc gửi, không chờ server) |
| Lọc trước khi gửi | Bỏ element có `type ∉ WB_ELEMENT_TYPES` hoặc một mình đã vượt `WB_MAX_BATCH_BYTES`. Element bị lọc **vẫn ghi version vào map** (không thử gửi lại mỗi lần flush) và hiện thông báo "Đối tượng này chỉ hiện trên máy bạn, không đồng bộ" **1 lần mỗi element**. Nhờ vậy 1 element sai không kéo cả batch hợp lệ bị server từ chối |
| Sau snapshot | `flush()` ngay — gửi những gì vẽ lúc mất mạng |
| Con trỏ | `onPointerUpdate` throttle 50 ms → `wb:pointer`. Nhận → `collaborators` (Map theo `userId`, `username` = displayName) → `updateScene({ collaborators })`; ai im 5 s → xoá |
| Lỗi | event `error` → hiện thông báo ngắn trong khung board |
| Rời trang | `meeting:leave` + `disconnect` |

State trên là state UI trong trình duyệt — ràng buộc #5 áp cho server.

---

## 10. Test

### 10.1 Backend (vitest, viết test trước)

1. **`wb-apply` trên Redis thật** (`redis-dev`, cổng 6379; không kết nối được → **fail**, không skip). Ca:
   - version cao thắng; version thấp thua
   - version bằng, nonce bản tới nhỏ hơn → thắng; nonce bản tới lớn hơn → thua; nonce bằng → nhận bản tới (dấu `<`)
   - element mới
   - batch làm số element **còn hiển thị** vượt 5.000 → `LIMIT`, Hash và `wb:alive` không đổi
   - **tombstone không tính:** 5.000 element rồi xoá hết → thêm element mới vẫn được; `wb:alive` về 0 rồi tăng lại
   - đếm `alive` đúng ở 4 chuyển trạng thái: mới-sống (+1), mới-đã xoá (0), sống→xoá (−1), xoá→sống (+1); bản tới thua thì không đổi
   - bảng đầy 5.000 vẫn xoá / sửa được (batch `aliveDelta ≤ 0`)
   - trần tổng: `HLEN + id mới > 20.000` → `LIMIT` (test bằng tham số `maxTotal` nhỏ)
   - không element nào thắng → seq không tăng
   - có element thắng → 3 key có TTL
   - nhiều element trong 1 batch, thắng/thua lẫn → trả đúng chỉ số
2. **`WhiteboardService.persist`** (mock model + Redis): filter đúng `{ meetingId, lastSeq: { $lt: seq } }`; E11000 → không ném; Hash rỗng → không gọi `updateOne`; gunzip `elementsGzip` ra đúng elements **không có tombstone**, `elementCount` = số element chưa xoá; Hash chỉ toàn tombstone → vẫn ghi `[]`.
3. **`isValidElement`** và giới hạn batch: từng luật §6 (thiếu `version`, `type: image`, `type: iframe`, `type: embeddable`, id có ký tự lạ, id trùng trong batch, 101 element, > 512 KB).
4. **Gateway** (mock service/publisher, như `meeting.gateway.spec.ts`): `wb:ops` khi chưa join → 403; `meeting:join` không phải thành viên / ENDED → lỗi đúng mã; join thành công gọi `socket.join` **trước** đọc snapshot; chỉ phát element thắng; Lua không có element thắng → không phát.
5. **`MeetingsService`**: `endMeeting` gọi `closeMeetingChannel` rồi `persist`; `persist` lỗi không làm `endMeeting` ném; `removeFromActiveMeeting` gọi `leaveMeeting`.

### 10.2 Chạy thật (Docker, ghi kết quả vào progress)

2 trình duyệt (2 tài khoản cùng phòng): vẽ chéo · kéo hình liên tục (bên kia thấy hình di chuyển trong lúc kéo) · sửa cùng 1 element · xoá / clear · tắt mạng 1 bên, bên kia xoá 1 hình, bật mạng lại (hình biến mất ở bên vừa reconnect — tombstone trong snapshot) · nét vẽ lúc offline sang được bên kia · chèn `embeddable` từ menu → hiện thông báo không đồng bộ, các hình vẽ cùng lúc vẫn sang bên kia · người thứ 3 vào giữa buổi (thấy đủ board) · HOST kick 1 người (người đó không vẽ được nữa) · kết thúc meeting → `whiteboards` trong Mongo có document, gunzip ra đúng số element **chưa xoá**, key `wb:*` đã xoá.

### 10.3 Lệnh kiểm

Repo **không có** lệnh `/check` (không có `.claude/commands`, cả ở cấu hình user) dù CLAUDE.md nhắc tới → chạy lệnh thật bằng PowerShell, dán output vào progress:

```powershell
Set-Location backend;  npm run lint; npx vitest run; npm run build
Set-Location ../frontend; npm run lint; npm run build
```

**CI:** workflow hiện tại (`.github/workflows/githup-action-demo.yml`) chỉ `echo`, chưa chạy test. Test Lua §10.1 cần Redis thật → khi thêm `vitest` vào CI phải khai báo `services: redis` (image `redis:7-alpine`, cổng 6379) và `REDIS_URL`.

---

## 11. Đo độ trễ — `tests/load/wb-latency.mjs`

- Node + `socket.io-client` lấy từ `frontend/node_modules` bằng `createRequire(new URL('../../frontend/package.json', import.meta.url))` — **không thêm dependency** (gốc repo không có `package.json` dependencies). Chạy: `node tests/load/wb-latency.mjs` (PowerShell, từ gốc repo).
- Chuẩn bị qua REST: N tài khoản, 1 phòng, N thành viên, HOST bắt đầu meeting. Chạy xong trước `MEETING_AUTO_END_AFTER_MIN` (ADR-022 — không ai vào LiveKit nên room sẽ tự đóng).
- N client cùng 1 máy (chung đồng hồ). Client khác ghi `nhận − sentAt` (`sentAt` nhúng ở `customData.sentAt` của element). Hai kịch bản:
  - **A — element nhỏ:** client A gửi `wb:ops` 1 hình chữ nhật, tăng `version` mỗi 50 ms.
  - **B — nét vẽ tay dài:** client A gửi 1 element `freedraw`, mỗi 50 ms thêm điểm (mô phỏng ~60 điểm/giây) và gửi **toàn bộ** mảng `points` như Excalidraw làm, kéo dài 10 s. Payload tăng dần theo số điểm → tổng byte của một nét tăng theo bình phương.
- Kết quả: p50 / p95 / max độ trễ với **N = 2, 10, 20**, 1 instance; kịch bản B ghi thêm **cỡ payload cuối nét** và **byte/giây mỗi người nhận**. Đo 2 instance khi xong task nginx, cùng script.
- Kịch bản B **chỉ đo, chưa tối ưu**. Có số rồi mới quyết có cần đổi cách gửi nét vẽ tay hay không (task riêng).
- Ghi số vào `docs/progress.md` (và sau này báo cáo).

---

## 12. Tài liệu cần sửa khi xong

- PROJECT_CONTEXT §9 (§3.4 spec này), §10 (throttle, chống echo, bỏ "hàm merge ở shared/"), §11 (cách lưu, guard + E11000, bỏ graceful shutdown).
- `whiteboard.md` §1–§5 tương ứng.
- DB_DESIGN Phần E (§4.1 spec này, gồm key `wb:alive:`); DB_DESIGN §C.8 + ADR-014: ghi rõ 5.000 là **element còn hiển thị**, Mongo không lưu tombstone.
- `docs/api/endpoint.md` — mục event Socket.IO whiteboard.
- `docs/decisions.md` — 4 ADR `[phát sinh kỹ thuật]`:
  - ADR-028 Live state whiteboard = Redis Hash + Lua `wb-apply`; luật LWW server nằm trong Lua, client dùng `reconcileElements` (thay câu "dùng chung một bản" của §10); giới hạn đếm element còn hiển thị, tombstone giữ ở Redis, không xuống Mongo; client lọc type theo `shared/whiteboard.ts`
  - ADR-029 Bỏ ring buffer / replay, join và reconnect luôn nhận full snapshot
  - ADR-030 Lưu Mongo bằng `SET NX PX 15000` + bản cuối ở `endMeeting`, không timer RAM
  - ADR-031 Client throttle 50 ms, chống echo bằng map version
- `docs/progress.md`.

---

## 13. Giới hạn (Limitations của báo cáo)

1. **Op tới sát lúc kết thúc:** op đã qua bước kiểm kênh nhưng chạy Lua sau khi `endMeeting` xoá key → tạo lại key Redis chỉ có vài element (TTL 24 h tự dọn). **Vì sao không đè bản đã lưu:** key bị xoá nên `wb:seq` mới bắt đầu lại từ 1; nếu op này giành được khoá persist, filter `{ meetingId, lastSeq: { $lt: 1 } }` không khớp document đã có (`lastSeq ≥ 1`) → upsert cố insert trùng `meetingId` unique → E11000 → bỏ qua (§5 bước 5). Trường hợp duy nhất op muộn vào Mongo: board **chưa từng được lưu** (trống tới lúc kết thúc) — khi đó insert thành công, và đó là dữ liệu thật nên đúng.
2. **Join sát lúc kết thúc:** `meeting:join` đọc ACTIVE rồi `endMeeting` chạy `socketsLeave` trước khi `socket.join` → socket ở lại kênh của meeting đã kết thúc; op của nó rơi vào trường hợp 1.
3. **Element bị từ chối vì giới hạn** (5.000 còn hiển thị / 20.000 tổng) vẫn còn ở máy người gửi tới lần join / reconnect sau. Element bị **client lọc** (`embeddable`, quá cỡ) chỉ hiện trên máy người tạo, có thông báo.
4. **Redis là điểm chết duy nhất** của live state (1 node) — mất Redis giữa buổi mất tối đa ~15 s cuối + phải vẽ lại phần chưa lưu.
5. **LWW per-element:** 2 người sửa cùng 1 element trong cùng khoảng 50 ms → 1 bản thắng, bản kia mất (ADR-003, CRDT là alternative).
6. Mỗi người trong meeting giữ 2 websocket (chat + whiteboard).
7. Chỉ đo 1 instance ở task này.
