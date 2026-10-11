# Module Meeting + LiveKit — spec (Task 0)

Ngày chốt: 2026-10-05. Plan: `meeting_module_plan.md` (cùng thư mục, viết sau khi spec được duyệt).

**Nguồn:** đề cương §3.2, §5.5, §6.1, §6.3, §6.6, §8 · `docs/rule/role.md` · PROJECT_CONTEXT §4, §5, §6, §7.4, §7.5, §9, §14, §15 · `docs/architecture/webrtc.md` · ADR-001, ADR-002, ADR-004, ADR-008, ADR-018, ADR-019, ADR-020.

**Mục tiêu module:** HOST bắt đầu / kết thúc buổi học, backend cấp token LiveKit, thành viên vào được cuộc gọi audio / video / chia sẻ màn hình (đề cương §5.5, §6.3). Đây là trụ cột 1 (SFU) — phần rủi ro hạ tầng cao nhất nên làm trước whiteboard / AI (hai module đó cần `meetingId`).

---

## 1. Câu hỏi mở — đã chốt

| # | Câu hỏi | Chốt | Lý do |
|---|---|---|---|
| 1 | `ACTING_HOST` trong `architecture.md` §6 ("host disconnect: grace 120s, participant sớm nhất thành ACTING_HOST") | **Bỏ**, sửa lại `architecture.md`. HOST rời call thì meeting vẫn chạy; trống thì tự kết thúc (câu 5). | Trái ADR-020 (mỗi room 1 HOST cố định, không chuyển host), `role.md` (chỉ host + member), commit `6fc3663` (bỏ CO_HOST). Đề cương không có. User chốt 2026-10-04. |
| 2 | Bị kick / tự rời phòng khi meeting đang diễn ra | **Đưa ra khỏi call** (`removeParticipant`) + webhook `participant_joined` kiểm lại membership, người không còn là thành viên vào lại bằng token cũ thì bị đưa ra ngay. | LiveKit **tự host không thu hồi token** khi `RemoveParticipant` (docs LiveKit: chỉ bản Cloud thu hồi). Token TTL 6h giữ nguyên như `webrtc.md`. User chốt 2026-10-04. |
| 3 | TURN | **Để bước deploy.** Module này chỉ dựng LiveKit dev trên localhost (UDP 7882 + TCP 7881). | TURN/TLS (5349) cần domain + chứng chỉ thật; trình duyệt từ chối TURN/TLS với cert tự ký. Chưa chứng minh được "mạng chặn UDP" ở module này. User chốt 2026-10-04. |
| 4 | Dependency mới | **Đồng ý 4 package:** backend `livekit-server-sdk`; frontend `livekit-client`, `@livekit/components-react`, `@livekit/components-styles`. | CLAUDE.md: dependency mới phải hỏi. User chốt 2026-10-04. |
| 5 | Tự kết thúc meeting khi trống 3 phút | **Timeout có sẵn của LiveKit + webhook `room_finished`** (không cron, không distributed lock), kèm các đường tự hồi phục ở §9. ADR-022. `[phát sinh kỹ thuật]` | Lệch PROJECT_CONTEXT §7.5 (job cron + lock). Ít code nhất mà vẫn đúng đa instance (webhook tới 1 instance, side effect nằm trong Mongo — §7.4). Đề cương §6.6 chỉ nói "chủ phòng thực hiện kết thúc phiên"; tự kết thúc là phát sinh kỹ thuật để meeting không treo ACTIVE mãi. User chốt 2026-10-04. |
| 6 | ADR ghi ở đâu | **`docs/decisions.md`** (nối tiếp ADR-021). Sửa dòng 3 bảng "Nguồn sự thật" trong `CLAUDE.md` (đang trỏ `docs/adr/*.md` — thư mục không tồn tại) về `docs/decisions.md`. | CLAUDE.md tự mâu thuẫn: bảng nguồn ghi `docs/adr/`, mục "Sau mỗi task" ghi `docs/decisions.md`; repo chỉ có `decisions.md` chứa ADR-001..021. User chốt 2026-10-04. |
| 7 | Grant LiveKit theo role (§15 "role map thẳng sang token grant") | **Một hằng số `MEMBER_GRANT` trong adapter**, không làm bảng theo role, không sửa `shared/permissions.ts`. | HOST và MEMBER có grant giống hệt nhau (`role.md`: cả hai publish media / screen share). Bảng theo role không mang thông tin gì và trái quy ước room spec §3.3 ("media: mọi thành viên, không đưa vào bảng"). Khi có role VIEWER (`role.md` mục MỞ RỘNG — ngoài scope) mới cần bảng. |
| 8 | Đỉnh số người (`peakParticipants`) | **Ghi thẳng Mongo bằng `$max`** mỗi lần có người vào; bỏ key Redis `presence:peak:{meetingId}`. `[phát sinh kỹ thuật]` | `$max` atomic, không cần Lua script trong Redis. Số người đang online vẫn ở Redis; Mongo chỉ ghi thêm khi có người vào — cùng tần suất với lần ghi session vốn đã có. |
| 9 | Chế độ chỉ nghe (audio-only, `webrtc.md` §5) | **Hoãn tới bước benchmark.** | Cần số đo B1/B3 để quyết ngưỡng và cách bật. Lệch câu "bật ngay từ đầu" của §5 — ghi rõ. User chốt 2026-10-05. |
| 10 | `docs/task/` bị `.gitignore` | **Bỏ dòng `docs/task` khỏi `.gitignore`, commit toàn bộ `docs/task/`** cùng spec này. | Spec/plan phải truy vết được trong git. User chốt 2026-10-05. |

---

## 2. Phạm vi

**Trong module này:**
- Container LiveKit trong `docker-compose.yml` (dev).
- Backend: bắt đầu meeting, lịch sử meeting của room, vào meeting (cấp token), kết thúc meeting, webhook LiveKit. Giải tán phòng → kết thúc meeting. Kick / rời phòng → đưa ra khỏi call.
- Frontend: khu "Buổi học" ở trang room (bắt đầu / tham gia / kết thúc / lịch sử) + trang `/meetings/[meetingId]` (cuộc gọi).
- Sửa tài liệu (§15).

**Không làm ở module này (đã có chỗ ở bước sau):**
- Socket event `meeting:ended`, `meeting:member_changed`, `meeting:snapshot` → bước **Realtime gateway**. Tạm thời người đang trong call biết meeting kết thúc nhờ LiveKit ngắt kết nối (`ROOM_DELETED`); trang room chưa tự cập nhật, phải tải lại.
  - ⇒ Đề cương §6.6 *"các thành viên nhận được thông báo về việc kết thúc phiên học"* ở module này **chỉ đáp ứng cho người đang trong call**. Người đang ở trang room chờ bước gateway.
- Tạo / clone whiteboard khi bắt đầu meeting; lưu board khi kết thúc (đề cương §6.6) → module whiteboard.
- `messageCount` giữ 0 tới khi có chat.
- TURN → bước deploy (câu 3).
- Audio-only → bước benchmark (câu 9).
- API xem danh sách người tham gia từng meeting cũ — lịch sử chỉ hiện số liệu thống kê.
- Phân trang lịch sử meeting ở frontend (hiện 20 buổi gần nhất).

---

## 3. Hạ tầng dev

### 3.1 LiveKit trong Docker Compose
- Service `livekit`, image `livekit/livekit-server` **ghim phiên bản** (chọn ở Task 1, điều kiện: webhook `room_finished` có field `roomEndReason` — §7.2).
- Config `infrastructure/livekit/livekit.yaml` (thư mục `infrastructure/livekit` theo `architecture.md` §4):

| Khoá | Giá trị | Ghi chú |
|---|---|---|
| `port` | `7880` | HTTP / WS signaling |
| `rtc.tcp_port` | `7881` | ICE/TCP fallback |
| `rtc.udp_port` | `7882` | single-port UDP mux (PROJECT_CONTEXT §5) |
| `rtc.use_external_ip` | `false` | |
| `rtc.node_ip` | `127.0.0.1` | dev trên Docker Desktop Windows — **không** dùng được `network_mode: host` như lúc deploy Linux |
| `room.auto_create` | `false` | chỉ backend tạo được room — token còn hạn (6h) kết nối lại sau khi meeting kết thúc không sinh room "ma" |
| `webhook.api_key` | = `LIVEKIT_API_KEY` | khoá dùng để ký webhook |
| `webhook.urls` | `[http://host.docker.internal:3001/webhooks/livekit]` | **một URL cho cả hai chế độ chạy backend** (§3.4) — không dùng `backend:3001` |
| keys | `LIVEKIT_API_KEY: LIVEKIT_API_SECRET` | cách khai báo một chỗ — chốt ở Task 1 (§3.3) |

- Map port: `7880:7880`, `7881:7881`, `7882:7882/udp`.

### 3.2 Biến môi trường backend
- `docker-compose.yml` dòng 44: **sửa** `LIVEKIT_URL: ws://livekit:7880` → `http://livekit:7880` (mục `environment:` đè `env_file`; giữ ở đây giống `MONGO_URI`, `REDIS_URL` vì là địa chỉ nội bộ compose).
- `backend/.env` (giá trị khi chạy native): `LIVEKIT_URL=http://localhost:7880` (đang là `ws://localhost:7880`), **thêm** `LIVEKIT_PUBLIC_URL=ws://localhost:7880`. `.env.example` thêm đủ các biến dưới.
- **Dùng lại 2 biến đã có** trong `.env`: `LIVEKIT_TOKEN_TTL_HOURS=6`, `MEETING_AUTO_END_AFTER_MIN=3`. Không đặt hằng số mới.
- **Zod kiểm lúc khởi động** (ràng buộc 3, PROJECT_CONTEXT §14 "Env — Zod fail-fast"), schema nằm trong adapter vì chỉ adapter dùng:

| Biến | Ràng buộc | Dùng cho |
|---|---|---|
| `LIVEKIT_URL` | URL | gọi API LiveKit (nội bộ) |
| `LIVEKIT_PUBLIC_URL` | URL | trả cho trình duyệt |
| `LIVEKIT_API_KEY` | không rỗng | ký token, verify webhook |
| `LIVEKIT_API_SECRET` | ≥ 32 ký tự | ký token, verify webhook |
| `LIVEKIT_TOKEN_TTL_HOURS` | số nguyên 1–24 | TTL token |
| `MEETING_AUTO_END_AFTER_MIN` | số nguyên 1–60 | `emptyTimeout` = `departureTimeout` = giá trị × 60 giây |

Thiếu / sai → app không khởi động. (Schema env toàn app `config/env.schema.ts` trong `architecture.md` §4 chưa làm — ngoài phạm vi.)

**Kiểm lúc nào:** trong **constructor của adapter** — lúc Nest tạo provider khi app khởi động, **không** ở top-level của file (không chạy lúc import).
- Adapter export `livekitEnvSchema` và `computeEndedAt` như giá trị thuần → import file không đọc `process.env`, không kiểm gì.
- Test Zod gọi `livekitEnvSchema.safeParse({...})` với object tự dựng; test service dùng MediaPort giả, không bao giờ tạo adapter.
- ⇒ `npm test` trên máy không có biến LiveKit vẫn pass. Chỉ `npm run start:dev` / container fail khi thiếu biến — đúng fail-fast mong muốn.

### 3.3 Task 1 — chạy LiveKit thật trước khi viết code nghiệp vụ
Task đầu tiên của plan, để lỗi ICE / port lộ ra ngay:
1. Chọn + ghim phiên bản LiveKit; chốt cách khai báo key/secret **một chỗ** (`backend/.env`) cho cả backend và LiveKit.
2. Vào thử bằng token tạo tay (2 trình duyệt cùng máy) — thấy / nghe nhau.
3. Webhook tới backend, verify chữ ký được (raw body — §4.4) — **cả hai chế độ**: backend container và backend native (`npm run start:dev`), cùng URL `host.docker.internal:3001` (§3.4).
4. Lỗi của `livekit-server-sdk` khi `listRooms` / `deleteRoom` / `removeParticipant` gặp room / người không tồn tại là gì (mã Twirp / HTTP) → adapter phân biệt "không tìm thấy" với lỗi khác (§4.2). Có tuỳ chọn timeout request không → đặt ngắn (~5 s) nếu có.
5. Kiểm webhook `room_finished` có `roomEndReason` và `livekit-server-sdk` đọc ra được (§7.2).
6. **Đo khoảng thời gian LiveKit gửi lại webhook**: dừng backend, gây 1 event, đọc log LiveKit (thời điểm từng lần thử, thời điểm bỏ). Ghi số vào `progress.md`. Ước tính từ mã nguồn `livekit/protocol/webhook`: `retryablehttp` mặc định (4 lần thử lại, chờ 1→2→4→8 s ≈ 15 s) và `ResourceURLNotifier` bỏ event xếp hàng quá `MaxAge` 30 s — **chưa xác nhận** bản ghim dùng notifier nào, có ghi đè không.

### 3.4 Giới hạn lúc dev
- `node_ip: 127.0.0.1` → chỉ thử được bằng trình duyệt **trên cùng máy**. Máy khác / điện thoại cần HTTPS (`getUserMedia` chỉ chạy trên secure context) → bước deploy.
- **Khởi động lại container LiveKit kết thúc mọi meeting đang chạy**: LiveKit 1 node giữ room trong RAM; `auto_create: false` nên client không tự kết nối lại được → HOST bắt đầu meeting mới. `docker compose up -d --build` chỉ tạo lại service có thay đổi → sửa code backend không làm LiveKit khởi động lại.
- **URL webhook `http://host.docker.internal:3001/webhooks/livekit`:** container backend publish cổng `3001:3001` → URL tới được backend container qua cổng đã publish, **và** tới được backend native (`npm run start:dev` để đặt breakpoint — ADR-016) đang giữ cổng 3001 trên máy. ADR-016 cấm chạy cả hai cùng lúc → cổng 3001 lúc nào cũng chỉ một bên giữ → không phải sửa yaml / khởi động lại LiveKit khi đổi chế độ. Docker Desktop (Windows) cấp sẵn `host.docker.internal` cho container — kiểm ở Task 1.
- **Khi lên ≥ 2 backend instance (bước gateway / deploy):** `webhook.urls` trỏ vào **NGINX** (load balancer) — LiveKit gửi tới một chỗ, NGINX chuyển cho một instance; mọi side effect nằm trong Mongo / Redis nên instance nào nhận cũng đúng (PROJECT_CONTEXT §7.4). **Không liệt kê URL từng instance**: LiveKit gửi mỗi event tới *mọi* URL trong danh sách → mỗi event bị xử lý N lần chạy đua nhau (vẫn đúng nhờ idempotent nhưng lãng phí và khó đọc log). NGINX phải chuyển nguyên body và header `Authorization` (không nén / biến đổi body) → nếu không, verify chữ ký fail `401`. `host.docker.internal` không có sẵn trên Linux → config deploy là file riêng, chốt ở bước deploy.

---

## 4. Cấu trúc backend

### 4.1 Thư mục
Module có hệ ngoài → tách port + adapter (ràng buộc 9, PROJECT_CONTEXT §19.2). Port đặt tên theo năng lực (`media`), chỉ adapter mang tên vendor.

```
backend/src/modules/meetings/
  meetings.module.ts                 (sửa) controller, service, adapter; import RoomMembersModule, PassportModule; export MeetingsService
  meetings.controller.ts             4 route REST, JwtAuthGuard
  media-webhook.controller.ts        POST /webhooks/livekit — không JWT, xác thực bằng chữ ký
  meetings.service.ts                nghiệp vụ — KHÔNG import gì của LiveKit
  dto/start-meeting.dto.ts           { title }
  dto/list-meetings-query.dto.ts     { page, limit } — cùng ràng buộc với GET /rooms
  ports/media.port.ts                interface MediaPort + token inject MEDIA_PORT
  adapters/livekit-media.adapter.ts  cài MediaPort bằng livekit-server-sdk; Zod env (§3.2); MEMBER_GRANT; computeEndedAt
  schemas/meeting-participant.schema.ts   (sửa) ParticipantSession thêm sid
backend/src/common/services/redis.service.ts  (sửa) thêm scard
backend/src/main.ts                         (sửa) raw body cho application/webhook+json (§4.4)
backend/src/modules/rooms/                   (sửa) gọi MeetingsService khi kick / rời / giải tán (§8)
```

- `MeetingsModule` import `PassportModule.register({ session: false })` (bài học Task 10 module room: thiếu thì `JwtAuthGuard` không khởi động).
- Field tham chiếu trong schema mới / sửa viết `type: SchemaTypes.ObjectId` (bài học Task 10a).
- Phụ thuộc module: `RoomsModule → MeetingsModule → RoomMembersModule` — không vòng.

### 4.2 `MediaPort`

```ts
export const MEDIA_PORT = Symbol('MEDIA_PORT');

export interface MediaPort {
  // emptyTimeout = departureTimeout = MEETING_AUTO_END_AFTER_MIN × 60 (adapter tự đọc env)
  createRoom(roomName: string): Promise<void>;
  // true / false CHỈ khi hỏi được LiveKit. Không hỏi được (timeout, lỗi mạng, 5xx, 401) → NÉM LỖI, không bao giờ trả false
  roomExists(roomName: string): Promise<boolean>;
  // Không báo lỗi nếu room đã đóng / không tồn tại; lỗi khác → ném
  closeRoom(roomName: string): Promise<void>;
  // Không báo lỗi nếu người đó không còn trong room; lỗi khác → ném
  removeParticipant(roomName: string, userId: string): Promise<void>;
  // url = LIVEKIT_PUBLIC_URL — service không bao giờ đọc env LIVEKIT_*
  createJoinToken(input: { roomName: string; userId: string; displayName: string }): Promise<{ token: string; url: string }>;
  // Sai / thiếu chữ ký → ném UnauthorizedException (401)
  parseWebhook(rawBody: string, authHeader: string | undefined): Promise<MediaEvent>;
}

// Event đã chuẩn hoá — không lộ kiểu của LiveKit ra ngoài adapter
export type MediaEvent =
  | { type: 'participant_joined'; eventId: string; roomName: string; userId: string; displayName: string; sid: string; at: Date }
  // gồm cả participant_connection_aborted (§6.3)
  | { type: 'participant_left'; eventId: string; roomName: string; userId: string; sid: string; at: Date }
  // endedAt adapter tính sẵn từ roomEndReason (§7.2)
  | { type: 'room_finished'; eventId: string; roomName: string; endedAt: Date }
  | { type: 'ignored'; eventId: string; event: string };
```

- `at` lấy từ `event.createdAt` (giờ LiveKit tạo event), **không** lấy giờ xử lý → event gửi lại muộn vẫn ghi đúng giờ.
- **Phân biệt "không tồn tại" với "không hỏi được LiveKit":** adapter chỉ nuốt đúng lỗi "không tìm thấy" của LiveKit (mã cụ thể kiểm ở Task 1 — §3.3 bước 4); mọi lỗi khác (timeout, lỗi mạng, 5xx, 401) ném nguyên ra ngoài. `roomExists` đọc `listRooms([name])`: rỗng → `false`, có phần tử → `true`, lỗi → ném. Lý do: `roomExists` = false kích hoạt tự hồi phục (§9.1) — nếu một lỗi tạm thời bị đổi thành `false`, meeting **đang chạy thật** sẽ bị chốt ENDED, HOST tạo thêm meeting mới trong khi cuộc gọi cũ còn người, và ai vào thêm cuộc gọi cũ bị webhook đá ra (meeting không còn ACTIVE).
- Unit test service dùng một `MediaPort` giả — không cần LiveKit thật.

### 4.3 Grant (câu 7)

```ts
// Mọi thành viên cùng quyền media (role.md). canPublishData: false → app data đi Socket.IO, không qua LiveKit (P2)
const MEMBER_GRANT = { roomJoin: true, canPublish: true, canSubscribe: true, canPublishData: false };
```

Token: `identity = userId`, `name = displayName`, `room = meetingId` (ADR-002), grant `MEMBER_GRANT`, TTL `LIVEKIT_TOKEN_TTL_HOURS`. `identity = userId` → mở tab thứ 2 thì LiveKit đá tab cũ (`DUPLICATE_IDENTITY`) — hành vi mong muốn (`webrtc.md` §2).

`canPublishData: false` → SFU từ chối mọi gói data của client; quyền media enforce ở SFU, không chỉ ẩn nút (§15, P2).

### 4.4 Điểm dễ hỏng: raw body của webhook
LiveKit gửi `Content-Type: application/webhook+json`, verify chữ ký cần **raw body** (header `Authorization` chứa JWT có sha256 của body). Body parser JSON mặc định của Nest bỏ qua content-type này → `main.ts` bật `rawBody` và đăng ký parser cho `application/webhook+json`. Controller truyền `req.rawBody` (string) + header `Authorization` cho `parseWebhook`.

---

## 5. REST API

Mọi route REST cần JWT (ADR-008). Response trả `id`, không `_id`. `roomId` / `meetingId` sai định dạng → `400`. Lỗi validate → `400`.

### 5.1 Bảng endpoint

| Endpoint | Quyền | Kiểm bằng |
|---|---|---|
| `POST /rooms/:roomId/meetings` | HOST | `assertRoomPermission(userId, roomId, RoomAction.MANAGE_MEETING)` |
| `GET /rooms/:roomId/meetings?page&limit` | thành viên | `assertRoomAccess(userId, roomId)` |
| `POST /meetings/:meetingId/join` | thành viên, meeting ACTIVE | `assertRoomAccess(userId, meeting.roomId)` |
| `POST /meetings/:meetingId/end` | HOST | `assertRoomPermission(userId, meeting.roomId, RoomAction.MANAGE_MEETING)` |
| `POST /webhooks/livekit` | LiveKit (chữ ký) | `MediaPort.parseWebhook` |

`RoomAction.MANAGE_MEETING` đã có sẵn trong `shared/permissions.ts` — không thêm action mới.

**Meeting response:** `{ id, roomId, title, status, createdBy, startedAt, endedAt, endReason, peakParticipants, totalParticipants, messageCount, durationSeconds }`.

### 5.2 Chi tiết

**`POST /rooms/:roomId/meetings`** — body `{ title: string 1–100 (trim), bắt buộc }`. HOST bỏ trống ô tên thì frontend gửi "Buổi học dd/MM HH:mm" tính theo giờ trình duyệt **lúc bấm** (§11.2) → backend không xử lý múi giờ (container chạy UTC).
1. `assertRoomPermission(..., MANAGE_MEETING)` → `403` / `404`.
2. Tìm meeting ACTIVE của room. Có →
   - `roomExists(id)` = true → `409` "Phòng đang có buổi học diễn ra".
   - = false → **tự hồi phục** (§9.1): `endMeeting(id, lý do hệ thống, endedAt = now)` rồi làm tiếp.
   - `roomExists` **ném lỗi** (không hỏi được LiveKit) → `502` "Không kết nối được máy chủ media", **không đổi gì**: không chốt meeting cũ, không tạo meeting mới.
3. Sinh `id = new Types.ObjectId()` → `createRoom(id)`. Lỗi → `502`, Mongo chưa ghi gì.
4. `Meeting.create({ _id: id, roomId, title, createdBy })`.
   - Trùng unique partial index (vd bấm 2 lần) → `closeRoom(id)` best-effort → `409`. `closeRoom` cũng lỗi thì room LiveKit trống tự đóng sau `emptyTimeout` — không cần bù thêm.
5. `rooms.$inc meetingCount: 1` (DB_DESIGN C.3).
6. `201` → meeting response.

**Thứ tự LiveKit trước, Mongo sau:** không bao giờ có lúc "Mongo đã ACTIVE mà LiveKit chưa có room" → quy tắc tự hồi phục ở bước 2 và ở join không kết thúc nhầm meeting vừa tạo.

**`GET /rooms/:roomId/meetings?page=1&limit=20`** — `page ≥ 1`, `1 ≤ limit ≤ 50`, mặc định 1 / 20.
- `find({ roomId }).sort({ startedAt: -1 }).skip().limit(limit + 1)` — dùng index `{ roomId: 1, startedAt: -1 }` có sẵn.
- `200` → `{ items: MeetingResponse[], page, limit, hasMore }` (giống `GET /rooms`). Trang room xem `items[0].status === 'ACTIVE'` để hiện nút "Tham gia" — không thêm endpoint riêng.

**`POST /meetings/:meetingId/join`**
1. Không có meeting → `404`.
2. `assertRoomAccess(userId, meeting.roomId)` → `403` / `404` (phòng đã giải tán).
3. Meeting ENDED → `409` "Buổi học đã kết thúc".
4. `roomExists(id)` = false → **tự hồi phục**: `endMeeting(id, lý do hệ thống, endedAt = now)` → `409`. `roomExists` ném lỗi → `502`, không chốt gì (LiveKit không trả lời thì đằng nào cũng không vào được call).
5. `createJoinToken({ roomName: id, userId, displayName })` — `displayName` lấy từ `req.user` (JwtStrategy trả document User). Lỗi → `502`.
6. `200` → `{ token, livekitUrl, myRole, meeting }`. Tải lại trang thì gọi lại, nhận token mới (`webrtc.md` §2: cấp lại mỗi lần join).

**`POST /meetings/:meetingId/end`**
1. Không có meeting → `404`. `assertRoomPermission(..., MANAGE_MEETING)` → `403` / `404`.
2. `endMeeting(id, HOST_ENDED, endedAt = now, endedBy = userId)`.
3. `closeRoom(id)`. Lỗi → `502` để HOST bấm lại.
4. `204`. **Idempotent:** meeting đã ENDED vẫn chạy bước 2–3 và trả `204` (bước 2 không ghi đè gì — §7.1) → đây cũng là **lối thoát** cho HOST khi meeting bị kẹt.

---

## 6. Webhook `POST /webhooks/livekit`

### 6.1 Ba nguyên tắc
1. **Chống trùng bằng thao tác tự idempotent, không lưu `event.id`.** Đánh dấu id trong Redis *trước* khi xử lý → lỗi giữa chừng thì lần gửi lại bị bỏ qua (mất event); đánh dấu *sau* → không chặn được LiveKit gửi lại do timeout trong lúc lần đầu vẫn chạy. Thao tác idempotent đúng cả hai trường hợp, không cần thêm key.
2. **Khoá idempotent của một lần vào = `participant.sid`** (LiveKit cấp riêng mỗi kết nối; vào lại / tab mới = sid mới).
3. **Thời điểm lấy từ `event.createdAt`.**

### 6.2 Mã trả về

| Tình huống | Mã | Lý do |
|---|---|---|
| Sai / thiếu chữ ký | `401` | Không chứng minh được nguồn gửi (PROJECT_CONTEXT §7.4: không verify thì ai cũng giả webhook để đá người khác) |
| **Điều kiện biết trước:** `roomName` / `identity` không phải ObjectId (room tạo bằng `lk` khi thử, bot của `lk load-test`), không có meeting, loại event không quan tâm (`track_published`…), người không còn là thành viên (đã `removeParticipant`), meeting đã ENDED | `200` | Chữ ký đúng = event thật từ LiveKit của mình. Gửi lại vẫn ra cùng kết quả → trả 5xx chỉ làm LiveKit gửi lại vô ích và giữ chân hàng đợi. |
| **Exception bất ngờ:** Mongo, Redis, LiveKit API ném lỗi | `500` | Thường là lỗi tạm thời → muốn LiveKit gửi lại. Mọi bước idempotent nên gửi lại an toàn. |

- Trong code: mọi điều kiện biết trước được **kiểm tường minh rồi `return`**; còn lại để exception bay lên → Nest trả `500`. Lỗi vĩnh viễn (do dữ liệu) không bao giờ thành 5xx.
- **Hàng đợi của LiveKit** (mã nguồn `livekit/protocol/webhook`): event xếp hàng **theo resource**, gửi tuần tự trong cùng resource, resource khác không chặn nhau; event xếp hàng quá `MaxAge` (mặc định 30 s) bị bỏ. ⇒ Một event trả `500` chỉ giữ chân các event **cùng resource**, tối đa khoảng 30 s. Chấp nhận: `500` chỉ xảy ra khi Mongo / Redis / LiveKit đang hỏng, lúc đó event sau cũng lỗi y hệt.
- Event bị bỏ hẳn → lưới an toàn: `finalize` chạy lại (§7.1) và các đường tự hồi phục (§9).

### 6.3 Xử lý từng event

**`participant_joined`** (LiveKit gửi khi media đã kết nối xong — `ParticipantActive`)
1. Không có meeting → `200`.
2. Meeting không ACTIVE → `removeParticipant` → `200`.
3. `assertRoomAccess(userId, meeting.roomId)` ném lỗi (403 không phải thành viên / 404 phòng đã giải tán) → `removeParticipant` → `200`. **Đây là chỗ chặn người bị kick vào lại bằng token cũ** (câu 2).
4. Upsert `{ meetingId, userId }` với `$setOnInsert { displayName: participant.name, roleAtJoin: member.role, sessions: [], totalDurationSeconds: 0 }`. Trùng unique `{meetingId, userId}` do 2 event cùng user chạy song song (2 tab) → bắt lỗi trùng, làm tiếp.
5. `$push sessions { sid, joinedAt: at, leftAt: null }` **chỉ khi** chưa có session cùng `sid` (filter `'sessions.sid': { $ne: sid }`).
6. `SADD presence:{meetingId} userId` + `EXPIRE 86400` → `SCARD` → `meetings.updateOne({ _id }, { $max: { peakParticipants: n } })`.

**`participant_left` và `participant_connection_aborted`** — xử lý **y hệt nhau**
- Mã nguồn LiveKit (`pkg/telemetry/events.go`, hàm `ParticipantLeft`): gửi **hoặc** `participant_left` (đã kết nối) **hoặc** `participant_connection_aborted` (chưa kết nối — `worker.IsConnected()` = false), không gửi cả hai. Bình thường một sid bị aborted chưa từng có `participant_joined` → không có session, không có SADD → **lỗi ICE lúc dev chưa có TURN không để lại dữ liệu rác**. Xử lý giống nhau còn che trường hợp biên: worker đã bị dọn trước `ParticipantLeft` → `isConnected` mặc định false → người đã joined nhận aborted thay vì left.
1. Không có meeting → `200`.
2. `updateOne({ meetingId, userId }, { $set: { 'sessions.$[s].leftAt': at } }, { arrayFilters: [{ 's.sid': sid, 's.leftAt': null }] })` — gửi lại thì không khớp → không làm gì; không có session → không làm gì.
3. User không còn session nào `leftAt: null` → `SREM presence:{meetingId} userId`. (Tab mới vào trước khi tab cũ báo rời → user vẫn còn session mở → không bị xoá khỏi presence.)
- Số lần aborted chỉ thấy trong log, không lưu.

**`room_finished`**
1. Không có meeting → `200`.
2. `endMeeting(meetingId, lý do hệ thống, endedAt = event.endedAt)`.

**Lý do hệ thống** (dùng cho `room_finished` và tự hồi phục): room đã `DISSOLVED` → `ROOM_DISSOLVED`, ngược lại → `AUTO_EMPTY`. Lý do suy ra từ trạng thái room nên đúng bất kể đường nào chốt meeting.

---

## 7. Kết thúc meeting

### 7.1 `endMeeting(meetingId, reason, endedAt, endedBy = null)`
Dùng chung cho 4 đường: HOST kết thúc, giải tán phòng, `room_finished`, tự hồi phục.
1. `endedAt = max(endedAt, meeting.startedAt)`. `updateOne({ _id, status: ACTIVE }, { $set: { status: ENDED, endedAt, endedBy, endReason: reason } })`. Không khớp = đã kết thúc từ trước → **không ghi đè `endedAt` / `endReason`**, nhưng **vẫn chạy bước 2** (sửa trường hợp lần trước `finalize` dở).
2. `finalize(meetingId)` — **tính lại toàn bộ từ dữ liệu**, chạy bao nhiêu lần cũng ra cùng kết quả:
   - Đóng session còn mở: `updateMany({ meetingId }, { $set: { 'sessions.$[s].leftAt': meeting.endedAt } }, { arrayFilters: [{ 's.leftAt': null }] })` (atomic, không ghi đè `leftAt` thật do webhook ghi song song).
   - Mỗi participant: `totalDurationSeconds = Σ max(0, leftAt − joinedAt)` (tối đa vài chục document).
   - Meeting: `totalParticipants = countDocuments({ meetingId })` (unique `{meetingId, userId}` → tự nhiên là số người khác nhau), `durationSeconds = endedAt − startedAt`.
   - `DEL presence:{meetingId}`.
3. Nơi gọi tự quyết `closeRoom`: HOST kết thúc → lỗi trả `502`; giải tán → best-effort; `room_finished` → không cần; tự hồi phục → không cần (room đã không còn).

**Trùng số liệu:** `totalParticipants` đếm lại (không `$inc`), `peakParticipants` dùng `$max` → event trùng không làm sai số nào.

### 7.2 `endedAt` của `room_finished` — adapter tính (`computeEndedAt`)
`room_finished` mang `roomEndReason` (protocol `livekit_webhook.proto`, field 13; enum `RoomEndReason` trong `livekit_models.proto`):

| `roomEndReason` | `endedAt` |
|---|---|
| `ROOM_END_IDLE_TIMEOUT` | `event.createdAt − departureTimeout` = lúc người cuối rời. Chưa ai từng vào → `emptyTimeout` cùng giá trị → ≈ `startedAt`, thời lượng ≈ 0. |
| khác (`API_DELETE`, `SERVER_SHUTDOWN`, `UNKNOWN`…) | `event.createdAt` |

- Enum LiveKit và giá trị timeout chỉ nằm trong adapter; service dùng `event.endedAt`.
- Đúng cả khi mất `participant_left` (khác cách "lấy `leftAt` muộn nhất"); không dư 3 phút (khác cách "lấy giờ nhận `room_finished`").
- `computeEndedAt(reason, createdAt, timeoutSec)` là hàm thuần, test riêng.
- **Rủi ro:** nếu bản LiveKit ghim không gửi `roomEndReason` hoặc SDK không đọc được (kiểm ở Task 1) → adapter rơi về `event.createdAt`, ghi giới hạn "dư `departureTimeout`".
- `SERVER_SHUTDOWN` (LiveKit tắt / khởi động lại): room chưa giải tán → `AUTO_EMPTY`, `endedAt = event.createdAt`. LiveKit bị tắt cứng không kịp gửi webhook → tự hồi phục (§9.1) → cũng `AUTO_EMPTY`. Không thêm giá trị enum mới (đổi schema chỉ để phân biệt một trường hợp hiếm). **`AUTO_EMPTY` nghĩa là "hệ thống tự kết thúc" — phòng trống hoặc media server dừng.**

---

## 8. Tích hợp module room

`RoomsService` thêm tham số constructor thứ 6 `meetings: MeetingsService` (đặt **cuối**), gọi thẳng — không `EventEmitter2` (chưa cài; mới có 1 nơi nghe). `[phát sinh kỹ thuật]`, ghi chú ở `architecture.md` §5.

| Chỗ gọi | Hàm | Khi nào |
|---|---|---|
| `kickMember` | `meetings.removeFromActiveMeeting(roomId, targetUserId)` | **sau** `removeMember` thành công |
| `leaveRoom` | `meetings.removeFromActiveMeeting(roomId, userId)` | luôn gọi, kể cả khi `deleteOne` xoá 0 bản ghi (vẫn coi là đã rời) |
| `dissolveRoom` | `meetings.endActiveMeetingOfRoom(roomId)` | sau `updateOne` DISSOLVED — thay `TODO(module meeting)` |

**Hợp đồng: hai hàm này không bao giờ ném lỗi** — tự bắt mọi lỗi, ghi log kèm `roomId`, `meetingId`, `userId` (`architecture.md` §5: listener không được ném lỗi làm hỏng luồng chính). `rooms.service` không cần try/catch. HOST luôn nhận đúng mã của thao tác chính (`204`) — thao tác chính (đổi membership / status) đã ghi xong; trả `502` cũng vô ích vì bấm lại nhận `404` (kick lần 2: không còn bản ghi; giải tán lần 2: `assertRoomAccess` chỉ nhận phòng ACTIVE).

- `removeFromActiveMeeting`: không có meeting ACTIVE → không làm gì. Có → `removeParticipant(meetingId, userId)`.
- `endActiveMeetingOfRoom`: hai bước độc lập, **mỗi bước try/catch riêng**: (a) `endMeeting(id, ROOM_DISSOLVED, now)`; (b) `closeRoom(id)`. (a) lỗi **vẫn chạy (b)**.

**Khi LiveKit / Mongo lỗi:**
- `removeParticipant` lỗi khi kick → người bị kick **còn trong call tới khi tự thoát**; kick lại nhận `404`. Bù: (1) **lối thoát cho HOST** — bấm "Kết thúc buổi học" (`/end` idempotent, bấm lại được); (2) webhook chặn vào lại. Thực tế gọi API LiveKit lỗi gần như = LiveKit chết = không còn cuộc gọi nào.
- Giải tán, (a) lỗi → (b) đóng room → `room_finished` → handler thấy room DISSOLVED → chốt `ROOM_DISSOLVED`. (b) cũng lỗi → người trong call không vào mới được (join kiểm Mongo + `assertRoomAccess` trả 404), tự thoát dần → room trống → `room_finished` → `ROOM_DISSOLVED`. Ngay bước tìm meeting ACTIVE đã lỗi (Mongo sập) → không có `meetingId` để `closeRoom`, vẫn hội tụ qua `room_finished`. **`endReason` cuối cùng luôn là `ROOM_DISSOLVED`.**

---

## 9. Các đường tự hồi phục

1. **Mất `room_finished` (meeting kẹt ACTIVE):** khi bắt đầu meeting mới hoặc vào meeting, nếu Mongo còn meeting ACTIVE mà `roomExists` = false → chốt ENDED (lý do hệ thống) rồi làm tiếp (§5.2). Chỉ chạy khi **hỏi được** LiveKit và LiveKit trả lời "không có room"; không hỏi được → `502`, không chốt gì (§4.2). Không có đường này thì unique partial index "1 meeting ACTIVE / room" khiến HOST **không bắt đầu được meeting mới** — dễ gặp khi dev vì watch mode khởi động lại backend liên tục.
2. **`finalize` dở (Mongo lỗi giữa chừng):** `endMeeting` gọi lại (HOST bấm lại `/end`, hoặc `room_finished` tới) → update có điều kiện không khớp nhưng `finalize` vẫn chạy lại, tính lại từ dữ liệu.
3. **`participant_joined` chạy song song với HOST kết thúc:** joined đọc meeting thấy ACTIVE → HOST đặt ENDED + `finalize` → joined ghi session mới + `SADD` + `$max` → HOST `closeRoom` → LiveKit ngắt **mọi người kể cả người vừa vào**, gửi `room_finished` (`API_DELETE`) → `endMeeting` không ghi đè `endedAt` nhưng `finalize` chạy lại: đóng session vừa mở (`leftAt = endedAt`, thời lượng chặn ≥ 0), đếm lại `totalParticipants` (người này có kết nối thật nên được tính), `DEL presence`. `participant_left` của người đó tới sau → session đã đóng → không làm gì. `closeRoom` lỗi và HOST không bấm lại → người đó tự thoát → room trống → `room_finished` (`IDLE_TIMEOUT`) → dọn y như trên. Lưới cuối: TTL 24h của `presence:{meetingId}`.
4. **Giải tán khi Mongo / LiveKit lỗi:** hội tụ về `ROOM_DISSOLVED` qua `room_finished` (§8).
5. **Bắt đầu meeting lỗi giữa chừng:** `createRoom` lỗi → Mongo chưa ghi gì; `Meeting.create` lỗi → `closeRoom` best-effort, room LiveKit trống tự đóng sau `emptyTimeout` (§5.2).

---

## 10. Dữ liệu

### 10.1 Mongo
- `meeting_participants.sessions[]`: `ParticipantSession` **thêm `sid: string` (bắt buộc)** — khoá idempotent (§6.1). Đổi schema → sửa DB_DESIGN C.6.
- `meetings.peakParticipants`: ghi bằng `$max` mỗi `participant_joined` (câu 8), không chờ meeting kết thúc. `totalParticipants`, `durationSeconds`, `endedAt`, `endedBy`, `endReason` ghi khi kết thúc. `messageCount` giữ 0.
- `rooms.meetingCount`: `$inc 1` khi tạo meeting.
- Index `meetings { status: 1, startedAt: 1 }` (ghi chú cũ "job auto-end quét meeting ACTIVE"): **giữ nguyên index** để không đổi schema; sửa ghi chú — hiện không job nào dùng (ADR-022).

### 10.2 Redis
| Key | Kiểu | TTL | Ghi bởi |
|---|---|---|---|
| `presence:{meetingId}` | Set userId | 24h (làm mới mỗi SADD) | webhook joined / left; `DEL` ở `finalize`. Đọc bởi `assertMeetingTag` (`sismember`). |
| ~~`presence:peak:{meetingId}`~~ | — | — | **Bỏ** (câu 8) |

`RedisService` thêm `scard`.

---

## 11. Frontend

### 11.1 Gọi API
- `src/types/meeting.ts`: `Meeting`, `MeetingListResponse`, `JoinMeetingResponse` khớp §5.
- `src/services/meeting.service.ts`: `startMeeting`, `listMeetings`, `joinMeeting`, `endMeeting`. Dùng lại hàm `request` trong `src/services/room.service.ts` (chỉ thêm `export`, không tạo helper mới).

### 11.2 Trang room — `src/features/meetings/meeting-section.tsx`
Gắn vào `app/rooms/[roomId]/page.tsx` (đã 267 dòng → tách component). Nút chỉ ẩn / hiện theo `myRole`; backend mới là nơi kiểm quyền.
- `items[0]` ACTIVE → tên buổi học + **Tham gia** (link `/meetings/[id]`). HOST thêm **Kết thúc** (dùng được cho cả meeting bị kẹt).
- Không có meeting ACTIVE, HOST → ô tên **không bắt buộc** (để trống, có gợi ý) + **Bắt đầu** → thành công thì chuyển thẳng vào trang meeting. `409` → hiện lỗi + tải lại danh sách (thấy meeting đang chạy).
  - Bỏ trống (hoặc chỉ gõ dấu cách) → tên "Buổi học dd/MM HH:mm" tính theo giờ trình duyệt **lúc bấm**, không phải lúc mở trang. `[user chốt 2026-10-07]` — bản đầu điền sẵn giờ lúc mở trang, để trang mở lâu rồi mới bấm thì tên mang giờ cũ.
- Lịch sử: 20 buổi gần nhất — tên, giờ bắt đầu, thời lượng, số người tối đa / tổng số người, lý do kết thúc (`HOST_ENDED` "Host kết thúc", `AUTO_EMPTY` "Tự kết thúc", `ROOM_DISSOLVED` "Phòng giải tán"). Không phân trang.

### 11.3 Trang meeting
Hai file (`useTracks` cần `RoomContext` — dòng đầu `useEnsureRoom(options.room)`, gọi ngoài `<LiveKitRoom>` thì ném lỗi):
- `app/meetings/[meetingId]/page.tsx` (client component): gọi API vào meeting, render `<LiveKitRoom>`, xử lý ngắt kết nối + lỗi.
- `src/features/meetings/meeting-stage.tsx` (con **bên trong** `<LiveKitRoom>`): `useTracks([Camera có placeholder, ScreenShare])` → `<GridLayout><ParticipantTile /></GridLayout>`, `<ControlBar controls={{ chat: false }} />`, `<RoomAudioRenderer />`. Import `@livekit/components-styles`.

**Không dùng `<VideoConference>`**: nó tự gắn `<Chat>` chạy trên data channel (trái P2). Bộ component đã chọn không cái nào dựa vào data channel (tên, mute, đang nói đi qua signaling). `ControlBar` được cho là tự ẩn nút chat khi thiếu `canPublishData` — kiểm khi làm; `chat: false` vẫn ghi tường minh.

**Luồng trang:**
- Mở trang → gọi API vào meeting → `{ token, livekitUrl, myRole, meeting }`. `409` → "Buổi học đã kết thúc" + nút về danh sách phòng. `403` / `404` → thông báo tương ứng.
- **Chỉ render `<LiveKitRoom>` sau khi có response** → `token`, `serverUrl` đặt một lần, không đổi.
- Vào phòng bật sẵn mic + cam (`audio video`); tắt bằng `ControlBar`. Đầu trang: tên buổi học; HOST có **Kết thúc buổi học** → API `/end` → LiveKit ngắt mọi người với `ROOM_DELETED`.
- `onDisconnected(reason)`: `ROOM_DELETED` → "Buổi học đã kết thúc"; `PARTICIPANT_REMOVED` → "Bạn đã bị mời ra khỏi buổi học"; `DUPLICATE_IDENTITY` → "Bạn đã vào từ tab khác"; `CLIENT_INITIATED` (tự bấm Rời) → về trang room; khác → "Mất kết nối" + **Vào lại** (gọi lại API vào meeting).

**Room options** — hằng số cấp module (config bất biến, ngoài component):
```ts
const ROOM_OPTIONS = {
  adaptiveStream: true,   // nhận đúng layer theo kích thước tile, dừng video tile không hiển thị
  dynacast: true,         // ngừng gửi layer không ai xem
  videoCaptureDefaults: { resolution: VideoPresets.h360.resolution }, // mặc định livekit-client là h720; mục tiêu webrtc.md §6 là 360p
};
```
Simulcast bật mặc định (`publishDefaults.simulcast: true`). `webrtc.md` §5: đã có simulcast, dynacast, adaptive stream, quay 360p, phân trang tile (`GridLayout`); **chưa làm audio-only** (câu 9).

### 11.4 Strict Mode và giữ callback cố định
App Router bật Strict Mode khi dev (`next.config.ts` không tắt) → effect chạy 2 lần (progress Task 9: `/join/[code]` gọi `joinRoom` 2 lần).

Mã nguồn `components-js` `useLiveKitRoom.ts`:
- `Room` tạo trong effect (`setRoom(new Room(options))`); effect kết nối / disconnect `return` sớm khi `room` còn `undefined` → mount / unmount giả của Strict Mode không kết nối gì.
- Effect gắn listener (cleanup `.off(Disconnected)`) khai báo **trước** effect `room.disconnect()` khi unmount → React chạy cleanup theo thứ tự khai báo → **`onDisconnected` không chạy khi unmount**; `CLIENT_INITIATED` chỉ tới handler khi người dùng tự bấm Rời.
- Effect kết nối có deps `[connect, token, JSON.stringify(connectOptions), room, onError, serverUrl, simulateParticipants]` và **không kiểm trạng thái** — mỗi lần deps đổi đều gọi `room.connect(...)`.
- `Room.connect` (`client-sdk-js` `Room.ts`) chỉ chặn `state === Connected` (log info "already connected to room …") và `connectFuture` đang chạy. Chú thích nói "reconnecting or connected… returns immediately" nhưng **code không kiểm `Reconnecting`** → nếu effect chạy lại lúc mạng chập chờn, theo đoạn mã đọc được sẽ mở một lần kết nối mới chồng lên lần reconnect — đúng lúc trang hay đặt state lỗi / banner.

⇒ **Bắt buộc giữ deps cố định:**
- Gọi API vào meeting với **cờ huỷ** — API vẫn bị gọi 2 lần (vô hại: cấp token không giữ state, tự hồi phục chỉ đọc) nhưng chỉ một token tới `<LiveKitRoom>`:
  ```ts
  useEffect(() => {
    let cancelled = false;
    joinMeeting(token, meetingId).then((res) => { if (!cancelled) setJoin(res); }).catch(...);
    return () => { cancelled = true; };
  }, [token, meetingId]);
  ```
- `ROOM_OPTIONS` cấp module (trên).
- `onError`, `onDisconnected`, `onMediaDeviceFailure`, `onConnected` bọc `useCallback`, chỉ phụ thuộc giá trị không đổi: hàm `set...` của React; cờ "đã kết nối" để trong `useRef` (`onConnected` đặt `connectedRef.current = true`) → `onError` deps `[]`; `onDisconnected` deps `[router, roomId]` (`roomId` từ response, đặt một lần).
- Banner / màn hình lỗi đặt state ở trang → trang render lại nhưng `<LiveKitRoom>` nhận đúng prop cũ → effect kết nối không chạy lại.

### 11.5 Lỗi thiết bị và lỗi kết nối
- `onMediaDeviceFailure(failure, kind)` (`MediaDeviceFailure`: `PermissionDenied`, `NotFound`, `DeviceInUse`, `Other`) → **banner không chặn cuộc gọi**, vd "Không bật được camera: thiết bị đang được ứng dụng khác dùng. Bạn vẫn nghe và xem được mọi người; có thể bật lại ở thanh điều khiển." Người dùng vẫn ở trong call — kết nối LiveKit và publish thiết bị là hai bước tách nhau.
- `onError`: chỉ là lỗi chặn khi xảy ra **trước** `Connected` (token sai, room không tồn tại…) → màn hình lỗi + **Vào lại**. Sau khi đã kết nối, lỗi thiết bị do banner lo, `onError` không hiện thêm.
  - `[phát sinh kỹ thuật — Task 9]` `useLiveKitRoom` bật cam / mic ngay ở `SignalConnected` (**trước** `Connected`) và báo lỗi `getUserMedia` qua **cả** `onMediaDeviceFailure` lẫn `onError` → `onError` bỏ qua lỗi `DOMException` (lỗi thiết bị), nếu không thì chặn quyền camera sẽ ra màn hình lỗi chặn thay vì banner. Đo ở progress Task 9.

---

## 12. Test

**Test trước** với service có logic thật (CLAUDE.md). Không viết unit test cho page UI.

### 12.1 Backend (vitest)
- **`rooms.service.spec.ts`** — mọi test trong file tạo service qua hàm chung `build()`: thêm 1 dòng (`meetings = { removeFromActiveMeeting: vi.fn(), endActiveMeetingOfRoom: vi.fn() }`) và truyền làm tham số thứ 6; test cũ giữ nguyên (toàn bộ backend hiện 62 test phải vẫn pass). Test mới:
  - kick thành công → gọi `removeFromActiveMeeting(roomId, targetId)` **sau** `deleteOne`; kick lỗi (`400` / `403` / `404`) → **không** gọi.
  - rời phòng → luôn gọi `removeFromActiveMeeting(roomId, userId)`, kể cả khi `deleteOne` xoá 0 bản ghi.
  - giải tán → gọi `endActiveMeetingOfRoom(roomId)` sau `updateOne`; MEMBER giải tán bị `403` → không gọi.
- **`meetings.service.spec.ts`** (MediaPort giả):
  - start: không phải HOST → `403`; có meeting ACTIVE + `roomExists` true → `409`; ACTIVE + `roomExists` false → chốt meeting cũ rồi tạo mới; thứ tự `createRoom` trước `create`; `createRoom` lỗi → `502`, không gọi `create`; trùng khi `create` → `closeRoom` + `409`; `$inc meetingCount`; response có `id`, không `_id`.
  - list: thành viên; `hasMore`.
  - start: `roomExists` **ném lỗi** → `502`, không gọi `endMeeting`, không gọi `createRoom` / `create`.
  - join: meeting ENDED → `409`; `roomExists` false → chốt + `409`; `roomExists` **ném lỗi** → `502`, không gọi `endMeeting`; thành công → `createJoinToken` đúng `roomName / userId / displayName`, trả `myRole`.
  - end: không phải HOST → `403`; idempotent (đã ENDED vẫn `closeRoom`, không ghi đè `endedAt`); `closeRoom` lỗi → `502`.
  - `removeFromActiveMeeting` / `endActiveMeetingOfRoom`: chạy xong bình thường khi `removeParticipant` / `closeRoom` / Mongo ném lỗi; (a) lỗi vẫn chạy (b).
  - webhook joined: không còn thành viên → `removeParticipant`; meeting ENDED → `removeParticipant`; trùng `sid` → không `$push` lần 2; `$max peak`.
  - webhook left / aborted: đóng đúng session theo `sid`; còn session mở → không `SREM`.
  - webhook room_finished: phòng DISSOLVED → `ROOM_DISSOLVED`, còn lại `AUTO_EMPTY`; `finalize` chạy lại ra cùng kết quả; thời lượng chặn ≥ 0.
  - điều kiện biết trước (roomName / identity không phải ObjectId, không có meeting, event `ignored`) → không ném lỗi; Mongo ném lỗi → lỗi bay lên.
- **Adapter:** `computeEndedAt` (IDLE_TIMEOUT trừ timeout; lý do khác giữ nguyên); `livekitEnvSchema.safeParse(...)` báo lỗi khi thiếu / sai biến (object tự dựng, không đọc `process.env` — §3.2). Cả bộ test phải pass trên máy **không có** biến LiveKit.

### 12.2 Frontend
`npm run build` + `npm run lint` — không phát sinh lỗi mới (lint đang có sẵn 2 lỗi ở `auth.context.tsx` 35:7, 36:7 + 3 warning — progress Task 10).

### 12.3 Lệnh kiểm
CLAUDE.md nhắc `/check` nhưng repo không có `.claude/commands/` → như các task trước: chạy `npm test`, `npm run build`, `npm run lint`, dán output vào `progress.md`.

---

## 13. Kiểm với LiveKit thật

Hai trình duyệt cùng máy, hai tài khoản. Hai trình duyệt không dùng chung webcam được → Chrome `--use-fake-device-for-media-stream`. Output dán vào `progress.md`.

| # | Kịch bản | Mong đợi |
|---|---|---|
| 1 | HOST bắt đầu, cả hai vào | Thấy / nghe nhau, chia sẻ màn hình được. Mongo: 2 participant có `sid`; `presence` 2 người; `peakParticipants = 2`. |
| 2 | MEMBER bấm Rời | Session có `leftAt`; user bị `SREM` khỏi presence. |
| 3 | HOST kick MEMBER đang trong call | MEMBER bị ngắt + thông báo; mở lại URL → `403`. |
| 4 | HOST kết thúc | Cả hai bị ngắt. `HOST_ENDED`, `durationSeconds` / `totalParticipants` đúng, session đóng hết, key presence đã xoá. |
| 5 | Mọi người rời, chờ 3 phút | `AUTO_EMPTY`, `endedAt` ≈ `leftAt` muộn nhất (kiểm `roomEndReason` thật). |
| 6 | Giải tán khi meeting đang chạy | Call kết thúc, `ROOM_DISSOLVED`. |
| 7 | Dừng backend → mọi người rời → chờ **gấp đôi khoảng gửi lại đo ở Task 1** sau khi room đóng → bật backend → HOST bắt đầu meeting mới | Meeting cũ tự hồi phục thành `AUTO_EMPTY`, meeting mới tạo được. |
| 8 | `curl POST /webhooks/livekit` không chữ ký | `401`. |
| 9 | Mở trang meeting khi `npm run dev` (Strict Mode) | Không bị đá về trang room; Mongo **1 session** cho user; log `disconnecting on onmount` chỉ xuất hiện khi rời trang. |
| 10 | Kick rồi vào lại bằng **token cũ** (dưới) | Kết nối được rồi trong khoảng 1 giây bị ngắt `PARTICIPANT_REMOVED`; log backend "không phải thành viên → removeParticipant"; Mongo không có session mới cho user đó. |
| 11 | Chặn quyền camera / mở camera ở trình duyệt kia trước | Banner hiện, vẫn ở trong call, vẫn nghe người khác. **Kiểm deps cố định:** tạm bật `setLogLevel('debug')` cho `livekit-client` và `@livekit/components-react` (đồ bỏ, gỡ trước commit) → sau khi banner hiện, console có **đúng 1** dòng `connecting` và **không có** "already connected to room". |

**Dựng kịch bản 10:** trang HTML **đồ bỏ** trong scratchpad (không commit) — tải `livekit-client` từ CDN, ô dán URL + token, nút Connect, in `RoomEvent.Disconnected` + lý do. Mở qua `file://` hoặc `localhost` (secure context, kết nối được `ws://localhost:7880`).
1. MEMBER vào meeting; lấy token cũ từ DevTools (Network → response `POST /meetings/:id/join`).
2. HOST kick MEMBER → MEMBER bị ngắt `PARTICIPANT_REMOVED`.
3. Dán token cũ vào trang đồ bỏ → Connect.

Dự phòng: `lk room join --identity <userId đã bị kick> <meetingId>` (token do `lk` ký — cùng mô hình đe doạ: một token hợp lệ mang identity người đã bị kick). Cài `lk` ở bước benchmark.

---

## 14. Giới hạn (đưa vào phần Limitations của báo cáo)

1. `removeParticipant` lỗi khi kick → người bị kick còn trong call tới khi tự thoát (lối thoát: HOST kết thúc meeting).
2. Người bị kick vào lại bằng token cũ còn trong call khoảng 1 giây trước khi webhook đưa ra.
3. Meeting tự hồi phục (§9.1) có `endedAt` = lúc phát hiện, không phải lúc thật sự trống.
4. Một `participant_left` bị LiveKit bỏ hẳn → `peakParticipants` có thể dư bằng số event mất; người đã rời vẫn gắn được tag meeting vào tin chat tới khi meeting kết thúc (vẫn là thành viên phòng nên đọc / gửi chat room bình thường — chỉ tag sai). `finalize` dọn khi kết thúc. Muốn mất hẳn thì backend phải không nhận được suốt các lần gửi lại. `peakParticipants` chỉ là thống kê; **số liệu benchmark lấy từ Prometheus của LiveKit**, không từ field này.
5. Chưa có TURN → chưa chứng minh được kết nối từ mạng chặn UDP (bước deploy).
6. Dev chỉ thử được trên cùng máy (`node_ip: 127.0.0.1`).
7. Khởi động lại LiveKit kết thúc mọi meeting đang chạy (LiveKit 1 node, room trong RAM; LiveKit multi-node ngoài phạm vi).
8. Trang room chưa tự cập nhật khi meeting bắt đầu / kết thúc; thông báo kết thúc (đề cương §6.6) chỉ tới người đang trong call — chờ bước gateway.
9. `roomEndReason` không có ở bản LiveKit ghim → `endedAt` của AUTO_EMPTY dư `departureTimeout`.
10. Audio-only chưa có (bước benchmark).
11. `AUTO_EMPTY` gộp cả trường hợp media server dừng.

**Benchmark (để sẵn cho bước sau):** `auto_create: false` ⇒ mọi kịch bản `lk load-test` phải `lk room create bench-...` trước. Tên room không phải ObjectId → webhook trả `200` và bỏ qua, không ghi Mongo. Room benchmark tách khỏi meeting thật: B1–B3 đo SFU (trụ cột 1), trộn bot vào meeting thật làm nặng cuộc gọi người thật và lẫn số liệu CPU. Đo join latency qua backend (`webrtc.md` §7) là script riêng ở bước benchmark. Cờ lệnh cụ thể kiểm khi làm benchmark.

---

## 15. Tài liệu cần sửa (làm trong plan)

| File | Sửa |
|---|---|
| `CLAUDE.md` | Dòng 3 bảng "Nguồn sự thật": `docs/adr/*.md` → `docs/decisions.md` (câu 6). |
| `docs/decisions.md` | Thêm **ADR-022**: tự kết thúc meeting bằng timeout LiveKit + `room_finished` + các đường tự hồi phục §9, `[phát sinh kỹ thuật]`, alternative cron + lock (§7.5) bị loại vì sao. |
| `docs/architecture/architecture.md` | §6: bỏ dòng ACTING_HOST; "auto khi 0 participant 3 phút" trỏ ADR-022. §5 dòng 98: `participant.left → check rỗng → auto-end` → `room_finished → AUTO_EMPTY`; ghi chú `room.dissolved` hiện gọi thẳng service `[phát sinh kỹ thuật]`. §4: `ports/media-server, adapters/livekit` → `ports/media.port.ts`, `adapters/livekit-media.adapter.ts`. |
| `docs/PROJECT_CONTEXT.md` | §7.5: auto-end không dùng job (ADR-022); giữ quy tắc lock cho job khác sau này. §15: hai role dùng chung một grant (`MEMBER_GRANT`). |
| `docs/architecture/webrtc.md` | §2: `toLiveKitGrant(role)` → `MEMBER_GRANT`. §3: thêm `participant_connection_aborted`; peak ghi `$max` Mongo; "broadcast realtime" chuyển sang bước gateway. §4: ghi chú dev (`node_ip`, không `network_mode: host` trên Windows). §5: đánh dấu đã làm / chưa làm (audio-only). |
| `docs/database/DB_DESIGN.md` | Dòng 46 (peak). C.6: `sessions.sid`. Dòng 254 + 506: ghi chú index `{status, startedAt}`. Phần E: bỏ `presence:peak`. |
| `docs/api/endpoint.md` | Thêm nhóm **Meetings** (5 endpoint). Rooms: bỏ dòng "Chưa làm: kết thúc meeting đang diễn ra"; kick / rời ghi chú đưa ra khỏi call. |
| `backend/.env.example` | Thêm 6 biến §3.2. |
| `docs/progress.md` | Sau mỗi task. |

---

## 16. Dependency mới (đã duyệt — câu 4)

| Nơi | Package | Dùng để |
|---|---|---|
| backend | `livekit-server-sdk` | ký token, verify chữ ký webhook, gọi API tạo / xoá room, đưa người ra khỏi room |
| frontend | `livekit-client` | kết nối WebRTC tới LiveKit |
| frontend | `@livekit/components-react` | `LiveKitRoom`, `GridLayout`, `ParticipantTile`, `ControlBar`, `RoomAudioRenderer` |
| frontend | `@livekit/components-styles` | CSS cho các component trên |

Backend cài bằng `npm install --legacy-peer-deps` (ADR-021). Chạy `npm` bằng PowerShell (CLAUDE.md). Zod đã có trong `backend/package.json` — không phải dependency mới.
