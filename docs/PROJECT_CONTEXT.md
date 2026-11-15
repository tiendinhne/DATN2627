# PROJECT CONTEXT

**Đề tài:** Hệ thống học nhóm trực tuyến dựa trên WebRTC, tích hợp bảng vẽ cộng tác thông minh
**English:** A WebRTC-Based Online Group Learning System with an Intelligent Collaborative Whiteboard
**Loại:** Khóa luận tốt nghiệp · **Nhóm:** 2 người · **Thời gian code:** 2 tháng
---

## 0. Cách dùng tài liệu này

Đây là tài liệu bàn giao.

Khi hỗ trợ dự án này, mặc định tuân theo tài liệu. Nếu một yêu cầu mới mâu thuẫn với quyết định đã chốt, phải nói rõ mâu thuẫn đó trước khi làm.
---

## 1. Mục tiêu và ba trụ cột

Hệ thống web cho phép nhiều người học tập, thảo luận và cộng tác trong một phòng trực tuyến: giao tiếp audio/video/screen share, chat, bảng vẽ cộng tác, và trợ lý AI sinh sơ đồ từ ngôn ngữ tự nhiên.

Ba trụ cột được đánh giá:

```
1. WebRTC/SFU scalability        — tầng media
2. Horizontal scale + stateless  — tầng application  (GVHD bắt buộc)
3. Realtime collaboration + AI whiteboard
```

Trụ cột 1 và 2 là **hai loại scalability khác nhau**, không được nhầm khi viết báo cáo:

| | Trụ cột 1 — SFU | Trụ cột 2 — Horizontal scale |
|---|---|---|
| Đối tượng | LiveKit media server | NestJS backend |
| Câu hỏi | Một node SFU chịu được bao nhiêu participant? | Thêm instance có tăng năng lực xử lý không? |
| Nghẽn chính | CPU + **bandwidth** | Chia sẻ trạng thái, session affinity |
| Cách chứng minh | Benchmark tăng dần N | 2+ instance sau LB, user khác instance vẫn đồng bộ |

Một tính năng chưa có cách đo và chưa giải thích được đánh đổi thì chưa coi là xong.
---

## 2. Phạm vi

**Trong phạm vi:** Auth (local + Google OAuth), room, meeting lifecycle, audio/video/screen share, chat, presence, collaborative whiteboard, whiteboard persistence, AI sinh diagram/mindmap/flowchart, upload file, import/export dữ liệu , horizontal scale + load balancer, Docker, HTTPS + domain thật, benchmark.

**Ngoài phạm vi:** Mobile native app · tự huấn luyện AI model · phần mềm thiết kế đồ hoạ · **recording/egress** · transcription · breakout room · virtual background · multi-region · LiveKit multi-node · admin panel toàn hệ thống.

Recording bị loại có chủ đích: egress transcode tiêu CPU rất nặng, cạnh tranh trực tiếp với mục tiêu đo scalability của SFU. Trình bày trong báo cáo như một đánh đổi, không phải thiếu sót.

## 4. Domain model và lifecycle

**Không hỗ trợ guest.** Mọi người dùng bắt buộc đăng nhập. Link join: `/join/:code` → chưa login → redirect `/login?returnUrl=...` → login xong tự resolve code và vào meeting.

Lý do (viết được vào báo cáo): mọi realtime event luôn gắn `userId` thật nên audit, presence, permission nhất quán; không cần cơ chế token ẩn danh song song nên giảm bề mặt tấn công; LiveKit token luôn sinh từ identity đã xác thực.
---

## 5. Kiến trúc và topology

**Media KHÔNG đi qua NGINX.** WebRTC media là UDP/SRTP trực tiếp tới LiveKit. NGINX chỉ proxy HTTP và WebSocket.

**Bảng port:**

| Port | Proto | Dịch vụ | Public |
|---|---|---|---|
| 443 | TCP | NGINX — REST + Socket.IO | ✅ |
| 80 | TCP | redirect + ACME | ✅ |
| 7882 | UDP | LiveKit media (single-port mode) | ✅ |
| 7881 | TCP | LiveKit ICE/TCP fallback | ✅ |
| 5349 | TCP | TURN over TLS | ✅ |
| 3478 | UDP | TURN/UDP | ✅ |
| 7880 | TCP | LiveKit HTTP/WS | qua proxy |
| backend, mongo, redis | TCP | — | ❌ nội bộ |

- **LiveKit dùng single-port UDP mode** (`rtc.udp_port: 7882`), không dùng dải 50000–60000 vì Docker map 10.000 port cực chậm.
- **TURN bắt buộc.** Không có TURN thì mạng trường / 4G / NAT đối xứng sẽ fail và buổi bảo vệ có thể hỏng. Dùng embedded TURN của LiveKit, TLS trên 5349 (không dùng 443 vì trùng NGINX).
- **LiveKit container chạy `network_mode: host`** trên Linux, tránh NAT hai lớp làm hỏng ICE candidate.

**Cross-origin:** frontend `app.<domain>` và backend `api.<domain>` là hai origin khác nhau. Refresh token dùng cookie `Domain=.<domain>; Secure; HttpOnly; SameSite=None`. CORS whitelist chính xác, không dùng `*`. Socket.IO bật `withCredentials`. Access token giữ trong memory, không localStorage.


## 6. Nguồn sự thật

| Dữ liệu | Nguồn sự thật | Đường truyền |
|---|---|---|
| Audio/Video/Screen media | **LiveKit SFU** | WebRTC SRTP/UDP |
| Ai đang trong meeting | **LiveKit** | webhook → backend |
| Mic/Camera on-off | **LiveKit** track mute state | LiveKit events |
| Chat message | **Backend / MongoDB** | Socket.IO |
| Whiteboard element | **Redis (live) → Mongo (persist)** | Socket.IO |
| Room/Meeting/role | **Backend / MongoDB** | REST + Socket.IO |
| Cursor, typing | ephemeral, không lưu | Socket.IO |

**Client không được tự báo "tôi đã join".** Backend cập nhật `MeetingParticipant` từ LiveKit webhook (`participant_joined`, `participant_left`, `room_finished`). Nếu cả LiveKit và Socket.IO cùng phát presence, hai nguồn sẽ lệch khi mạng chập chờn và không có cách nào biết cái nào đúng.

---

## 7. Horizontal scale và stateless (GVHD)

GVHD nêu rõ: nhân bản server mà code không hỗ trợ distributed thì **việc scale vô nghĩa** 

### 7.1 Checklist stateless

| State | ❌ Sai | ✅ Đúng |
|---|---|---|
| Session đăng nhập | MemoryStore | **JWT stateless** + refresh hash trong Mongo |
| Danh sách socket theo room | `Map<roomId, Socket[]>` | **Socket.IO Redis adapter** |
| Whiteboard live state | biến global | **Redis Hash** `wb:{meetingId}` (ADR-028) |
| Sequence counter | `let seq = 0` | **Redis `INCR`** |
| Presence | `Set<userId>` | **Redis Set** + TTL |
| Rate limit | counter in-memory | **Redis** (`INCR` + `EXPIRE`) |
| File upload | ghi `/tmp` local | **Amazon S3 qua presigned URL** |
| Cron job | `@Cron` chạy mọi replica | **Distributed lock** |

**Quy tắc kiểm tra khi code:** *"Nếu request tiếp theo của user này rơi vào instance khác, có còn đúng không?"* Nếu không → state đang sai chỗ.

### 7.2 Socket.IO Redis adapter — bắt buộc từ ngày đầu

### 7.4 LiveKit webhook trong môi trường đa instance

Webhook chỉ tới **một** instance. Mọi side effect phải đi qua Mongo hoặc Redis, không giữ trong RAM. Socket.IO Redis adapter lo phần fan-out tới client ở instance khác. Bắt buộc **verify chữ ký webhook** — không verify thì ai cũng giả được webhook để đá người khác khỏi meeting.

### 7.5 Scheduled job

`@nestjs/schedule` chạy trên mọi replica. Job định kỳ (nếu có) phải bọc distributed lock. **Auto-end meeting không dùng job** — dùng timeout của LiveKit + webhook `room_finished` (ADR-022). Quy tắc lock dưới đây giữ cho job khác sau này:

```
SET lock:<tên-job> <instanceId> NX PX 30000
```

Giải phóng bằng Lua script kiểm tra token khớp, tránh xoá nhầm lock của instance khác. Giới hạn: chỉ một Redis nên lock là single point of failure — ghi rõ trong phần Limitations.

### 7.6 Graceful shutdown

Auto-scale sẽ thu hồi instance đang có kết nối. Cần: `GET /health` (liveness) và `GET /ready` (kiểm tra Mongo + Redis); bắt `SIGTERM` → ngừng nhận kết nối mới → emit `server:draining` → chờ ~10s → đóng; client tự reconnect sang instance khác, gửi lại `meeting:join` và nhận full snapshot (ADR-029).

### 7.7 Không dựng integration event bus riêng

Socket.IO Redis adapter đã lo toàn bộ fan-out giữa các instance, và backend không giữ state trong RAM nên không có cache nào cần invalidate cross-instance. Thêm một message bus nữa sẽ vi phạm nguyên tắc "mỗi công nghệ phải có lý do" mà không giải quyết vấn đề nào có thật.

## 8. Bandwidth — ràng buộc quyết định mục tiêu
đọc mục 6,7 docs/architecture/webrtc.md

## 9. Realtime contract (Socket.IO)

Socket.IO **chỉ** cho application data. Không bao giờ audio/video/screen.

**Namespace** `/meeting` · **Room** `user:${userId}` · `room:${roomId}` · `meeting:${meetingId}` · **Transport** `['websocket']` only

**Auth:** JWT qua `socket.handshake.auth.token`, **không qua query string** (query bị log ở proxy). Verify khi handshake → resolve `userId` → `room:subscribe` gọi `assertRoomAccess` (thành viên, room ACTIVE) → mới cho vào kênh `room:{roomId}`; `meeting:join` kiểm thêm meeting ACTIVE.

**Envelope chuẩn cho mọi event server → client:**

```jsonc
{
  "v": 1,                  // version schema event
  "seq": 1234,             // null với event ephemeral (cursor, typing)
  "ts": "2026-09-13T10:00:00.000Z",
  "actorId": "665f...",
  "roomId": "665d...",
  "meetingId": "665e...",
  "data": { }
}
```

`meetingId` có thể `null` (event thuộc room, không gắn meeting nào).

**Event catalog:**

| Client → Server | Payload |
|---|---|
| `room:subscribe` | `{ roomId }` |
| `room:unsubscribe` | `{ roomId }` |
| `meeting:join` | `{ meetingId }` |
| `meeting:leave` | `{ meetingId }` |
| `chat:send` | `{ roomId, clientMsgId, content, fileId?, meetingId? }` |
| `wb:ops` | `{ meetingId, elements[] }` |
| `wb:pointer` | `{ meetingId, x, y, tool, button }` — `tool` ∈ `pointer` · `laser`, `button` ∈ `down` · `up` (laser hiện ở máy khác) `[phát sinh kỹ thuật]` |
| `ai:generate` | `{ meetingId, requestId, prompt, kind }` — `meetingId` `[phát sinh kỹ thuật]` (spec AI §1 câu 8) |

| Server → Client | Payload |
|---|---|
| `meeting:snapshot` | envelope, `data: { elements[] }` — gửi riêng socket vừa join, gồm cả tombstone |
| `meeting:member_changed` | `{ userId, action, role }` |
| `meeting:ended` | `{ reason }` |
| `chat:new` | envelope chuẩn, `data: { message }` — emit tới `room:{roomId}`; client lọc theo `meetingId` cho khung chat meeting |
| `room:access_revoked` | envelope chuẩn, `data: { reason: 'LEFT' \| 'KICKED' \| 'DISSOLVED' }`; server phát trước khi ép socket rời kênh Room |
| `wb:ops` | envelope, `data: { elements[] }` — chỉ element thắng, kênh `meeting:{id}` trừ người gửi |
| `wb:pointer` | envelope `seq` null, `data: { userId, displayName, x, y, tool, button }` — volatile |
| `ai:result` | envelope `seq: null`, `data: { requestId, diagram }` — chỉ socket người yêu cầu |
| `ai:status` | envelope `seq: null`, `data: { requestId, status: 'failed', code, message }` — chỉ socket người yêu cầu |
| `server:draining` | `{}` |
| `error` | `{ statusCode, error, message, details? }` |

Quyền: `room:subscribe`, `chat:send` luôn gọi `RoomAccessService.assertRoomAccess`; có `meetingId` thì thêm `assertMeetingTag`. Chi tiết: spec chat-room-scope.

**Ordering, duplicate, reconnection:**
- `seq` đơn điệu tăng, cấp bằng **Redis `INCR`** → atomic across instances, tự nhiên có total order
- Join / reconnect: client gửi lại `meeting:join`, server trả full snapshot từ Redis (không ring buffer — ADR-029)
- Chống trùng: chat dùng `clientMsgId` (unique index ở DB); whiteboard idempotent tự nhiên nhờ LWW

Cơ chế này phục vụ đồng thời reconnect thông thường **và** chuyển instance khi auto-scale.

**Phân biệt hai loại event — không được trộn:**

```
Domain event   : meeting.ended          nội bộ, đổi tự do
Realtime event : meeting:ended          contract với client, đổi phải sửa frontend
```

---

## 10. Whiteboard

**Mô hình đồng bộ: LWW per-element**, dùng đúng cơ chế sẵn có của Excalidraw:

```
version cao hơn thắng
hoà version → versionNonce nhỏ hơn thắng
isDeleted = true là trạng thái (tombstone), KHÔNG xoá khỏi mảng
```
**Luồng:**

```
Excalidraw onChange (throttle 50 ms)
 → diff element có version thay đổi
 → emit wb:ops (batch, KHÔNG gửi toàn bộ scene)
 → Backend: validate + socket đã ở kênh meeting:{id}
 → Backend: Redis INCR seq (trong script Lua)
 → Lua wb-apply merge LWW vào Redis Hash (atomic, ADR-028)
 → broadcast qua Redis adapter tới MỌI instance
 → client khác reconcile + updateScene()
```

- **Cursor đi kênh riêng**, throttle 50ms, không lưu, không tăng `seq`.
- **Echo loop:** client nhận op của chính mình → `updateScene` → `onChange` → gửi lại. Chặn bằng map id → version đã gửi / nhận (ADR-031).
- **Clear board** = set `isDeleted` cho tất cả, không phải xoá mảng.
- **Freedraw** có hàng nghìn point → giới hạn kích thước payload.
- Luật LWW: server trong Lua, client dùng `reconcileElements` của Excalidraw — cùng luật, client thêm lớp giữ thao tác đang dở (ADR-028). Hằng số dùng chung ở `backend/src/shared/whiteboard.ts`.

---

## 11. Persistence

| Tầng | Nơi lưu | Mục đích |
|---|---|---|
| Live state | Redis `wb:{meetingId}` | Nguồn đọc snapshot khi join |
| Persisted snapshot | Mongo `whiteboards` | Lưu lâu dài; **xem lại** buổi đã kết thúc qua `GET /meetings/:meetingId/whiteboard` (chỉ xem, 2026-11-13); clone vẫn là task sau; chưa có đường nạp lại Mongo → Redis |
| Historical | Mongo, gắn meeting ENDED | Review sau meeting |

**Không ghi Mongo mỗi op.** Sau op có thay đổi: `SET wb:persist-lock:{id} NX PX 15000`, instance giành được khoá ghi nền; `endMeeting` ghi bản cuối rồi xoá key Redis (ADR-030). Không timer RAM, không cron, không ghi khi graceful shutdown (state ở Redis).

Đánh đổi cho báo cáo: đổi write amplification lấy RPO ~15 s khi đang vẽ (ADR-030). Chấp nhận được với ngữ cảnh học nhóm.

**Ràng buộc 16 MB/document:** elements lưu dạng `gzip(JSON)` → `Buffer`. Hard limit **5.000 element/board**, vượt thì báo lỗi rõ ràng; 5.000 tính element còn hiển thị, Mongo không lưu tombstone. Nêu ở phần Limitations.

**Guard chống ghi đè ngược** — bắt buộc khi nhiều instance cùng persist:

```js
updateOne(
  { meetingId, lastSeq: { $lt: incomingSeq } },
  { $set: { elementsGzip, elementCount, lastSeq: incomingSeq, lastPersistedAt } },
  { upsert: true },
)
```

Filter không khớp vì đã có `lastSeq` ≥ seq → upsert ném E11000 → bắt và bỏ qua (đã có bản mới hơn).

---

## 12. AI pipeline

**Kiến trúc 3 lớp.** LLM sinh toạ độ rất tệ — nếu bắt model trả thẳng element Excalidraw kèm `x, y, width, height` và arrow binding thì kết quả chồng chéo, mũi tên lệch, trông như bug. Phải tách sinh **cấu trúc** khỏi tính **vị trí**.

```
User prompt (AIPanel)
 → ai:generate { meetingId, requestId, prompt, kind } — gateway validate, socket phải ở kênh meeting
 → AiAssistantService: rate limit Redis (người / meeting / toàn hệ thống)
 → LLM Gemini (JSON mode + responseSchema) ── trả DSL: CHỈ nodes + edges, KHÔNG toạ độ
 → Validate schema (Zod) — hỏng thì thử lại đúng 1 lần
 → Layout engine (elkjs) → x, y, w, h cho node, đường cho cạnh
 → ai:result chỉ tới socket người yêu cầu
 → [trình duyệt người yêu cầu] convertToExcalidrawElements() → updateScene (giữ element cũ)
 → wb:ops như nét vẽ thường → Lua LWW → broadcast qua Redis adapter
```

`[phát sinh kỹ thuật]` Bước dựng element chạy ở trình duyệt, không ở backend: `convertToExcalidrawElements` đo chữ bằng canvas, không chạy trong Node (ADR-033). Model + giới hạn: ADR-034. Chi tiết: `docs/task/AI/ai_module_spec.md`.

**DSL trung gian** — LLM chỉ trả `nodes` + `edges`; `kind` lấy từ request, hướng bố cục suy từ `kind`:

```jsonc
{
  "nodes": [ { "id": "n1", "label": "Bắt đầu", "shape": "ellipse" } ],   // shape: rectangle | ellipse | diamond
  "edges": [ { "from": "n1", "to": "n2", "label": "" } ]
}
```

Ràng buộc validate: `nodes ≤ 40`, `edges ≤ 80`, nhãn chuẩn hoá NFC + gộp khoảng trắng, `label ≤ 80 ký tự` (dài hơn thì cắt còn 79 + "…"), mọi `edge.from/to` phải tồn tại, không cạnh tự vòng, `id` unique, không node mồ côi.

**Điểm dễ hỏng nhất:** element phải mang `id` / `version` / `versionNonce` hợp lệ và **giống nhau trên mọi client**. Vì vậy chỉ trình duyệt người yêu cầu gọi `convertToExcalidrawElements`, một lần mỗi `requestId`; người khác nhận nguyên JSON qua `wb:ops`, không convert lại.

**Xử lý lỗi:**

| Rủi ro | Xử lý |
|---|---|
| JSON hỏng / DSL sai | JSON mode + retry **đúng 1 lần**; lần 2 fail → `ai:status` `INVALID_OUTPUT` |
| Gemini quá tải (5xx) / lỗi mạng | Dùng chung lần retry ở trên |
| Timeout | 30 s cho **cả** request → `ai:status` `TIMEOUT` |
| Prompt injection | System prompt cố định ở backend (`systemInstruction`); user input là **data** trong `contents`, không nối vào instruction |
| Spam / chi phí | Rate limit **trong Redis**: 5 req/user/phút, 20 req/meeting/giờ + 12 lần gọi Gemini/phút, 450/ngày cho cả hệ thống (ADR-034) |
| Đè lên board | Client đặt sơ đồ vào vùng trống bên phải bounding box hiện tại (`getCommonBounds`); không thay element cũ |
| Lộ API key | Chỉ ở backend env |

AI content là element bình thường — user sửa/xoá/di chuyển như mọi element khác.

---

## 13. Import / Export (GVHD)

GVHD: *"các chức năng quản lý dữ liệu hàng loạt phải có cơ chế import/export, trong dialog import phải ghi rõ định dạng cần import, và khi chọn file xong phải có giao diện review trước khi xác nhận."*

** import Room members:**
---

## 14. Input validation (GVHD)

Bắt buộc ở **mọi** entry point, không ngoại lệ:

| Entry point | Cơ chế |
|---|---|
| REST API | `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })` + DTO |
| **Socket.IO event** | DTO + validate thủ công — `ValidationPipe` **không tự áp cho gateway** |
| File upload / import | đuôi file, MIME, kích thước, số dòng, schema từng dòng |
| AI response | Zod schema — LLM cũng là untrusted input |
| LiveKit webhook | **verify chữ ký** |
| Query phân trang | `limit` có max, `page` ≥ 1, `sort` whitelist tên trường |
| MongoDB query | chặn NoSQL injection, không truyền object thô từ user |
| Env | **Zod fail-fast** — thiếu biến thì app không khởi động |

**Format lỗi thống nhất cho cả REST và Socket.IO:**

```jsonc
{
  "statusCode": 400,
  "error": "VALIDATION_ERROR",
  "message": "Dữ liệu không hợp lệ",
  "details": [ { "field": "email", "constraint": "Email không đúng định dạng" } ]
}
```

Frontend hiển thị lỗi **ngay tại field**, không chỉ toast chung.

---

## 15. Permission
Enforce ở **backend**, cả REST guard lẫn Socket.IO handler. Frontend chỉ ẩn/hiện UI.
Permission được biểu diễn dưới dạng **dữ liệu** (bảng tra) trong `shared/`, không phải chuỗi if-else, dùng chung cho backend và frontend.
**Role map thẳng sang LiveKit token grant** (hiện HOST và MEMBER đều `canPublish: true`, xem `docs/rule/role.md`) → quyền media enforce ngay ở SFU, không chỉ ẩn nút ở UI. Token TTL 6 giờ, cấp lại mỗi lần join meeting.
Hiện hai role có grant giống hệt nhau nên code dùng **một hằng số `MEMBER_GRANT`** trong adapter LiveKit (`canPublish`, `canSubscribe`, `canPublishData: false` — P2); khi có role mới (vd VIEWER) mới cần bảng theo role (spec meeting §4.3).
Lưu ý nhỏ: token đã cấp thì không tự cập nhật. Nếu cần đổi quyền ngay giữa buổi họp (ví dụ host tắt quyền nói của ai đó), bạn phải gọi API updateParticipant của LiveKit từ backend để đổi permission trực tiếp, chứ chờ họ join lại thì quá chậm.
---

## 16. Security

- **Access token ngắn (15m) + refresh token rotation**, lưu **hash** trong Mongo với TTL index (stateless-friendly, verify được ở mọi instance)
- Password: **bcryptjs** (thuần JS, không cần native build — tránh hẳn vấn đề node-gyp trên Windows)
- Google OAuth: hỗ trợ liên kết tài khoản khi email trùng với tài khoản local; `googleId` unique + `sparse: true`
- **Google callback KHÔNG trả token qua query string** — token sẽ vào browser history, access log NGINX và header `Referer`. Dùng one-time code ngắn hạn (60s, lưu Redis) rồi frontend đổi lấy token qua POST, hoặc set cookie httpOnly rồi redirect không kèm gì
- Socket.IO auth qua handshake, re-check membership mỗi lần join room
- LiveKit API key/secret và AI API key **chỉ ở backend**
- LiveKit webhook **verify chữ ký**
- Rate limit **trong Redis**: login, brute-force join code, AI request, whiteboard op size, import
- Join code 8 ký tự base32, không tuần tự
- HTTPS bắt buộc — `getUserMedia` chỉ chạy trên secure context
- CORS whitelist chính xác, Helmet, giới hạn body size

---

## 17. Observability và benchmark

**Stack:** LiveKit Prometheus endpoint (có sẵn) · node-exporter + cAdvisor · Grafana · pino JSON với `requestId` / `meetingId` / **`instanceId`**.

`instanceId` trong log là **bắt buộc** — không có nó thì không chứng minh được load balancer phân phối đều (E3). Dựng observability ngay sau bước LiveKit integration, không để tới cuối.

**Benchmark WebRTC:**

Không mời được 20 người thật, và một laptop không chạy nổi 20 browser có camera. Dùng **`livekit-cli load-test`** sinh publisher/subscriber giả, k6 hoặc script Node cho REST + Socket.IO. **Máy sinh tải phải tách khỏi máy chạy SFU**, nếu không số liệu CPU vô nghĩa.

**Mọi con số trong báo cáo phải đo thực tế.** Không lấy số trong docs của LiveKit làm số của mình. Mỗi kịch bản chạy ≥ 3 lần, báo cáo trung bình + độ lệch.

---

## 18. Deployment

## 19. Stack và cấu trúc code

### 19.2 Cấu trúc thư mục

**Quy ước:**
- `shared/` là nơi duy nhất định nghĩa enum, event envelope, permission matrix, `lww-merge`. Không copy thủ công sang hai phía.
- Mọi emit ra socket đi qua một publisher duy nhất, không gọi `server.to()` rải rác — để gắn envelope nhất quán và sau này thêm logging/metrics chỉ sửa một chỗ.
- Module nào có hệ ngoài phía sau (LiveKit, Gemini, storage) thì tách `ports/` + `adapters/`, đặt tên theo **năng lực** không theo vendor (`media` không phải `livekit`).
- Module CRUD thuần giữ layered đơn giản: controller → service → schema.

### 19.3 Database
Chi tiết đầy đủ ở `DB_DESIGN.md`.

## 23. Nguyên tắc làm việc

**P1 — Không over-engineer.** `Correctness → Understandability → Testability → Scalability đúng phạm vi → Performance`

**P2 — Tách media và application realtime.** Media qua LiveKit. Application data qua Socket.IO. Không trộn.

**P3 — Backend là nơi enforce.** Client không tự quyết permission. Frontend chỉ ẩn/hiện UI.

**P5 — Thiết kế cho nhiều user.** Mọi tính năng realtime phải trả lời được: "Điều gì xảy ra nếu 2, 10, 20 user cùng làm hành động này?"

**P9 — Stateless backend.** Trước khi commit bất kỳ đoạn code nào giữ state: *"Nếu request tiếp theo của user này rơi vào instance khác, có còn đúng không?"*

**P10 — Validate mọi input.** REST, WebSocket, file import, AI response, webhook, env. Không ngoại lệ.

---
