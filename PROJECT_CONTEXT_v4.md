# PROJECT CONTEXT v4 — BÀN GIAO

**Đề tài:** Hệ thống học nhóm trực tuyến dựa trên WebRTC, tích hợp bảng vẽ cộng tác thông minh
**English:** A WebRTC-Based Online Group Learning System with an Intelligent Collaborative Whiteboard
**Loại:** Khóa luận tốt nghiệp · **Nhóm:** 2 người · **Thời gian code:** 2 tháng
**Cập nhật:** 09/2026 · Thay thế toàn bộ v3

---

## 0. Cách dùng tài liệu này

Đây là tài liệu bàn giao. **Mọi mục trong đây đều đã chốt** — không còn phương án mở, không còn phân tích đánh đổi để cân nhắc. Phần lý do được giữ lại ngắn gọn vì báo cáo đồ án cần giải thích được.

Khi hỗ trợ dự án này, mặc định tuân theo tài liệu. Nếu một yêu cầu mới mâu thuẫn với quyết định đã chốt, phải nói rõ mâu thuẫn đó trước khi làm.

Ba mục còn chưa chốt nằm ở §22.

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

**Trong phạm vi:** Auth (local + Google OAuth), room, meeting lifecycle, audio/video/screen share, chat, presence, collaborative whiteboard, whiteboard persistence, AI sinh diagram/mindmap/flowchart, upload file, import/export dữ liệu hàng loạt, horizontal scale + load balancer, Docker, HTTPS + domain thật, benchmark.

**Ngoài phạm vi:** Mobile native app · tự huấn luyện AI model · phần mềm thiết kế đồ hoạ · **recording/egress** · transcription · breakout room · virtual background · multi-region · LiveKit multi-node · admin panel toàn hệ thống.

Recording bị loại có chủ đích: egress transcode tiêu CPU rất nặng, cạnh tranh trực tiếp với mục tiêu đo scalability của SFU. Trình bày trong báo cáo như một đánh đổi, không phải thiếu sót.

---

## 3. Ràng buộc thực tế và thứ tự hy sinh

Kiến trúc đầy đủ ước tính ~3 tháng cho 2 người. Chỉ có 2 tháng. Thứ tự cắt khi chậm tiến độ, **cắt từ dưới lên**:

```
GIỮ BẰNG MỌI GIÁ  ─ Auth, Room, Meeting, LiveKit A/V/Screen
                  ─ Socket.IO + Redis adapter (2 instance)
                  ─ Whiteboard sync + persistence
                  ─ AI generate diagram
                  ─ Import/Export members
                  ─ Deploy domain + HTTPS
                  ─ Thí nghiệm E1/E2/E3
─────────────────────────────────────────
CẮT ĐƯỢC NẾU CHẬM ─ E5 auto-scale AWS (chỉ giữ E3 thủ công)
                  ─ CO_HOST role (chỉ HOST + MEMBER + VIEWER)
                  ─ Acting host khi disconnect (để meeting treo, host vào lại)
                  ─ Export PNG/SVG (chỉ export .excalidraw JSON)
                  ─ Meeting mode LECTURE (chỉ DISCUSSION)
```

**Chia việc:** Người A = Auth/Room/Meeting/LiveKit/Deploy. Người B = Socket/Whiteboard/AI/Import-Export. Giao điểm là `shared/` — chốt contract ở đó trước khi tách việc.

---

## 4. Domain model và lifecycle

```
User
 ├── owns / joins ──► Room  (lâu dài, join code + link)
 │                     ├── RoomMember (HOST | CO_HOST | MEMBER | VIEWER)
 │                     └── has many ──► Meeting
 │                                       ├── MeetingParticipant
 │                                       ├── Message
 │                                       ├── Whiteboard (1–1)
 │                                       └── LiveKit Room (1–1, name = meetingId)
```

- **Room ≠ Meeting.** Room lâu dài, Meeting là phiên. Room chỉ mất khi host dissolve.
- **LiveKit room name = `meeting._id.toString()`.** Không tạo field riêng, tránh lệch dữ liệu.
- **Whiteboard thuộc Meeting**, quan hệ 1–1. Meeting mới có thể `cloneFrom: previousMeetingId`.
- **Một whiteboard = một canvas vô hạn**, không có nhiều page/tab.
- **Một room tối đa 1 meeting ACTIVE**, enforce bằng unique partial index.
- **Chỉ HOST/CO_HOST được `endMeeting`.** Member rời không kết thúc meeting.
- **Host disconnect:** grace 120s → CO_HOST, không có thì participant join sớm nhất thành `ACTING_HOST`. Host gốc quay lại lấy lại quyền.
- **Auto-end:** 0 participant liên tục 10 phút → ENDED, lưu snapshot cuối.
- **Chỉ HOST/CO_HOST được tạo meeting.**
- **Meeting mode** quyết định quyền theo phiên: `DISCUSSION` dùng role gốc; `LECTURE` chỉ HOST/CO_HOST được publish media và vẽ, còn lại hạ xuống VIEWER.

**Không hỗ trợ guest.** Mọi người dùng bắt buộc đăng nhập. Link join: `/join/:code` → chưa login → redirect `/login?returnUrl=...` → login xong tự resolve code và vào meeting.

Lý do (viết được vào báo cáo): mọi realtime event luôn gắn `userId` thật nên audit, presence, permission nhất quán; không cần cơ chế token ẩn danh song song nên giảm bề mặt tấn công; LiveKit token luôn sinh từ identity đã xác thực.

---

## 5. Kiến trúc và topology

```
  Browser
    ├── https://app.<domain>     → VERCEL (Next.js, CDN, HTTPS tự động)
    ├── https://api.<domain>     → NGINX (LB round-robin) ─┬─► backend-1
    │   REST + Socket.IO (WSS)                             ├─► backend-2
    │                                                      └─► backend-3
    │                                                          │
    │                                            REDIS + MONGODB (shared state)
    │
    ├── wss://livekit.<domain>   → LiveKit :7880 (signaling)
    ├── UDP 7882                 → LiveKit (media SRTP)
    └── TCP 5349                 → LiveKit TURN/TLS (fallback)
```

**Media KHÔNG đi qua NGINX.** WebRTC media là UDP/SRTP trực tiếp tới LiveKit. NGINX chỉ proxy HTTP và WebSocket.

**Backend không đặt trên Vercel.** Vercel có WebSocket từ 6/2026 nhưng vẫn beta: kết nối bị đóng khi chạm max duration (Hobby mặc định 5 phút), không sticky-route theo room, và serverless không giữ được process thường trú. Vercel chỉ host Next.js frontend. Nhờ vậy NGINX trở thành load balancer thực thụ — đúng thứ GVHD yêu cầu.

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

**Dev local bắt buộc dùng 2 hostname** (`app.localhost` / `api.localhost` trong file hosts). Nếu dev bằng `localhost` cho cả hai thì là cùng origin, vấn đề cookie cross-origin sẽ giấu mặt tới lúc deploy mới lộ.

---

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

GVHD nêu rõ: nhân bản server mà code không hỗ trợ distributed thì **việc scale vô nghĩa** — giống chép chương trình đếm số nguyên tố ra 10 máy, cả 10 máy cùng lặp lại một việc.

**Ánh xạ sang bài toán web:** với web server, "chia việc" đã do load balancer làm sẵn vì mỗi request/connection là một đơn vị độc lập. Vấn đề thật nằm ở **chia sẻ trạng thái**. Nếu instance A giữ danh sách socket trong RAM, thì 3 instance không phải là một hệ thống mạnh gấp 3 mà là 3 hệ thống rời rạc cãi nhau về sự thật.

```
Đếm số nguyên tố:  vấn đề = chia công việc
Web server:        vấn đề = chia sẻ trạng thái
```

### 7.1 Checklist stateless

| State | ❌ Sai | ✅ Đúng |
|---|---|---|
| Session đăng nhập | MemoryStore | **JWT stateless** + refresh hash trong Mongo |
| Danh sách socket theo room | `Map<roomId, Socket[]>` | **Socket.IO Redis adapter** |
| Whiteboard live state | biến global | **Redis** `wb:{meetingId}` |
| Sequence counter | `let seq = 0` | **Redis `INCR`** |
| Ring buffer op | array trong RAM | **Redis List** (LPUSH + LTRIM) |
| Presence | `Set<userId>` | **Redis Set** + TTL |
| Rate limit | counter in-memory | **Redis** (`INCR` + `EXPIRE`) |
| File upload | ghi `/tmp` local | **Object Storage** |
| Cron job | `@Cron` chạy mọi replica | **Distributed lock** |

**Quy tắc kiểm tra khi code:** *"Nếu request tiếp theo của user này rơi vào instance khác, có còn đúng không?"* Nếu không → state đang sai chỗ.

### 7.2 Socket.IO Redis adapter — bắt buộc từ ngày đầu

Không đợi tới khi chạy nhiều instance mới bật. Viết stateless từ commit đầu tiên, vì nếu code single-instance trước rồi gỡ ra sau thì phải rà toàn bộ codebase bằng tay, và việc đổi sync → async sẽ lan lên toàn bộ call chain.

### 7.3 Sticky session — không dùng

Ép `transports: ['websocket']` ở client, NGINX round-robin thuần, **không dùng `ip_hash`**.

Lý do: sticky session mâu thuẫn trực tiếp với tinh thần stateless — nó giấu vấn đề chứ không giải quyết, và khi auto-scale thu hồi instance sẽ mất kết nối hàng loạt. Rủi ro mất fallback polling được bù bằng cơ chế resync theo `seq`, nên mất kết nối không mất dữ liệu.

### 7.4 LiveKit webhook trong môi trường đa instance

Webhook chỉ tới **một** instance. Mọi side effect phải đi qua Mongo hoặc Redis, không giữ trong RAM. Socket.IO Redis adapter lo phần fan-out tới client ở instance khác. Bắt buộc **verify chữ ký webhook** — không verify thì ai cũng giả được webhook để đá người khác khỏi meeting.

### 7.5 Scheduled job

`@nestjs/schedule` chạy trên mọi replica. Job auto-end meeting phải bọc distributed lock:

```
SET lock:auto-end-meetings <instanceId> NX PX 30000
```

Giải phóng bằng Lua script kiểm tra token khớp, tránh xoá nhầm lock của instance khác. Giới hạn: chỉ một Redis nên lock là single point of failure — ghi rõ trong phần Limitations.

### 7.6 Graceful shutdown

Auto-scale sẽ thu hồi instance đang có kết nối. Cần: `GET /health` (liveness) và `GET /ready` (kiểm tra Mongo + Redis); bắt `SIGTERM` → ngừng nhận kết nối mới → emit `server:draining` → chờ ~10s → đóng; client tự reconnect sang instance khác và `wb:resync` theo `lastSeq`.

### 7.7 Không dựng integration event bus riêng

Socket.IO Redis adapter đã lo toàn bộ fan-out giữa các instance, và backend không giữ state trong RAM nên không có cache nào cần invalidate cross-instance. Thêm một message bus nữa sẽ vi phạm nguyên tắc "mỗi công nghệ phải có lý do" mà không giải quyết vấn đề nào có thật.

### 7.8 Kế hoạch chứng minh

| # | Thí nghiệm | Kỳ vọng | Ý nghĩa |
|---|---|---|---|
| **E1** | 2 instance, **tắt** Redis adapter. A ở inst-1, B ở inst-2, cùng meeting | B **không nhận được** | Chứng minh phản đề |
| **E2** | Lặp E1 với adapter **bật** | B nhận đủ, đúng thứ tự | Chứng minh code hỗ trợ distributed |
| **E3** | Load test 1 / 2 / 3 instance | Throughput tăng gần tuyến tính | Scale ngang có hiệu quả thật |
| **E4** | Kill instance giữa phiên | Client reconnect, resync, **không mất op** | Fault tolerance |
| **E5** | AWS ASG auto-scale | Instance tự thêm/bớt, không gián đoạn | Phần khuyến khích của GVHD |

E1 và E2 là cặp quan trọng nhất — chúng biến lời cảnh báo của GVHD thành kết quả thực nghiệm. Nên quay video hoặc chụp lại.

---

## 8. Bandwidth — ràng buộc quyết định mục tiêu

```
Server egress ≈ N × (N − 1) × bitrate_per_stream
```

| N bật cam | 720p @1.5 Mbps | 360p @0.5 Mbps |
|---|---|---|
| 6 | ~45 Mbps | ~15 Mbps |
| 10 | ~135 Mbps | ~45 Mbps |
| 20 | ~570 Mbps | ~190 Mbps |

Meeting 10 người ở 360p tiêu **~20 GB egress mỗi giờ**. Hệ thống có thể chết vì network trước khi chết vì CPU — đây là phát hiện phải nêu trong báo cáo.

**Bật ngay từ đầu, không để tối ưu sau:** simulcast, dynacast, adaptive stream, giới hạn resolution theo layout (grid ≥5 người → 180p/360p; speaker view → 720p), chỉ subscribe video của tile trong viewport (paginate 9 tile/trang), audio-only mode cho meeting đông.

**Mục tiêu participant:**

| Kịch bản | Mục tiêu |
|---|---|
| Video 360p + audio, tất cả publish | **8–12 participant** |
| 1 người screen share + còn lại subscribe | **20–30 participant** |
| Audio-only | **20–30 participant** |

Đây là **mục tiêu thiết kế, chưa phải kết quả**. Phải xác nhận bằng benchmark. Nếu thực đo thấp hơn thì báo cáo ghi số thực đo kèm phân tích điểm nghẽn — điều đó có giá trị học thuật cao hơn một con số đẹp không kiểm chứng được.

---

## 9. Realtime contract (Socket.IO)

Socket.IO **chỉ** cho application data. Không bao giờ audio/video/screen.

**Namespace** `/meeting` · **Room** `meeting:${meetingId}` · **Transport** `['websocket']` only

**Auth:** JWT qua `socket.handshake.auth.token`, **không qua query string** (query bị log ở proxy). Verify trong guard → resolve `userId` → check membership + meeting ACTIVE → mới cho join room.

**Envelope chuẩn cho mọi event server → client:**

```jsonc
{
  "v": 1,                  // version schema event
  "seq": 1234,             // null với event ephemeral (cursor, typing)
  "ts": "2026-09-13T10:00:00.000Z",
  "actorId": "665f...",
  "meetingId": "665e...",
  "data": { }
}
```

**Event catalog:**

| Client → Server | Payload |
|---|---|
| `meeting:join` | `{ meetingId, lastSeq? }` |
| `chat:send` | `{ clientMsgId, content, fileId? }` |
| `wb:ops` | `{ elements[] }` |
| `wb:pointer` | `{ x, y }` |
| `wb:resync` | `{ lastSeq }` |
| `ai:generate` | `{ requestId, prompt, kind }` |

| Server → Client | Payload |
|---|---|
| `meeting:snapshot` | `{ elements[], seq, members[], recentMessages[] }` |
| `meeting:member_changed` | `{ userId, action, role }` |
| `meeting:ended` | `{ reason }` |
| `chat:new` | `{ message }` |
| `wb:ops` | `{ elements[], byUserId }` |
| `wb:pointer` | `{ userId, x, y }` |
| `ai:status` / `ai:result` | `{ requestId, ... }` |
| `server:draining` | `{}` |
| `error` | `{ statusCode, error, message, details? }` |

**Ordering, duplicate, reconnection:**
- `seq` đơn điệu tăng, cấp bằng **Redis `INCR`** → atomic across instances, tự nhiên có total order
- **Ring buffer 500 op gần nhất** trong Redis List
- Client reconnect gửi `lastSeq`: chênh ≤ 500 → **replay diff**; ngược lại → **full snapshot**
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

Không dùng CRDT/Yjs. Lý do cho báo cáo: xung đột thực tế (2 người sửa **cùng 1 element** trong vài trăm ms) rất hiếm trong học nhóm; CRDT thêm runtime + awareness + persistence riêng, khó test và khó trình bày; LWW là mô hình chính thức của Excalidraw. Trình bày CRDT như alternative và limitation.

**Luồng:**

```
Excalidraw onChange (debounce ~150ms)
 → diff element có version thay đổi
 → emit wb:ops (batch, KHÔNG gửi toàn bộ scene)
 → Backend: validate + permission + Redis INCR seq
 → merge LWW vào Redis live state
 → broadcast qua Redis adapter tới MỌI instance
 → client khác reconcile + updateScene()
```

- **Cursor đi kênh riêng**, throttle 50ms, không lưu, không tăng `seq`.
- **Echo loop:** client nhận op của chính mình → `updateScene` → `onChange` → gửi lại. Chặn bằng cờ `isApplyingRemote`.
- **Clear board** = set `isDeleted` cho tất cả, không phải xoá mảng.
- **Freedraw** có hàng nghìn point → giới hạn kích thước payload.
- Hàm merge nằm ở `shared/`, **client và server dùng chung một bản**. Không viết hai bản.

---

## 11. Persistence

| Tầng | Nơi lưu | Mục đích |
|---|---|---|
| Live state | Redis `wb:{meetingId}` | Nguồn đọc snapshot khi join |
| Persisted snapshot | Mongo `whiteboards` | Khôi phục sau restart |
| Historical | Mongo, gắn meeting ENDED | Review sau meeting |

**Không ghi Mongo mỗi op.** Debounce 15s sau thay đổi cuối; ép ghi mỗi 60s nếu thay đổi liên tục; ghi ngay khi `endMeeting`, participant cuối rời, hoặc graceful shutdown.

Đánh đổi cho báo cáo: đổi write amplification lấy RPO ~15–60s. Chấp nhận được với ngữ cảnh học nhóm.

**Ràng buộc 16 MB/document:** elements lưu dạng `gzip(JSON)` → `Buffer`. Hard limit **5.000 element/board**, vượt thì báo lỗi rõ ràng. Nêu ở phần Limitations.

**Guard chống ghi đè ngược** — bắt buộc khi nhiều instance cùng persist:

```js
updateOne(
  { meetingId, lastSeq: { $lt: incomingSeq } },
  { $set: { elementsGzip, elementCount, lastSeq: incomingSeq, lastPersistedAt } },
  { upsert: true },
)
```

---

## 12. AI pipeline

**Kiến trúc 3 lớp.** LLM sinh toạ độ rất tệ — nếu bắt model trả thẳng element Excalidraw kèm `x, y, width, height` và arrow binding thì kết quả chồng chéo, mũi tên lệch, trông như bug. Phải tách sinh **cấu trúc** khỏi tính **vị trí**.

```
User prompt
 → AiService
 → LLM (JSON mode) ── trả DSL: CHỈ nodes + edges, KHÔNG toạ độ
 → Validate schema (Zod)
 → Layout engine (elkjs) → tính x, y, w, h
 → convertToExcalidrawElements() → gán version/versionNonce hợp lệ
 → Redis INCR seq, merge live state
 → broadcast qua Redis adapter
```

**DSL trung gian:**

```jsonc
{
  "kind": "flowchart",        // flowchart | mindmap | diagram
  "direction": "TB",
  "nodes": [ { "id": "n1", "label": "Bắt đầu", "shape": "ellipse" } ],
  "edges": [ { "from": "n1", "to": "n2", "label": "" } ]
}
```

Ràng buộc validate: `nodes ≤ 40`, `label ≤ 80 ký tự`, mọi `edge.from/to` phải tồn tại, `id` unique, không node mồ côi.

**Điểm dễ hỏng nhất:** element do layout engine sinh ra **bắt buộc mang `version` và `versionNonce` hợp lệ**. Nếu sinh element "sạch" không có hai field này thì sẽ merge sai hoặc không sync sang client khác.

**Xử lý lỗi:**

| Rủi ro | Xử lý |
|---|---|
| JSON hỏng | JSON mode + retry **đúng 1 lần**; lần 2 fail → báo user |
| Timeout | 30s → `ai:status: failed` |
| Prompt injection | System prompt cố định ở backend; user input là **data**, không nối vào phần instruction |
| Spam / chi phí | Rate limit **trong Redis**: 5 req/user/phút, 20 req/meeting/giờ |
| Đè lên board | Đặt content vào vùng trống bên phải bounding box hiện tại |
| Lộ API key | Chỉ ở backend env |

AI content là element bình thường — user sửa/xoá/di chuyển như mọi element khác.

---

## 13. Import / Export (GVHD)

GVHD: *"các chức năng quản lý dữ liệu hàng loạt phải có cơ chế import/export, trong dialog import phải ghi rõ định dạng cần import, và khi chọn file xong phải có giao diện review trước khi xác nhận."*

| Entity | Import | Export | Định dạng |
|---|:--:|:--:|---|
| **Room members** | ✅ | ✅ | CSV / XLSX |
| Chat history | ❌ | ✅ | CSV / JSON |
| Meeting history | ❌ | ✅ | CSV / XLSX |
| Whiteboard | ✅ | ✅ | `.excalidraw` / PNG / SVG |

(Không có import users vì không có role admin hệ thống.)

**Luồng import 4 bước, không được rút gọn:**

```
Bước 1 — Dialog mô tả format
   • Bảng liệt kê từng cột: tên, bắt buộc/tuỳ chọn, kiểu, ví dụ, ràng buộc
   • Nút "Tải file mẫu" (.xlsx có header + 2 dòng ví dụ)
   • Ghi rõ giới hạn số dòng, kích thước file, encoding UTF-8
   ↓
Bước 2 — Chọn file: kiểm tra ngay đuôi file, MIME, kích thước
   ↓
Bước 3 — MÀN HÌNH REVIEW  ← bắt buộc
   • Bảng preview toàn bộ dòng đã parse
   • Tô đỏ dòng lỗi + ghi rõ lỗi ngay tại dòng
   • Tổng kết: X hợp lệ / Y lỗi / Z trùng
   • Cho phép bỏ chọn từng dòng
   • Nút "Tải file lỗi" để sửa rồi import lại
   ↓
Bước 4 — Xác nhận: chỉ import dòng hợp lệ đã chọn, báo cáo kết quả
```

**Đặc tả cột import Room members:**

| Cột | Bắt buộc | Kiểu | Ví dụ | Ràng buộc |
|---|:--:|---|---|---|
| `email` | ✅ | text | `sv001@st.tdtu.edu.vn` | email hợp lệ, tồn tại trong hệ thống |
| `role` | ❌ | enum | `MEMBER` | `MEMBER`\|`CO_HOST`\|`VIEWER`, mặc định `MEMBER` |
| `display_name` | ❌ | text | `Nguyễn Văn A` | ≤ 60 ký tự |

**Quy tắc kỹ thuật:**
- Validate hai lớp: frontend để UX nhanh, **backend validate lại toàn bộ** — frontend không phải lớp bảo mật
- Giới hạn **500 dòng/lần**, xử lý đồng bộ, không cần job queue
- **Idempotent:** email đã có → "đã tồn tại, bỏ qua", không tạo trùng, không lỗi toàn bộ
- **Partial success:** 100 dòng có 3 lỗi → nhận 97, báo cáo 3
- **File tạm KHÔNG ghi disk local** — parse trong memory hoặc đẩy object storage
- Export phải tôn trọng permission

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

| Hành động | HOST | CO_HOST | MEMBER | VIEWER |
|---|:--:|:--:|:--:|:--:|
| Dissolve room | ✅ | ❌ | ❌ | ❌ |
| Đổi role | ✅ | ❌ | ❌ | ❌ |
| Quản lý / kick member | ✅ | ✅ | ❌ | ❌ |
| Import members / Export | ✅ | ✅ | ❌ | ❌ |
| Tạo / kết thúc meeting | ✅ | ✅ | ❌ | ❌ |
| Publish media, screen share | ✅ | ✅ | ✅¹ | ❌ |
| Chat | ✅ | ✅ | ✅ | ✅ |
| Vẽ whiteboard | ✅ | ✅ | ✅¹ | ❌ |
| Xoá element người khác / clear board | ✅ | ✅ | ❌ | ❌ |
| Gọi AI generate | ✅ | ✅ | ✅¹ | ❌ |
| Upload file | ✅ | ✅ | ✅¹ | ❌ |

¹ Ở `LECTURE` mode, MEMBER bị hạ xuống quyền VIEWER cho các mục này.

Permission được biểu diễn dưới dạng **dữ liệu** (bảng tra) trong `shared/`, không phải chuỗi if-else, dùng chung cho backend và frontend.

**Role map thẳng sang LiveKit token grant** (`canPublish: false` cho VIEWER) → quyền media enforce ngay ở SFU, không chỉ ẩn nút ở UI. Token TTL 6 giờ, cấp lại mỗi lần join meeting.

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

| # | Kịch bản | Biến |
|---|---|---|
| B1 | N publisher video+audio, all subscribe | N = 2,4,6,8,10,12 |
| B2 | 1 screen share + N subscriber | N = 5,10,20,30 |
| B3 | Audio-only | N = 10,20,30 |
| B4 | Join/leave churn 20% mỗi 30s | N = 10 |
| B5 | Whiteboard concurrent | 5 / 10 client vẽ liên tục 3 phút |
| B6 | Reconnect sau ngắt mạng 10s | |

Metric: join success rate, join latency p50/p95, CPU %, RAM, network in/out, packet loss, jitter, whiteboard op latency p95, event loss sau reconnect.

**Mọi con số trong báo cáo phải đo thực tế.** Không lấy số trong docs của LiveKit làm số của mình. Mỗi kịch bản chạy ≥ 3 lần, báo cáo trung bình + độ lệch.

---

## 18. Deployment và ngân sách

| Thành phần | Nơi chạy | Chi phí |
|---|---|---|
| Frontend (Next.js) | **Vercel Hobby** | Miễn phí, HTTPS + CDN + custom domain |
| Backend ×2–3 + NGINX LB | VPS / cloud VM | xem dưới |
| LiveKit SFU + TURN | cùng VPS | |
| MongoDB | Atlas M0 free (512 MB) hoặc self-host | Miễn phí |
| Redis, MinIO | self-host container | Miễn phí |
| Object storage prod | Cloudflare R2 free (10 GB) | Miễn phí |
| Domain `.site` / `.cloud` | hostinger.vn | ~1 USD/năm |
| TLS | Let's Encrypt + Vercel tự lo | Miễn phí |

**Yếu tố quyết định là egress, không phải CPU.**

| Phương án | Egress miễn phí | Nhận xét |
|---|---|---|
| Oracle Cloud Always Free (2 OCPU / 12 GB ARM) | rất rộng (mức TB/tháng) | Tốt nhất về giá. Rủi ro: hay hết capacity ARM, chính sách đổi không báo trước |
| AWS EC2 | **chỉ 100 GB/tháng** | ⚠️ ≈ **5 giờ** meeting 10 người. Không làm host chính cho SFU |
| VPS giá rẻ | vài TB/tháng | Ổn định nhất |

**Chiến lược lai:** host chính (Oracle Always Free hoặc VPS rẻ) chạy backend ×2 + NGINX LB + Redis + LiveKit, là môi trường demo và benchmark. **AWS chỉ dùng cho E5** — dựng ALB + Auto Scaling Group cho **backend** (không phải SFU), chạy ngắn hạn bằng credit, ghi lại kết quả rồi tắt.

**Không để buổi bảo vệ phụ thuộc vào free tier.** Trước bảo vệ ít nhất 2 tuần, chuyển sang VPS trả phí (~5 USD/tháng). Rủi ro Oracle thu hồi instance hoặc AWS đóng tài khoản khi hết credit là có thật và không kiểm soát được.

**Docker Compose:** `nginx` (LB + TLS) · `backend-1/2/3` (cùng image) · `redis` · `mongodb` · `livekit` (`network_mode: host`) · tuỳ chọn prometheus/grafana/node-exporter/cadvisor.

**CI/CD:** GitHub Actions — lint → test → build image → deploy qua SSH. Frontend Vercel tự deploy khi push.

---

## 19. Stack và cấu trúc code

### 19.1 Version chốt

| | Version |
|---|---|
| NestJS | 12 |
| Mongoose | 9 |
| TypeScript | 6 |
| Next.js | 15 (App Router) |
| Module system | **ESM** (`"type": "module"`, `moduleResolution: nodenext`) |
| Package manager | **pnpm** workspace |
| Password hash | **bcryptjs** |
| AI provider | **Gemini** (sau `AiProvider` interface) |
| Layout engine | **elkjs** |
| Object storage | MinIO (dev) → Cloudflare R2 (prod) |
| Test | vitest |
| Lint | oxlint + prettier |

**ESM:** mọi import tương đối **phải có đuôi `.js`** (`'./auth.service.js'`). Đây là quy tắc bắt buộc, dễ quên. Cần test sớm `@socket.io/redis-adapter` và `@nestjs/schedule` dưới ESM trong giai đoạn spike.

### 19.2 Cấu trúc thư mục

```
DATN2627/
├── shared/                      contract dùng chung FE/BE
│   └── src/{enums, events, permissions, whiteboard, errors}
├── backend/
│   └── src/
│       ├── config/              env.schema.ts (Zod fail-fast)
│       ├── database/            mongoose connection
│       ├── common/
│       │   ├── filters/         http + ws exception filter
│       │   ├── interceptors/    transform (_id→id), logging (instanceId)
│       │   ├── guards/ decorators/ pipes/ middleware/ utils/
│       │   └── redis/           RedisService + DistributedLockService
│       └── modules/
│           ├── auth/            {dto, guards, strategies}
│           ├── users/           {schemas}
│           ├── rooms/           {dto, schemas}
│           ├── room-members/    {dto, schemas}
│           ├── meetings/        {dto, schemas}  + LiveKit adapter
│           ├── whiteboard/      {dto, gateway, services, schemas}
│           ├── chat/            {dto, schemas}
│           ├── ai-assistant/    {dto, providers, services, schemas}
│           ├── files/           {dto, schemas}
│           ├── realtime/        {gateways, adapters, dto}
│           └── health/          liveness + readiness cho LB/ASG
├── frontend/
│   ├── app/                     App Router
│   └── src/{features, components, hooks, services, stores, lib, types}
└── infrastructure/{docker, nginx, livekit, redis}
```

**Quy ước:**
- `shared/` là nơi duy nhất định nghĩa enum, event envelope, permission matrix, `lww-merge`. Không copy thủ công sang hai phía.
- Mọi emit ra socket đi qua một publisher duy nhất, không gọi `server.to()` rải rác — để gắn envelope nhất quán và sau này thêm logging/metrics chỉ sửa một chỗ.
- Module nào có hệ ngoài phía sau (LiveKit, Gemini, storage) thì tách `ports/` + `adapters/`, đặt tên theo **năng lực** không theo vendor (`media` không phải `livekit`).
- Module CRUD thuần giữ layered đơn giản: controller → service → schema.

### 19.3 Database

9 collection: `users` · `refresh_tokens` · `rooms` · `room_members` · `meetings` · `meeting_participants` · `messages` · `whiteboards` · `files`.

**Nguyên tắc đã áp dụng:**
- Không embed mảng không giới hạn → `messages`, `room_members`, `meeting_participants` là collection riêng
- Embed mảng có giới hạn → `meeting_participants.sessions[]`
- Denormalize snapshot → `messages.senderName` giữ tên tại thời điểm gửi, tránh populate N+1
- Counter thay đổi liên tục **không** để trong Mongo → số người online ở Redis; Mongo chỉ nhận `peakParticipants` một lần khi meeting kết thúc
- Không lưu file vào Mongo, chỉ metadata trỏ object storage

**Bốn ràng buộc nghiệp vụ đẩy xuống tầng DB** — thay thế hàng chục dòng application logic và vẫn đúng khi chạy nhiều instance:

| Index | Tác dụng |
|---|---|
| `meetings {roomId}` unique + partial `{status: ACTIVE}` | 1 room chỉ 1 meeting đang chạy |
| `messages {meetingId, clientMsgId}` unique | chống gửi trùng khi reconnect |
| `room_members {roomId, userId}` unique | import member idempotent |
| `whiteboards.lastSeq` + update có điều kiện | chống ghi đè ngược khi đa instance |

`refresh_tokens` có **TTL index** trên `expiresAt` → Mongo tự dọn, không cần cron.

**Quy tắc khai báo index:** `unique` và single-field khai ở `@Prop`; chỉ dùng `Schema.index()` cho compound, partial và TTL. Khai cả hai chỗ sẽ sinh duplicate index warning.

Chi tiết đầy đủ ở `DB_DESIGN.md`.

---

## 20. Trạng thái bàn giao

### Đã xong

| Hạng mục | Ghi chú |
|---|---|
| `shared/` package | enum, event envelope, permission matrix, `lww-merge` — **14/14 test pass** |
| Config Zod fail-fast | |
| RedisService + DistributedLockService | |
| Exception filter (http + ws), transform & logging interceptor | |
| 9 schema + script `verify-schema` | 6 assertion kiểm tra 4 ràng buộc DB |
| docker-compose.dev | mongo + redis + minio |
| **Auth module** | local + **Google OAuth** + account linking, Passport strategies, DTO validate |
| Cấu trúc thư mục 10 module + infrastructure | |

Auth và cấu trúc thư mục do đồng đội làm ở nhánh riêng, **lấy làm chuẩn cho toàn dự án**.

### Việc merge còn lại

1. Khai báo bổ sung dependency đang thiếu ở `backend/package.json`: `@nestjs/config`, `class-validator`, `class-transformer`, `bcryptjs`. Hiện chạy được nhờ npm hoist phẳng (phantom dependency), chuyển sang pnpm strict sẽ vỡ.
2. Thêm **refresh token rotation** — hiện chỉ có một JWT sống 7 ngày, không logout được, không revoke được.
3. Sửa **Google callback** không trả token qua query string.
4. Thay fallback im lặng `process.env.MONGO_URI ?? 'mongodb://localhost...'` bằng `env.schema.ts`. Trên production, thiếu biến sẽ lặng lẽ kết nối nhầm DB.
5. Bê `shared/` + `common/redis` + filters/interceptors sang, chuyển `shared/` từ CJS sang ESM.
6. Hoà giải schema `User`: giữ `username`, `providers[]`, `googleId` của đồng đội; bổ sung `displayName`, `lastLoginAt`; đổi `avatar` → `avatarUrl` cho khớp phần còn lại. Tám schema kia bê thẳng.
7. Chuyển `backend/` và `frontend/` từ npm sang pnpm workspace.

### Lộ trình còn lại

```
Giai đoạn 0 (spike, ưu tiên cao nhất)
   domain + VPS + HTTPS → LiveKit + TURN → 3 máy ở 3 mạng khác nhau gọi được nhau
   → 2 backend instance + Redis adapter: 2 tab ở 2 instance chat được với nhau
Giai đoạn 1   Room, RoomMember, Meeting lifecycle
Giai đoạn 2   LiveKit integration (token theo role, webhook) → Socket.IO gateway
              → presence → chat → observability → E1/E2
Giai đoạn 3   Excalidraw → LWW sync + seq → resync → persistence
Giai đoạn 4   AI: DSL → validate → elkjs layout → merge
Giai đoạn 5   Import/Export (export trước, import sau)
Giai đoạn 6   Distributed lock cho cron → graceful shutdown → E3/E4 → benchmark B1–B6 → E5
Giai đoạn 7   Docker đầy đủ → NGINX production → CI/CD → báo cáo
```

Hai điểm chết người trong Giai đoạn 0: **3 máy ở 3 mạng khác nhau gọi được nhau**, và **2 instance chat được với nhau**. Nếu một trong hai fail thì mọi thứ phía sau vô nghĩa — phải biết trong tuần đầu.

---

## 21. Bẫy đã gặp và cách xử lý


## 22. Ba mục chưa chốt

Đây là toàn bộ phần còn mở. Mọi thứ khác trong tài liệu đã quyết.

1. **Host chính:** Oracle Always Free hay VPS trả phí. Quyết trước Giai đoạn 0 vì spike cần môi trường thật.
2. **Số backend instance mục tiêu:** sẽ linh động và chỉnh sửa sau cho phù hợp
3. **Có scheduled meeting (đặt lịch trước) không.** Nếu có thì `meetings` cần thêm `scheduledAt` và trạng thái `SCHEDULED`. làm sau nếu còn thời gian.

---

## 23. Nguyên tắc làm việc

**P1 — Không over-engineer.** `Correctness → Understandability → Testability → Scalability đúng phạm vi → Performance`

**P2 — Tách media và application realtime.** Media qua LiveKit. Application data qua Socket.IO. Không trộn.

**P3 — Backend là nơi enforce.** Client không tự quyết permission. Frontend chỉ ẩn/hiện UI.

**P4 — AI output phải có schema.** Validate → parse → normalize → transform. LLM là untrusted input.

**P5 — Thiết kế cho nhiều user.** Mọi tính năng realtime phải trả lời được: "Điều gì xảy ra nếu 2, 10, 20 user cùng làm hành động này?"

**P6 — Mỗi công nghệ phải có lý do.** Redis adapter, distributed lock, object storage có lý do rõ ràng: horizontal scale là yêu cầu bắt buộc. Nhưng không thêm message queue, microservice, service mesh nếu chưa có nhu cầu thật.

**P7 — Đo được và giải thích được.** Tính năng chưa có cách đo và chưa giải thích được đánh đổi thì chưa xong.

**P8 — Một nguồn sự thật cho mỗi loại dữ liệu.** Xem §6.

**P9 — Stateless backend.** Trước khi commit bất kỳ đoạn code nào giữ state: *"Nếu request tiếp theo của user này rơi vào instance khác, có còn đúng không?"*

**P10 — Validate mọi input.** REST, WebSocket, file import, AI response, webhook, env. Không ngoại lệ.

---

## 24. Định nghĩa hoàn thành

Nhiều user thực hiện trọn vẹn:

```
Login (local hoặc Google) → Create/Join Room → Create/Join Meeting
  → Audio + Video → Screen Share → Chat → Upload file
  → Collaborative Whiteboard
  → AI generate diagram/mindmap/flowchart → Edit together
  → Import/Export members
  → Persist → End Meeting → Review
```

Và hệ thống:

- Chạy bằng Docker Compose
- Deploy trên hosting thật, **có domain riêng + HTTPS** (GVHD)
- Có TURN, kết nối được từ mạng chặn UDP
- **Chạy ≥2 backend instance sau load balancer, đồng bộ đúng giữa các instance** (GVHD)
- **Chứng minh bằng thí nghiệm rằng scale không có code distributed thì vô nghĩa (E1 vs E2)** (GVHD)
- Có import/export với dialog mô tả format và màn hình review (GVHD)
- Input validation ở mọi entry point (GVHD)
- Persistence và realtime sync ổn định qua reconnect và qua chuyển instance
- **Có số liệu benchmark đo thực tế** khi tăng participant và khi tăng số instance
- Mọi lựa chọn kỹ thuật giải thích được trong báo cáo
