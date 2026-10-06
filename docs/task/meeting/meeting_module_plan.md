# Module Meeting + LiveKit — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** HOST bắt đầu / kết thúc buổi học, backend cấp token LiveKit, thành viên vào được cuộc gọi audio / video / chia sẻ màn hình; meeting tự kết thúc khi trống; kick / rời / giải tán phòng đưa người ra khỏi call.

**Architecture:** Module `meetings` dạng port + adapter (ràng buộc 9): `MeetingsService` chỉ biết interface `MediaPort`; `LivekitMediaAdapter` cài nó bằng `livekit-server-sdk`. REST (`MeetingsController`) + webhook LiveKit (`MediaWebhookController`, xác thực bằng chữ ký). Mọi state nằm ở Mongo / Redis; webhook xử lý idempotent theo `participant.sid`; tự kết thúc bằng timeout của LiveKit + `room_finished` (ADR-022). Frontend: khu "Buổi học" ở trang room + trang `/meetings/[meetingId]` dùng `@livekit/components-react`.

**Tech Stack:** NestJS 12 · ESM · Mongoose 9 · redis 4 · zod 3 · class-validator · vitest 4 · LiveKit server (Docker) · `livekit-server-sdk` · Next.js 16 (App Router, client component) · `livekit-client` · `@livekit/components-react` · Tailwind 4 · shadcn/ui

**Spec:** `docs/task/meeting/meeting_module_spec.md` (commit `8ce2d14`) — **đọc cùng plan này**. Plan trích § của spec; spec là chuẩn khi plan và spec lệch nhau.

## Cách chạy: mỗi session một task

Mở session mới cho từng task theo thứ tự, dán prompt dưới đây (đổi `N`). Không chạy 2 session song song (Task 4–7 cùng sửa `meetings.service.ts`). Không dùng worktree — `backend/.env` bị gitignore nên worktree mới không có env, Docker Compose cũng chạy từ thư mục repo chính.

```
Làm Task N trong docs/task/meeting/meeting_module_plan.md bằng skill superpowers:executing-plans. CHỈ Task N, xong thì dừng.

Đọc trước khi làm:
1. docs/progress.md — mục "2026-10-05 — Module meeting" (task trước bàn giao gì, lệch gì, Task 1 đo được gì)
2. docs/task/meeting/meeting_module_spec.md
3. Trong plan: phần đầu (Global Constraints, File map) + toàn bộ Task N

Trước khi code: git status sạch, chạy `npm test` (PowerShell, trong backend) phải pass.
Không dùng worktree.

Khi làm:
- Code trong plan là bản nháp, test + spec mới là chuẩn. Không sửa test cho khớp code sai.
- Lỗi kỹ thuật nhỏ: tự sửa. Cách làm khác plan nhưng giữ hành vi: được, ghi lại.
- Đổi hành vi / API / business rule / test: DỪNG, hỏi tôi.
- Nếu thay đổi ảnh hưởng tới Interfaces của task sau: sửa luôn các task đó trong plan.

Khi xong:
- Dán output `npm test` + `npm run build` (frontend: `npm run build` + `npm run lint`).
- Ghi progress: task, số test pass, lệch khỏi plan, điều task sau cần biết.
- Hỏi tôi trước khi commit.
```

## Global Constraints

- Import tương đối trong **backend** kết thúc bằng `.js` (ESM): `from './meetings.service.js'`. Frontend dùng alias `@/...`, không thêm `.js`.
- Response trả `id`, không `_id` — map trong service (`toMeetingResponse`).
- Validate mọi entry point (ràng buộc 3): DTO class-validator cho body / query; `:roomId` do `assertRoomAccess` / `assertRoomPermission` kiểm; `:meetingId` kiểm bằng `Types.ObjectId.isValid` (400); webhook kiểm chữ ký + `roomName` / `identity` đúng dạng 24 ký tự hex; env LiveKit kiểm bằng Zod lúc khởi động.
- Quyền quyết định ở backend (`RoomAction.MANAGE_MEETING` có sẵn). Frontend chỉ ẩn / hiện nút.
- Không `Map` / `Set` / biến **module-level** giữ state theo user / room / meeting. Hằng số cấp module (config bất biến) thì được.
- Module này **không emit Socket.IO** (event realtime thuộc bước gateway — spec §2).
- Media tách application data (P2): token `canPublishData: false`; frontend **không** dùng `<VideoConference>` / `<Chat>`.
- Port đặt tên theo năng lực (`media`), chỉ adapter mang tên vendor (`livekit-media.adapter.ts`).
- `tsconfig` bật `isolatedModules` + `emitDecoratorMetadata`: **interface / type** dùng trong constructor có decorator phải import bằng `import type` (vd `import type { MediaPort }`); **class** được inject (vd `MeetingsService`, `RoomAccessService`) import bình thường.
- Field tham chiếu trong schema viết `type: SchemaTypes.ObjectId` (bài học Task 10a module room).
- Module dùng `JwtAuthGuard` phải import `PassportModule.register({ session: false })` (bài học Task 10 module room).
- Dependency mới **chỉ 4 package đã duyệt** (spec §16): backend `livekit-server-sdk`; frontend `livekit-client`, `@livekit/components-react`, `@livekit/components-styles`. Chỉ npm (ADR-021): backend `npm install --legacy-peer-deps`, frontend `npm install`.
- Lệnh `npm` chạy bằng **PowerShell**. Backend: `Set-Location backend`. Frontend: `Set-Location frontend`.
- Backend dev chạy bằng `docker compose up -d --build` (ADR-016). Thêm dependency backend → phải `--build` lại (node_modules nằm trong image). **Không** chạy backend native và container cùng lúc.
- Ghi chú code ngắn, tiếng Việt, dễ hiểu — theo mật độ comment của `rooms.service.ts`.
- Test trước với service / hàm có logic (TDD). Không test DTO, schema, controller mỏng, page UI.
- **Đồ bỏ không bao giờ commit:** `backend/spike/`, `frontend/public/lk-test.html`, dòng `setLogLevel('debug')` tạm ở Task 10.
- **Commit chỉ khi user cho phép** trong phiên thực thi. Message `<type>: <mô tả>`, type ∈ `feat fix refactor test docs chore`, kết thúc bằng dòng `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. `docs/task/` đã được track (commit `c8550f9`) → sửa plan / spec thì commit cùng.
- Sau mỗi task: thêm vào `docs/progress.md` một mục `## <ngày> — Module meeting: Task N (...)` theo mẫu các mục module room: xong gì, commit, test, lệch khỏi plan, task sau cần biết.

**Thứ tự làm:** 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10.

---

## File map

| File | Việc | Task |
|---|---|---|
| `infrastructure/livekit/livekit.yaml` | **Tạo** — config LiveKit dev | 1 |
| `docker-compose.yml` | Thêm service `livekit`; sửa `LIVEKIT_URL` của backend | 1 |
| `backend/.env.example` | Thêm 6 biến LiveKit | 1 |
| `backend/package.json`, `backend/package-lock.json` | Thêm `livekit-server-sdk` | 1 |
| `CLAUDE.md`, `docs/decisions.md`, `docs/architecture/architecture.md`, `docs/PROJECT_CONTEXT.md`, `docs/architecture/webrtc.md` | Sửa theo spec §15 | 2 (webrtc §5 ở 10) |
| `backend/src/modules/meetings/ports/media.port.ts` | **Tạo** — `MediaPort`, `MediaEvent`, `MEDIA_PORT` | 3 |
| `backend/src/modules/meetings/adapters/livekit-media.adapter.ts` | **Tạo** — adapter + `livekitEnvSchema`, `computeEndedAt`, `isNotFound`, `toMediaEvent` | 3 |
| `backend/src/modules/meetings/adapters/livekit-media.adapter.spec.ts` | **Tạo** — test hàm thuần | 3 |
| `backend/src/modules/meetings/meetings.service.ts` | **Tạo** — toàn bộ nghiệp vụ meeting | 4–7 |
| `backend/src/modules/meetings/meetings.service.spec.ts` | **Tạo** — test | 4–7 |
| `backend/src/modules/meetings/meetings.controller.ts` | **Tạo** — 4 route REST | 4, 5 |
| `backend/src/modules/meetings/media-webhook.controller.ts` | **Tạo** — `POST /webhooks/livekit` | 6 |
| `backend/src/modules/meetings/dto/start-meeting.dto.ts`, `dto/list-meetings-query.dto.ts` | **Tạo** | 4 |
| `backend/src/modules/meetings/meetings.module.ts` | Đăng ký controller, service, adapter, model `Room`; export service | 4, 6 |
| `backend/src/modules/meetings/schemas/meeting-participant.schema.ts` | `ParticipantSession` thêm `sid` | 6 |
| `backend/src/common/services/redis.service.ts` | Thêm `scard` | 6 |
| `backend/src/main.ts` | `rawBody` + parser `application/webhook+json` | 6 |
| `backend/src/modules/rooms/rooms.service.ts`, `rooms.service.spec.ts`, `rooms.module.ts` | Gọi `MeetingsService` khi kick / rời / giải tán | 7 |
| `docs/database/DB_DESIGN.md` | `sessions.sid`, peak `$max`, bỏ `presence:peak`, ghi chú index | 6 |
| `docs/api/endpoint.md` | Nhóm Meetings + webhook; ghi chú Rooms | 4–7 |
| `frontend/src/services/room.service.ts` | `export` hàm `request` | 8 |
| `frontend/src/types/meeting.ts`, `frontend/src/services/meeting.service.ts` | **Tạo** | 8 |
| `frontend/src/features/meetings/meeting-section.tsx` | **Tạo** — khu "Buổi học" | 8 |
| `frontend/app/rooms/[roomId]/page.tsx` | Gắn `MeetingSection` | 8 |
| `frontend/package.json`, `frontend/package-lock.json` | Thêm 3 package LiveKit | 9 |
| `frontend/app/meetings/[meetingId]/page.tsx` | **Tạo** — trang cuộc gọi | 9 |
| `frontend/src/features/meetings/meeting-stage.tsx` | **Tạo** — lưới video + thanh điều khiển | 9 |
| `docs/progress.md` | Sau mỗi task | 1–10 |

---

### Task 1: Hạ tầng LiveKit dev + chạy thử thật (spike)

Spec §3. Mục tiêu: lỗi ICE / port / webhook lộ ra **trước** khi viết code nghiệp vụ, và đo 6 điểm spec §3.3 mà các task sau dựa vào. Code spike là **đồ bỏ** — xoá trước khi commit.

**Files:**
- Create: `infrastructure/livekit/livekit.yaml`
- Modify: `docker-compose.yml` (thêm service `livekit`; dòng 44 `LIVEKIT_URL`)
- Modify: `backend/.env` (không commit), `backend/.env.example`
- Modify: `backend/package.json`, `backend/package-lock.json` (`livekit-server-sdk`)
- Đồ bỏ (không commit): `backend/spike/room.mjs`, `backend/spike/webhook-server.mjs`, `frontend/public/lk-test.html`
- Modify: `docs/progress.md`

**Interfaces:**
- Produces (ghi vào progress — Task 3, 6, 10 cần):
  - Phiên bản LiveKit đã ghim `vX.Y.Z`.
  - Cách khai báo key/secret một chỗ (cách A hay B ở Step 4).
  - Hình dạng lỗi "không tìm thấy" của SDK (`constructor.name`, `code`, `status`) cho `deleteRoom` / `removeParticipant` / `listRooms` → Task 3 viết `isNotFound` theo đó.
  - `roomEndReason` có trong webhook `room_finished` không, giá trị khi room trống (`2` = `ROOM_END_IDLE_TIMEOUT`).
  - Khoảng thời gian LiveKit gửi lại webhook (số lần, giây).
  - `RoomServiceClient` có tuỳ chọn timeout request không (tên tuỳ chọn).

- [ ] **Step 1: Kiểm đầu phiên**

PowerShell:
```powershell
git status --short          # phải sạch
Set-Location backend; npm test; Set-Location ..
```
Expected: `Tests  62 passed (62)`.

- [ ] **Step 2: Ghim phiên bản LiveKit + kiểm image có shell**

```powershell
curl.exe -s "https://hub.docker.com/v2/repositories/livekit/livekit-server/tags?page_size=15&ordering=last_updated" | Select-String -Pattern '"name":"v[0-9.]+"' -AllMatches | ForEach-Object { $_.Matches.Value } | Select-Object -First 5
```
Chọn tag `vX.Y.Z` mới nhất (không dùng `latest`). Thay `vX.Y.Z` ở mọi chỗ dưới bằng tag này.

```powershell
docker run --rm --entrypoint /bin/sh livekit/livekit-server:vX.Y.Z -c "ls -l /livekit-server && echo SHELL_OK"
```
Expected: in đường dẫn binary + `SHELL_OK` → dùng **cách A** ở Step 4. Lỗi "no such file" (image không có shell) → dùng **cách B**. Nếu binary không nằm ở `/livekit-server`, ghi đường dẫn đúng và dùng nó trong `entrypoint`.

- [ ] **Step 3: Tạo `infrastructure/livekit/livekit.yaml`**

Xem tên key (không bí mật) đang có trong `backend/.env`:
```powershell
Select-String -Path backend/.env -Pattern '^LIVEKIT_API_KEY='
```
Dùng đúng tên đó cho `webhook.api_key` (ví dụ dưới giả sử `devkey`).

```yaml
# LiveKit dev (Docker Compose) — spec meeting §3.1. Config lúc deploy là file riêng (bước deploy).
port: 7880
rtc:
  tcp_port: 7881          # ICE/TCP fallback
  udp_port: 7882          # single-port UDP mux (PROJECT_CONTEXT §5)
  use_external_ip: false
  node_ip: 127.0.0.1      # dev: trình duyệt cùng máy. Docker Desktop Windows không có network_mode: host
room:
  auto_create: false      # chỉ backend tạo room → token cũ (còn hạn 6h) không sinh room "ma"
webhook:
  api_key: devkey         # TÊN key dùng ký webhook (không bí mật) — phải trùng LIVEKIT_API_KEY trong backend/.env
  urls:
    # Một URL cho cả backend container (cổng 3001 đã publish) lẫn backend native (spec §3.4)
    - http://host.docker.internal:3001/webhooks/livekit
logging:
  level: info
```

- [ ] **Step 4: Thêm service `livekit` vào `docker-compose.yml` + sửa `LIVEKIT_URL`**

Sửa dòng 44 trong service `backend` (mục `environment:` đè `env_file`):
```yaml
      LIVEKIT_URL: http://livekit:7880
```

Thêm service (đặt sau `redis`, trước `backend`). **Cách A** (image có shell — key/secret chỉ ở `backend/.env`):
```yaml
  livekit:
    image: livekit/livekit-server:vX.Y.Z
    container_name: livekit-dev
    restart: unless-stopped
    # Key/secret chỉ khai báo ở backend/.env (spec §3.3): đọc env_file rồi ghép thành LIVEKIT_KEYS="key: secret".
    # $$ = ký tự $ thật (không để Compose thay biến)
    env_file:
      - ./backend/.env
    entrypoint: ["/bin/sh", "-c", "LIVEKIT_KEYS=\"$$LIVEKIT_API_KEY: $$LIVEKIT_API_SECRET\" exec /livekit-server --config /etc/livekit.yaml"]
    volumes:
      - ./infrastructure/livekit/livekit.yaml:/etc/livekit.yaml:ro
    ports:
      - "7880:7880"
      - "7881:7881"
      - "7882:7882/udp"
```

**Cách B** (image không có shell): thêm vào `backend/.env` một dòng `LIVEKIT_KEYS=devkey: <đúng secret của LIVEKIT_API_SECRET>` (cùng file, không commit), và service dùng:
```yaml
  livekit:
    image: livekit/livekit-server:vX.Y.Z
    container_name: livekit-dev
    restart: unless-stopped
    # LiveKit đọc LIVEKIT_KEYS ("key: secret") từ backend/.env — dòng này lặp secret của LIVEKIT_API_SECRET (dev)
    env_file:
      - ./backend/.env
    command: --config /etc/livekit.yaml
    volumes:
      - ./infrastructure/livekit/livekit.yaml:/etc/livekit.yaml:ro
    ports:
      - "7880:7880"
      - "7881:7881"
      - "7882:7882/udp"
```

Kiểm `backend/.env` **không** có biến trùng tên LiveKit server đọc (`NODE_IP`, `REDIS_HOST`, `BIND`, `UDP_PORT`):
```powershell
Select-String -Path backend/.env -Pattern '^(NODE_IP|REDIS_HOST|BIND|UDP_PORT)='
```
Expected: không in gì.

- [ ] **Step 5: Biến môi trường**

`backend/.env` (giá trị khi chạy native — Compose đè `LIVEKIT_URL`):
- Sửa `LIVEKIT_URL=http://localhost:7880` (đang là `ws://localhost:7880`).
- Thêm `LIVEKIT_PUBLIC_URL=ws://localhost:7880`.
- Giữ `LIVEKIT_TOKEN_TTL_HOURS=6`, `MEETING_AUTO_END_AFTER_MIN=3`.
- Kiểm độ dài secret (**không in giá trị**):
  ```powershell
  ((Select-String -Path backend/.env -Pattern '^LIVEKIT_API_SECRET=(.*)$').Matches[0].Groups[1].Value).Length
  ```
  < 32 → sinh secret mới, thay vào `.env` (không dán ra log / progress):
  ```powershell
  node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))"
  ```

`backend/.env.example` — thêm cuối file:
```
# LiveKit (module meeting — spec §3.2). Docker Compose đè LIVEKIT_URL bằng http://livekit:7880
LIVEKIT_URL=http://localhost:7880
LIVEKIT_PUBLIC_URL=ws://localhost:7880
LIVEKIT_API_KEY=devkey
LIVEKIT_API_SECRET=change_this_to_a_random_string_at_least_32_chars
LIVEKIT_TOKEN_TTL_HOURS=6
MEETING_AUTO_END_AFTER_MIN=3
```

- [ ] **Step 6: Chạy LiveKit, đọc log**

```powershell
docker compose up -d livekit
docker compose logs livekit --tail 40
```
Expected: dòng `starting LiveKit server` có `portHttp: 7880`, `rtc.portTCP: 7881`, `rtc.portUDP: 7882`, `nodeIP: 127.0.0.1`; **không** có lỗi về key (`one of key-file or keys must be provided`, `secret is too short`). Có lỗi → sửa Step 3–5, chạy lại.

- [ ] **Step 7: Cài `livekit-server-sdk` cho backend**

```powershell
Set-Location backend
npm install livekit-server-sdk --legacy-peer-deps
npm test
Set-Location ..
```
Expected: `package.json` có `livekit-server-sdk`; test vẫn `62 passed`.

- [ ] **Step 8: Tạo 3 file đồ bỏ**

`backend/spike/room.mjs`:
```js
// ĐỒ BỎ — Task 1 module meeting. KHÔNG commit. Chạy trong backend: node --env-file=.env spike/room.mjs <lệnh> [identity]
import { AccessToken, RoomServiceClient } from 'livekit-server-sdk';

const { LIVEKIT_URL, LIVEKIT_API_KEY: key, LIVEKIT_API_SECRET: secret } = process.env;
const rooms = new RoomServiceClient(LIVEKIT_URL, key, secret);
const [cmd, arg] = process.argv.slice(2);
// In hình dạng lỗi để viết isNotFound (spec §4.2)
const show = (label, err) =>
  console.log(label, '→', err?.constructor?.name, JSON.stringify({ code: err?.code, status: err?.status, message: err?.message }));

if (cmd === 'create') {
  // Trống 60 s thì đóng — ngắn để đo room_finished nhanh
  console.log(await rooms.createRoom({ name: 'spike-room', emptyTimeout: 60, departureTimeout: 60 }));
} else if (cmd === 'token') {
  const at = new AccessToken(key, secret, { identity: arg, name: `Spike ${arg}`, ttl: '1h' });
  at.addGrant({ roomJoin: true, room: 'spike-room', canPublish: true, canSubscribe: true, canPublishData: false });
  console.log(await at.toJwt());
} else if (cmd === 'list') {
  console.log(await rooms.listRooms(['spike-room', 'khong-ton-tai']));
} else if (cmd === 'delete') {
  // Xoá room đang có người → room_finished với roomEndReason API_DELETE, người trong room bị ngắt ROOM_DELETED
  await rooms.deleteRoom('spike-room');
  console.log('đã xoá spike-room');
} else if (cmd === 'errors') {
  await rooms.deleteRoom('khong-ton-tai').then(() => console.log('deleteRoom(lạ): KHÔNG lỗi'), (e) => show('deleteRoom(lạ)', e));
  await rooms.removeParticipant('khong-ton-tai', 'ai-do').then(() => console.log('removeParticipant(room lạ): KHÔNG lỗi'), (e) => show('removeParticipant(room lạ)', e));
  await rooms.removeParticipant('spike-room', 'ai-do').then(() => console.log('removeParticipant(người lạ): KHÔNG lỗi'), (e) => show('removeParticipant(người lạ)', e));
  await rooms.listRooms(['khong-ton-tai']).then((r) => console.log('listRooms(lạ):', r.length, 'room'), (e) => show('listRooms(lạ)', e));
  const down = new RoomServiceClient('http://localhost:7999', key, secret);
  await down.listRooms(['x']).then(() => console.log('LiveKit không chạy: KHÔNG lỗi (sai!)'), (e) => show('listRooms khi không có server', e));
}
```

`backend/spike/webhook-server.mjs`:
```js
// ĐỒ BỎ — Task 1. Giả backend trên cổng 3001 để kiểm webhook LiveKit: raw body, chữ ký, roomEndReason, khoảng gửi lại.
// Chạy trong backend (đã dừng container backend): node --env-file=.env spike/webhook-server.mjs
// $env:FAIL='1' trước khi chạy → luôn trả 500 để đo LiveKit gửi lại bao nhiêu lần
import http from 'node:http';
import { WebhookReceiver } from 'livekit-server-sdk';

const receiver = new WebhookReceiver(process.env.LIVEKIT_API_KEY, process.env.LIVEKIT_API_SECRET);
const fail = process.env.FAIL === '1';

http
  .createServer((req, res) => {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', async () => {
      const t = new Date().toISOString();
      try {
        const e = await receiver.receive(body, req.headers.authorization);
        console.log(t, req.headers['content-type'], e.event, 'id=' + e.id, 'createdAt=' + String(e.createdAt),
          'room=' + e.room?.name, 'identity=' + e.participant?.identity, 'sid=' + e.participant?.sid,
          'roomEndReason=' + e.roomEndReason);
        res.writeHead(fail ? 500 : 200).end();
      } catch (err) {
        console.log(t, 'CHỮ KÝ SAI → 401:', err.message);
        res.writeHead(401).end();
      }
    });
  })
  .listen(3001, '0.0.0.0', () => console.log('spike webhook :3001', fail ? '(FAIL=1 → luôn 500)' : ''));
```

`frontend/public/lk-test.html`: chép nguyên **Phụ lục A** (cuối plan).

- [ ] **Step 9: Dừng backend container, chạy spike**

Ba cửa sổ PowerShell:
```powershell
# Cửa sổ 1 — giữ cổng 3001 cho spike (ADR-016: không chạy 2 backend cùng lúc)
docker compose stop backend
Set-Location backend; node --env-file=.env spike/webhook-server.mjs
```
```powershell
# Cửa sổ 2 — phục vụ lk-test.html ở http://localhost:3000/lk-test.html (localhost = secure context)
Set-Location frontend; npm run dev
```
```powershell
# Cửa sổ 3 — tạo room + 2 token
Set-Location backend
node --env-file=.env spike/room.mjs create
node --env-file=.env spike/room.mjs token userA
node --env-file=.env spike/room.mjs token userB
```

- [ ] **Step 10: Hai trình duyệt vào cùng room**

Mở `http://localhost:3000/lk-test.html` ở Chrome và ở Chrome ẩn danh (hoặc Edge). Dán token A / B, bấm Connect. Hai trình duyệt không dùng chung webcam được → chạy Chrome thứ hai với `--use-fake-device-for-media-stream`.

Expected:
- Log trang: `Connected`, `ParticipantConnected`, `TrackSubscribed video/audio` — **thấy và nghe nhau**.
- Cửa sổ 1: 2 dòng `application/webhook+json participant_joined id=… sid=PA_… identity=userA|userB`.
- Không kết nối được (ICE) → thử bỏ dấu "bật cam + mic", xem log LiveKit (`docker compose logs livekit --tail 60`), thử `rtc.node_ip` = IP LAN của máy. Ghi lại cách đã sửa.

- [ ] **Step 11: Rời phòng, đo `room_finished`**

Đóng cả hai tab. Expected cửa sổ 1: 2 dòng `participant_left`; khoảng **60 s** sau: `room_finished … roomEndReason=2` (`ROOM_END_IDLE_TIMEOUT`).
- `roomEndReason=undefined` → bản LiveKit / SDK không có field → spec §7.2 rơi về `event.createdAt` (ghi giới hạn số 9).

Thử `API_DELETE`: `node --env-file=.env spike/room.mjs create`, vào 1 tab bằng token mới (`token userA`), rồi `node --env-file=.env spike/room.mjs delete`. Expected: tab log `Disconnected, reason = … ROOM_DELETED`; cửa sổ 1 `room_finished … roomEndReason=1`.

- [ ] **Step 12: Hình dạng lỗi "không tìm thấy" + timeout request**

```powershell
node --env-file=.env spike/room.mjs create
node --env-file=.env spike/room.mjs errors
Get-ChildItem -Recurse -Filter *.d.ts node_modules/livekit-server-sdk/dist | Select-String -Pattern 'requestTimeout' | Select-Object -First 10
```
Ghi nguyên output vào progress. Task 3 viết `isNotFound` theo đúng `code` / `status` in ra. Dòng "LiveKit không chạy" phải là **lỗi** (không phải "KHÔNG lỗi") — đó là lỗi mà `roomExists` phải ném ra (spec §4.2).

- [ ] **Step 13: Chữ ký sai bị chặn**

```powershell
curl.exe -s -o NUL -w "%{http_code}`n" -X POST http://localhost:3001/webhooks/livekit -H "Authorization: abc" -H "Content-Type: application/webhook+json" -d "{}"
```
Expected: `401`; cửa sổ 1 in `CHỮ KÝ SAI → 401`.

- [ ] **Step 14: Đo khoảng LiveKit gửi lại webhook**

Cửa sổ 1: `Ctrl+C`, chạy lại với `$env:FAIL='1'; node --env-file=.env spike/webhook-server.mjs`. Tạo room, vào 1 tab, đóng tab.
Expected: cùng một `id=` xuất hiện nhiều lần. Ghi: số lần gửi của **một** event, thời điểm lần đầu và lần cuối → khoảng gửi lại (giây). Sau đó `Remove-Item Env:FAIL`.

- [ ] **Step 15: Dọn đồ bỏ, chạy lại backend**

```powershell
# Ctrl+C cửa sổ 1 và cửa sổ 2 trước
Remove-Item -Recurse -Force backend/spike
Remove-Item -Force frontend/public/lk-test.html
docker compose up -d --build
docker compose logs backend --tail 20
git status --short
```
Expected: backend log `Nest application successfully started`; `git status` chỉ còn `docker-compose.yml`, `infrastructure/`, `backend/.env.example`, `backend/package.json`, `backend/package-lock.json`.

- [ ] **Step 16: Ghi progress**

Thêm mục `## <ngày> — Module meeting: Task 1 (hạ tầng LiveKit + spike)` vào `docs/progress.md`: phiên bản ghim, cách A/B, output Step 10–14 (dán nguyên), mọi chỗ phải sửa để ICE chạy. **Nếu hình dạng lỗi Step 12 khác `code === 'not_found'` / `status === 404`** → sửa luôn hàm `isNotFound` + test của nó trong Task 3 của plan này.

- [ ] **Step 17: Commit (khi user cho phép)**

```powershell
git add docker-compose.yml infrastructure/livekit/livekit.yaml backend/.env.example backend/package.json backend/package-lock.json docs/progress.md docs/task/meeting/meeting_module_plan.md
git commit -m "chore: LiveKit dev trong Docker Compose, cài livekit-server-sdk" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Sửa tài liệu thiết kế theo spec §15

Spec §1 (câu 1, 5, 6, 7), §15. Chỉ sửa tài liệu, không code. (DB_DESIGN làm ở Task 6, endpoint.md ở Task 4–7, `webrtc.md` §5 ở Task 10 — đi cùng phần code tương ứng.)

**Files:**
- Modify: `CLAUDE.md` (dòng 18)
- Modify: `docs/decisions.md` (thêm ADR-022 cuối file)
- Modify: `docs/architecture/architecture.md` (dòng 63, bảng §5, §6 Lifecycle)
- Modify: `docs/PROJECT_CONTEXT.md` (§7.5, §15)
- Modify: `docs/architecture/webrtc.md` (§2, §3, §4)
- Modify: `docs/progress.md`

**Interfaces:** không có (chỉ tài liệu). Nếu Task 1 ghi `roomEndReason` không có → ADR-022 thêm câu "endedAt của AUTO_EMPTY dư departureTimeout (spec §14 mục 9)".

- [ ] **Step 1: `CLAUDE.md` dòng 18**

Thay:
```
| 3 | `docs/adr/*.md` | Quyết định kỹ thuật đã chốt — một file một quyết định, xem `docs/adr/README.md` |
```
bằng:
```
| 3 | `docs/decisions.md` | Quyết định kỹ thuật đã chốt — ADR-001…, mỗi ADR một mục |
```

- [ ] **Step 2: `docs/decisions.md` — thêm ADR-022 cuối file**

```markdown

## ADR-022 — Tự kết thúc meeting bằng timeout của LiveKit + webhook `room_finished` `[phát sinh kỹ thuật]`
**Decision:** Khi bắt đầu meeting, backend tạo room LiveKit với `emptyTimeout` = `departureTimeout` = `MEETING_AUTO_END_AFTER_MIN` × 60 giây. Room trống đủ thời gian → LiveKit đóng room, gửi webhook `room_finished` → backend chốt meeting `ENDED` bằng update có điều kiện `{ status: ACTIVE }`, lý do `AUTO_EMPTY` (hoặc `ROOM_DISSOLVED` nếu phòng đã giải tán). `endedAt` lấy theo `roomEndReason` (idle timeout → lúc người cuối rời). Không job cron, không distributed lock. Lưới an toàn khi mất webhook: bắt đầu / vào meeting thấy Mongo còn ACTIVE mà LiveKit trả lời "không có room" → chốt rồi làm tiếp (không hỏi được LiveKit → 502, không chốt gì); `finalize` tính lại thống kê từ dữ liệu, chạy lại được.
**Reason:** Không có trong đề cương (§6.6 chỉ nói chủ phòng kết thúc phiên) — phát sinh để meeting không treo ACTIVE mãi (unique partial index "1 meeting ACTIVE / room" sẽ chặn HOST mở buổi mới). Ít code nhất mà vẫn đúng khi nhiều instance: webhook tới 1 instance, mọi side effect nằm trong Mongo (PROJECT_CONTEXT §7.4).
**Alternatives:** job cron mỗi phút + distributed lock (PROJECT_CONTEXT §7.5); dùng cả hai.
**Rejected because:** cron phải lưu thêm "trống từ lúc nào" trong Redis, lock `SET NX` + Lua nhả lock, và phải nâng `departureTimeout` mặc định 20 s của LiveKit để hai cơ chế không giẫm nhau — nhiều code hơn cho cùng kết quả. Dùng cả hai là over-engineering.
**Status:** CONFIRMED — user chốt 2026-10-04. Chi tiết: `docs/task/meeting/meeting_module_spec.md` §6, §7, §9.
```

- [ ] **Step 3: `docs/architecture/architecture.md`**

Dòng 63, thay:
```
    ├── meetings/        [hexagonal]  + ports/media-server, adapters/livekit, webhook controller
```
bằng:
```
    ├── meetings/        [hexagonal]  + ports/media.port.ts, adapters/livekit-media.adapter.ts, media-webhook.controller.ts
```

Bảng catalog §5, thay dòng:
```
| `participant.left` | meetings (webhook) | meetings (check rỗng → auto-end), realtime |
```
bằng:
```
| `participant.left` | meetings (webhook) | meetings (đóng session, presence), realtime |
| `room.finished` | meetings (webhook) | meetings (chốt `AUTO_EMPTY` / `ROOM_DISSOLVED` — ADR-022) |
```
và thêm ngay dưới bảng (trước dòng "Listener phải **idempotent**…"):
```
Hiện `room.dissolved` và kick / rời phòng → meetings **gọi thẳng** `MeetingsService` (`endActiveMeetingOfRoom`, `removeFromActiveMeeting`), chưa dùng `EventEmitter2` (chưa cài, mới có 1 nơi nghe) `[phát sinh kỹ thuật]` — spec meeting §8.
```

§6 Lifecycle, thay:
```
- Meeting: `ACTIVE → ENDED` (HOST chủ động, hoặc auto khi 0 participant 3 phút)
```
bằng:
```
- Meeting: `ACTIVE → ENDED` (HOST chủ động, giải tán phòng, hoặc tự kết thúc khi room LiveKit trống 3 phút — ADR-022)
```
và **xoá** dòng:
```
- Host disconnect: grace 120s  participant join sớm nhất thành `ACTING_HOST`; host gốc quay lại lấy lại quyền
```

- [ ] **Step 4: `docs/PROJECT_CONTEXT.md`**

§7.5, thay câu:
```
`@nestjs/schedule` chạy trên mọi replica. Job auto-end meeting phải bọc distributed lock:
```
bằng:
```
`@nestjs/schedule` chạy trên mọi replica. Job định kỳ (nếu có) phải bọc distributed lock. **Auto-end meeting không dùng job** — dùng timeout của LiveKit + webhook `room_finished` (ADR-022). Quy tắc lock dưới đây giữ cho job khác sau này:
```

§15, ngay sau dòng bắt đầu bằng `**Role map thẳng sang LiveKit token grant**`, thêm dòng:
```
Hiện hai role có grant giống hệt nhau nên code dùng **một hằng số `MEMBER_GRANT`** trong adapter LiveKit (`canPublish`, `canSubscribe`, `canPublishData: false` — P2); khi có role mới (vd VIEWER) mới cần bảng theo role (spec meeting §4.3).
```

- [ ] **Step 5: `docs/architecture/webrtc.md`**

§2, thay khối token flow bằng:
```
Client → POST /meetings/:id/join  (JWT)
       → Backend: check membership + meeting ACTIVE + room LiveKit còn (không còn → tự hồi phục, 409)
       → sinh LiveKit AccessToken:
            identity   = userId
            name       = displayName
            room       = meeting._id.toString()
            grant      = MEMBER_GRANT          // mọi thành viên cùng quyền: publish + subscribe, canPublishData: false (P2)
            TTL        = LIVEKIT_TOKEN_TTL_HOURS (6 giờ)
       → trả { token, livekitUrl, myRole, meeting }
Client → connect LiveKit bằng token
```

§3, thay khối webhook flow + dòng "Event quan tâm" bằng:
```
LiveKit → POST /webhooks/livekit  (có chữ ký, Content-Type application/webhook+json, cần raw body)
        → VERIFY CHỮ KÝ (bắt buộc) — sai → 401
        → parse room name → meetingId
        → cập nhật MeetingParticipant (Mongo) — idempotent theo participant.sid
        → cập nhật presence (Redis) + peak ($max trong Mongo)
        → (bước Realtime gateway) phát event realtime qua Redis adapter
```

Event quan tâm: `participant_joined`, `participant_left`, `participant_connection_aborted` (xử lý như left), `room_finished` (chốt meeting — ADR-022). Chi tiết mã trả về / chống trùng: spec meeting §6.

§4, thêm cuối mục:
```
- **Dev (Docker Desktop Windows):** không có `network_mode: host` → map cổng 7880 / 7881 / 7882udp + `rtc.node_ip: 127.0.0.1`; chỉ thử được bằng trình duyệt trên cùng máy (spec meeting §3).
```

- [ ] **Step 6: Kiểm không còn chỗ mâu thuẫn**

```powershell
Select-String -Path docs/architecture/architecture.md, docs/PROJECT_CONTEXT.md, docs/architecture/webrtc.md, CLAUDE.md -Pattern 'ACTING_HOST|toLiveKitGrant|docs/adr|check rỗng'
```
Expected: không in gì.

- [ ] **Step 7: Progress + commit (khi user cho phép)**

Ghi mục Task 2 vào `docs/progress.md`. Rồi:
```powershell
git add CLAUDE.md docs/decisions.md docs/architecture/architecture.md docs/PROJECT_CONTEXT.md docs/architecture/webrtc.md docs/progress.md
git commit -m "docs: ADR-022 tự kết thúc meeting, bỏ ACTING_HOST, sửa tài liệu theo spec meeting" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: `MediaPort` + adapter LiveKit

Spec §3.2, §4.2, §4.3, §7.2. Chưa đăng ký vào module (Task 4 làm) → app vẫn khởi động như cũ.

**Files:**
- Create: `backend/src/modules/meetings/ports/media.port.ts`
- Create: `backend/src/modules/meetings/adapters/livekit-media.adapter.ts`
- Test: `backend/src/modules/meetings/adapters/livekit-media.adapter.spec.ts`
- Modify: `docs/progress.md`

**Interfaces:**
- Consumes: kết quả Task 1 Step 12 (hình dạng lỗi "không tìm thấy").
- Produces:
  - `MEDIA_PORT: symbol`; `interface MediaPort` (6 hàm — code Step 3); `type MediaEvent` (4 dạng — code Step 3).
  - `class LivekitMediaAdapter implements MediaPort` (constructor không tham số, kiểm env bằng Zod).
  - Hàm thuần export: `livekitEnvSchema`, `computeEndedAt(reason: number | undefined, createdAt: Date, timeoutSec: number): Date`, `isNotFound(err: unknown): boolean`, `toMediaEvent(e: LkWebhookEvent, timeoutSec: number): MediaEvent`.

- [ ] **Step 1: Viết test (fail)**

`backend/src/modules/meetings/adapters/livekit-media.adapter.spec.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { computeEndedAt, isNotFound, livekitEnvSchema, toMediaEvent } from './livekit-media.adapter.js';

// Object tự dựng — test KHÔNG đọc process.env (spec §3.2: npm test chạy được trên máy không có biến LiveKit)
const validEnv = {
  LIVEKIT_URL: 'http://livekit:7880',
  LIVEKIT_PUBLIC_URL: 'ws://localhost:7880',
  LIVEKIT_API_KEY: 'devkey',
  LIVEKIT_API_SECRET: 'x'.repeat(32),
  LIVEKIT_TOKEN_TTL_HOURS: '6',
  MEETING_AUTO_END_AFTER_MIN: '3',
};

describe('livekitEnvSchema', () => {
  it('đủ biến → hợp lệ, số được ép kiểu', () => {
    const r = livekitEnvSchema.safeParse(validEnv);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.LIVEKIT_TOKEN_TTL_HOURS).toBe(6);
      expect(r.data.MEETING_AUTO_END_AFTER_MIN).toBe(3);
    }
  });

  it('thiếu LIVEKIT_PUBLIC_URL → lỗi', () => {
    const { LIVEKIT_PUBLIC_URL: _omit, ...env } = validEnv;
    expect(livekitEnvSchema.safeParse(env).success).toBe(false);
  });

  it('secret ngắn hơn 32 ký tự → lỗi', () => {
    expect(livekitEnvSchema.safeParse({ ...validEnv, LIVEKIT_API_SECRET: 'ngan' }).success).toBe(false);
  });

  it('TTL 0 giờ → lỗi', () => {
    expect(livekitEnvSchema.safeParse({ ...validEnv, LIVEKIT_TOKEN_TTL_HOURS: '0' }).success).toBe(false);
  });
});

describe('computeEndedAt', () => {
  const createdAt = new Date('2026-10-05T08:00:00Z');

  it('room trống đủ thời gian (IDLE_TIMEOUT = 2) → lúc người cuối rời = createdAt − timeout', () => {
    expect(computeEndedAt(2, createdAt, 180)).toEqual(new Date('2026-10-05T07:57:00Z'));
  });

  it('room bị xoá bằng API (API_DELETE = 1) → giữ createdAt', () => {
    expect(computeEndedAt(1, createdAt, 180)).toEqual(createdAt);
  });

  it('không có roomEndReason (bản LiveKit cũ) → giữ createdAt', () => {
    expect(computeEndedAt(undefined, createdAt, 180)).toEqual(createdAt);
  });
});

describe('isNotFound', () => {
  it('lỗi "không tìm thấy" của LiveKit → true', () => {
    expect(isNotFound({ code: 'not_found' })).toBe(true);
    expect(isNotFound({ status: 404 })).toBe(true);
  });

  it('lỗi khác (timeout, mạng, 5xx) → false', () => {
    expect(isNotFound(new Error('fetch failed'))).toBe(false);
    expect(isNotFound({ status: 500 })).toBe(false);
    expect(isNotFound(undefined)).toBe(false);
  });
});

describe('toMediaEvent', () => {
  const base = { id: 'EV_1', createdAt: 1759651200n, room: { name: '6700000000000000000000aa' } };

  it('participant_joined → đủ userId, tên, sid, thời điểm từ createdAt (bigint, giây)', () => {
    const e = toMediaEvent(
      { ...base, event: 'participant_joined', participant: { identity: '6700000000000000000000bb', name: 'An', sid: 'PA_1' } },
      180,
    );
    expect(e).toEqual({
      type: 'participant_joined',
      eventId: 'EV_1',
      roomName: '6700000000000000000000aa',
      userId: '6700000000000000000000bb',
      displayName: 'An',
      sid: 'PA_1',
      at: new Date(1759651200 * 1000),
    });
  });

  it('participant_connection_aborted → xử lý như participant_left', () => {
    const e = toMediaEvent(
      { ...base, event: 'participant_connection_aborted', participant: { identity: 'u', sid: 'PA_2' } },
      180,
    );
    expect(e).toMatchObject({ type: 'participant_left', userId: 'u', sid: 'PA_2' });
  });

  it('room_finished vì trống → endedAt lùi lại timeout', () => {
    const e = toMediaEvent({ ...base, event: 'room_finished', roomEndReason: 2 }, 180);
    expect(e).toEqual({
      type: 'room_finished',
      eventId: 'EV_1',
      roomName: '6700000000000000000000aa',
      endedAt: new Date((1759651200 - 180) * 1000),
    });
  });

  it('event không quan tâm → ignored', () => {
    expect(toMediaEvent({ ...base, event: 'track_published' }, 180)).toEqual({
      type: 'ignored',
      eventId: 'EV_1',
      event: 'track_published',
    });
  });
});
```

- [ ] **Step 2: Chạy test — phải fail**

```powershell
Set-Location backend; npx vitest run src/modules/meetings/adapters; Set-Location ..
```
Expected: FAIL — `Failed to load url ./livekit-media.adapter.js` (file chưa có).

- [ ] **Step 3: Viết port**

`backend/src/modules/meetings/ports/media.port.ts`:
```ts
// Port "media": năng lực SFU mà nghiệp vụ meeting cần (ràng buộc 9 — tên theo năng lực, không theo vendor).
// MeetingsService chỉ biết interface này; LivekitMediaAdapter cài đặt nó; test dùng bản giả.
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

// Event webhook đã chuẩn hoá — không lộ kiểu của LiveKit ra ngoài adapter (spec §4.2)
export type MediaEvent =
  | { type: 'participant_joined'; eventId: string; roomName: string; userId: string; displayName: string; sid: string; at: Date }
  // gồm cả participant_connection_aborted (spec §6.3)
  | { type: 'participant_left'; eventId: string; roomName: string; userId: string; sid: string; at: Date }
  // endedAt adapter tính sẵn từ roomEndReason (spec §7.2)
  | { type: 'room_finished'; eventId: string; roomName: string; endedAt: Date }
  | { type: 'ignored'; eventId: string; event: string };
```

- [ ] **Step 4: Viết adapter**

`backend/src/modules/meetings/adapters/livekit-media.adapter.ts`:
```ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AccessToken, RoomServiceClient, WebhookReceiver } from 'livekit-server-sdk';
import { z } from 'zod';
import type { MediaEvent, MediaPort } from '../ports/media.port.js';

// Biến môi trường LiveKit (spec §3.2). Kiểm trong constructor = lúc app khởi động, KHÔNG lúc import file
export const livekitEnvSchema = z.object({
  LIVEKIT_URL: z.string().url(), // gọi API LiveKit (nội bộ)
  LIVEKIT_PUBLIC_URL: z.string().url(), // trả cho trình duyệt
  LIVEKIT_API_KEY: z.string().min(1),
  LIVEKIT_API_SECRET: z.string().min(32),
  LIVEKIT_TOKEN_TTL_HOURS: z.coerce.number().int().min(1).max(24),
  MEETING_AUTO_END_AFTER_MIN: z.coerce.number().int().min(1).max(60),
});

// Mọi thành viên cùng quyền media (role.md). canPublishData: false → app data đi Socket.IO, không qua LiveKit (P2)
const MEMBER_GRANT = { roomJoin: true, canPublish: true, canSubscribe: true, canPublishData: false };

// RoomEndReason.ROOM_END_IDLE_TIMEOUT trong livekit_models.proto — room trống đủ emptyTimeout / departureTimeout
const ROOM_END_IDLE_TIMEOUT = 2;

// Lúc meeting thật sự hết người khi LiveKit báo room_finished (spec §7.2)
export function computeEndedAt(reason: number | undefined, createdAt: Date, timeoutSec: number): Date {
  if (reason === ROOM_END_IDLE_TIMEOUT) {
    return new Date(createdAt.getTime() - timeoutSec * 1000);
  }
  return createdAt;
}

// Lỗi "không tìm thấy" của LiveKit API (room / người không tồn tại) — hình dạng đo ở Task 1 Step 12
export function isNotFound(err: unknown): boolean {
  const e = err as { code?: unknown; status?: unknown } | undefined;
  return e?.code === 'not_found' || e?.status === 404;
}

// Phần webhook LiveKit mà adapter đọc. createdAt là số giây (protobuf int64 → bigint ở SDK)
export type LkWebhookEvent = {
  id?: string;
  event?: string;
  createdAt?: number | bigint;
  room?: { name?: string };
  participant?: { identity?: string; name?: string; sid?: string };
  roomEndReason?: number;
};

// Chuyển webhook LiveKit → MediaEvent trung lập (service không biết kiểu của LiveKit)
export function toMediaEvent(e: LkWebhookEvent, timeoutSec: number): MediaEvent {
  const eventId = e.id ?? '';
  const roomName = e.room?.name ?? '';
  const at = new Date(Number(e.createdAt ?? 0) * 1000);
  const p = e.participant;

  switch (e.event) {
    case 'participant_joined':
      return {
        type: 'participant_joined',
        eventId,
        roomName,
        userId: p?.identity ?? '',
        displayName: p?.name ?? '',
        sid: p?.sid ?? '',
        at,
      };
    // LiveKit gửi left HOẶC connection_aborted cho một kết nối, không gửi cả hai (spec §6.3)
    case 'participant_left':
    case 'participant_connection_aborted':
      return { type: 'participant_left', eventId, roomName, userId: p?.identity ?? '', sid: p?.sid ?? '', at };
    case 'room_finished':
      return { type: 'room_finished', eventId, roomName, endedAt: computeEndedAt(e.roomEndReason, at, timeoutSec) };
    default:
      return { type: 'ignored', eventId, event: e.event ?? '' };
  }
}

@Injectable()
export class LivekitMediaAdapter implements MediaPort {
  private readonly env: z.infer<typeof livekitEnvSchema>;
  private readonly rooms: RoomServiceClient;
  private readonly webhooks: WebhookReceiver;
  private readonly timeoutSec: number;

  constructor() {
    const parsed = livekitEnvSchema.safeParse(process.env);
    if (!parsed.success) {
      // Fail-fast (PROJECT_CONTEXT §14): thiếu / sai biến → app không khởi động
      const detail = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
      throw new Error(`Biến môi trường LiveKit không hợp lệ — ${detail}`);
    }
    this.env = parsed.data;
    this.rooms = new RoomServiceClient(this.env.LIVEKIT_URL, this.env.LIVEKIT_API_KEY, this.env.LIVEKIT_API_SECRET);
    this.webhooks = new WebhookReceiver(this.env.LIVEKIT_API_KEY, this.env.LIVEKIT_API_SECRET);
    this.timeoutSec = this.env.MEETING_AUTO_END_AFTER_MIN * 60;
  }

  async createRoom(roomName: string) {
    // Trống đủ timeout → LiveKit tự đóng room, gửi room_finished (ADR-022)
    await this.rooms.createRoom({ name: roomName, emptyTimeout: this.timeoutSec, departureTimeout: this.timeoutSec });
  }

  async roomExists(roomName: string) {
    // Lỗi KHÔNG đổi thành false — ném ra để service trả 502, không chốt nhầm meeting đang chạy (spec §4.2)
    const rooms = await this.rooms.listRooms([roomName]);
    return rooms.length > 0;
  }

  async closeRoom(roomName: string) {
    try {
      await this.rooms.deleteRoom(roomName);
    } catch (err) {
      if (!isNotFound(err)) throw err;
    }
  }

  async removeParticipant(roomName: string, userId: string) {
    try {
      await this.rooms.removeParticipant(roomName, userId);
    } catch (err) {
      if (!isNotFound(err)) throw err;
    }
  }

  async createJoinToken({ roomName, userId, displayName }: { roomName: string; userId: string; displayName: string }) {
    // identity = userId → mở tab thứ 2 thì LiveKit đá tab cũ (DUPLICATE_IDENTITY) — hành vi mong muốn
    const at = new AccessToken(this.env.LIVEKIT_API_KEY, this.env.LIVEKIT_API_SECRET, {
      identity: userId,
      name: displayName,
      ttl: `${this.env.LIVEKIT_TOKEN_TTL_HOURS}h`,
    });
    at.addGrant({ ...MEMBER_GRANT, room: roomName });
    return { token: await at.toJwt(), url: this.env.LIVEKIT_PUBLIC_URL };
  }

  async parseWebhook(rawBody: string, authHeader: string | undefined): Promise<MediaEvent> {
    let event;
    try {
      // Verify chữ ký: header Authorization là JWT chứa sha256 của raw body
      event = await this.webhooks.receive(rawBody, authHeader);
    } catch {
      throw new UnauthorizedException('Chữ ký webhook không hợp lệ');
    }
    return toMediaEvent(event, this.timeoutSec);
  }
}
```

Nếu Task 1 Step 12 ghi `RoomServiceClient` có tuỳ chọn timeout request: truyền tham số thứ 4 `{ <tên tuỳ chọn>: 5 }` (đơn vị theo `.d.ts`) để `roomExists` không treo lâu. Nếu `createRoom` báo lỗi type `departureTimeout` → bản SDK quá cũ: nâng SDK (`npm install livekit-server-sdk@latest --legacy-peer-deps`), ghi progress.

- [ ] **Step 5: Chạy test — phải pass**

```powershell
Set-Location backend; npx vitest run src/modules/meetings/adapters; npm test; npm run build; Set-Location ..
```
Expected: adapter spec **13 passed**; toàn bộ `75 passed`; build exit 0. Nếu TS báo `toMediaEvent(event, …)` không gán được kiểu (SDK đổi tên field) → sửa `LkWebhookEvent` cho khớp `.d.ts` của SDK, không ép `as any`.

- [ ] **Step 6: Progress + commit (khi user cho phép)**

```powershell
git add backend/src/modules/meetings/ports backend/src/modules/meetings/adapters docs/progress.md
git commit -m "feat: MediaPort và adapter LiveKit (token, room, webhook)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 4: `MeetingsService` — bắt đầu, lịch sử, `endMeeting` / `finalize`

Spec §5.1, §5.2 (POST + GET), §7.1, §9.1, §9.5. Đăng ký adapter vào module → từ task này app **cần** 6 biến LiveKit (Task 1 đã đặt).

**Files:**
- Create: `backend/src/modules/meetings/meetings.service.ts`
- Test: `backend/src/modules/meetings/meetings.service.spec.ts`
- Create: `backend/src/modules/meetings/meetings.controller.ts`
- Create: `backend/src/modules/meetings/dto/start-meeting.dto.ts`, `backend/src/modules/meetings/dto/list-meetings-query.dto.ts`
- Modify: `backend/src/modules/meetings/meetings.module.ts`
- Modify: `docs/api/endpoint.md`, `docs/progress.md`

**Interfaces:**
- Consumes: `MEDIA_PORT`, `MediaPort`, `LivekitMediaAdapter` (Task 3); `RoomAccessService.assertRoomAccess / assertRoomPermission` (có sẵn); `RoomAction.MANAGE_MEETING` (có sẵn).
- Produces:
  - `toMeetingResponse(m)` → `{ id, roomId, title, status, createdBy, startedAt, endedAt, endReason, peakParticipants, totalParticipants, messageCount, durationSeconds }`.
  - `MeetingsService` constructor `(meetingModel, participantModel, roomModel, access, redis, media)` — **thứ tự này** dùng trong mọi test.
  - `startMeeting(userId: string, roomId: string, dto: StartMeetingDto): Promise<MeetingResponse>`
  - `listMeetings(userId: string, roomId: string, page: number, limit: number): Promise<{ items, page, limit, hasMore }>`
  - `endMeeting(meetingId: string, reason: EndReason, endedAt: Date, endedBy?: string | null): Promise<void>` — public, Task 5–7 dùng.
  - private: `finalize(meetingId)`, `systemEndReason(roomId): Promise<EndReason>`, `viaMedia<T>(call): Promise<T>` (lỗi LiveKit → 502).
  - `MeetingsModule` export `MeetingsService` (Task 7 dùng).

- [ ] **Step 1: Viết test (fail)**

`backend/src/modules/meetings/meetings.service.spec.ts`:
```ts
import { describe, it, expect, vi } from 'vitest';
import { BadGatewayException, ConflictException, ForbiddenException } from '@nestjs/common';
import { Types } from 'mongoose';
import { MeetingsService } from './meetings.service.js';
import { EndReason, MeetingStatus, RoomRole, RoomStatus } from '../../shared/enums.js';

// Query Mongoose giả: lean/sort/skip/limit/select nối chuỗi, exec() trả result
function query(result: unknown) {
  const chain: any = {
    lean: vi.fn(() => chain),
    sort: vi.fn(() => chain),
    skip: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    select: vi.fn(() => chain),
    exec: vi.fn().mockResolvedValue(result),
  };
  return chain;
}

// Query giả mà exec() lỗi — giả Mongo sập / lỗi trùng
function failingQuery(err: Error) {
  const chain: any = query(null);
  chain.exec = vi.fn().mockRejectedValue(err);
  return chain;
}

// vi.fn trả về query giả; nhận mọi tham số để test đọc lại bằng mock.calls
const q = (result: unknown) => vi.fn((..._args: any[]) => query(result));

const userId = new Types.ObjectId().toString();
const roomId = new Types.ObjectId().toString();
const meetingId = new Types.ObjectId().toString();

function fakeMeeting(overrides: Record<string, unknown> = {}) {
  return {
    _id: new Types.ObjectId(meetingId),
    roomId: new Types.ObjectId(roomId),
    title: 'Buổi học 05/10 14:00',
    status: MeetingStatus.ACTIVE,
    createdBy: new Types.ObjectId(userId),
    startedAt: new Date('2026-10-05T07:00:00Z'),
    endedAt: null,
    endedBy: null,
    endReason: null,
    peakParticipants: 0,
    totalParticipants: 0,
    messageCount: 0,
    durationSeconds: 0,
    ...overrides,
  };
}

function build() {
  const meetingModel = {
    create: vi.fn(),
    findOne: q(null),
    findById: q(null),
    find: q([]),
    updateOne: q({ modifiedCount: 1 }),
  };
  const participantModel = {
    find: q([]),
    updateOne: q({ modifiedCount: 1 }),
    updateMany: q({ modifiedCount: 0 }),
    exists: q(null),
  };
  // Mặc định phòng còn ACTIVE → hệ thống tự kết thúc với AUTO_EMPTY
  const roomModel = {
    findById: q({ status: RoomStatus.ACTIVE }),
    updateOne: q({ modifiedCount: 1 }),
  };
  // Mặc định: là thành viên thường, và có quyền HOST khi hỏi assertRoomPermission
  const access = {
    assertRoomAccess: vi.fn().mockResolvedValue({ role: RoomRole.MEMBER }),
    assertRoomPermission: vi.fn().mockResolvedValue({ role: RoomRole.HOST }),
  };
  const redis = {
    sadd: vi.fn().mockResolvedValue(1),
    srem: vi.fn().mockResolvedValue(1),
    scard: vi.fn().mockResolvedValue(1),
    expire: vi.fn().mockResolvedValue(true),
    del: vi.fn().mockResolvedValue(1),
  };
  // MediaPort giả — không cần LiveKit thật. Mặc định room LiveKit còn tồn tại
  const media = {
    createRoom: vi.fn().mockResolvedValue(undefined),
    roomExists: vi.fn().mockResolvedValue(true),
    closeRoom: vi.fn().mockResolvedValue(undefined),
    removeParticipant: vi.fn().mockResolvedValue(undefined),
    createJoinToken: vi.fn().mockResolvedValue({ token: 'lk-token', url: 'ws://localhost:7880' }),
    parseWebhook: vi.fn(),
  };
  const service = new MeetingsService(
    meetingModel as any,
    participantModel as any,
    roomModel as any,
    access as any,
    redis as any,
    media as any,
  );
  return { service, meetingModel, participantModel, roomModel, access, redis, media };
}

// Lỗi trùng unique index của Mongo
const duplicateKeyError = () => Object.assign(new Error('E11000 duplicate key'), { code: 11000 });

describe('startMeeting', () => {
  const dto = { title: 'Buổi học 05/10 14:00' };

  it('không phải HOST → 403, không gọi LiveKit', async () => {
    const { service, access, media } = build();
    access.assertRoomPermission.mockRejectedValue(new ForbiddenException());

    await expect(service.startMeeting(userId, roomId, dto)).rejects.toBeInstanceOf(ForbiddenException);
    expect(media.createRoom).not.toHaveBeenCalled();
  });

  it('đang có meeting ACTIVE và room LiveKit còn → 409, không tạo mới', async () => {
    const { service, meetingModel, media } = build();
    meetingModel.findOne.mockReturnValue(query(fakeMeeting()));

    await expect(service.startMeeting(userId, roomId, dto)).rejects.toBeInstanceOf(ConflictException);
    expect(media.roomExists).toHaveBeenCalledWith(meetingId);
    expect(media.createRoom).not.toHaveBeenCalled();
    expect(meetingModel.create).not.toHaveBeenCalled();
  });

  it('meeting ACTIVE nhưng room LiveKit đã đóng (mất room_finished) → chốt AUTO_EMPTY rồi tạo mới', async () => {
    const { service, meetingModel, media } = build();
    const old = fakeMeeting();
    meetingModel.findOne.mockReturnValue(query(old));
    meetingModel.findById.mockReturnValue(query(old));
    media.roomExists.mockResolvedValue(false);
    meetingModel.create.mockResolvedValue(fakeMeeting({ _id: new Types.ObjectId() }));

    await service.startMeeting(userId, roomId, dto);

    expect(meetingModel.updateOne).toHaveBeenCalledWith(
      { _id: meetingId, status: MeetingStatus.ACTIVE },
      { $set: expect.objectContaining({ status: MeetingStatus.ENDED, endReason: EndReason.AUTO_EMPTY }) },
    );
    expect(meetingModel.create).toHaveBeenCalled();
  });

  it('không hỏi được LiveKit → 502, không chốt meeting cũ, không tạo mới', async () => {
    const { service, meetingModel, media } = build();
    meetingModel.findOne.mockReturnValue(query(fakeMeeting()));
    media.roomExists.mockRejectedValue(new Error('fetch failed'));

    await expect(service.startMeeting(userId, roomId, dto)).rejects.toBeInstanceOf(BadGatewayException);
    expect(meetingModel.updateOne).not.toHaveBeenCalled();
    expect(media.createRoom).not.toHaveBeenCalled();
    expect(meetingModel.create).not.toHaveBeenCalled();
  });

  it('tạo room LiveKit TRƯỚC rồi mới ghi Mongo, cùng một id', async () => {
    const { service, meetingModel, media } = build();
    meetingModel.create.mockResolvedValue(fakeMeeting());

    await service.startMeeting(userId, roomId, dto);

    const roomName = media.createRoom.mock.calls[0][0];
    expect(String(meetingModel.create.mock.calls[0][0]._id)).toBe(roomName);
    expect(meetingModel.create).toHaveBeenCalledWith(
      expect.objectContaining({ roomId, title: dto.title, createdBy: userId }),
    );
    expect(media.createRoom.mock.invocationCallOrder[0]).toBeLessThan(meetingModel.create.mock.invocationCallOrder[0]);
  });

  it('createRoom lỗi → 502, Mongo chưa ghi gì', async () => {
    const { service, meetingModel, media } = build();
    media.createRoom.mockRejectedValue(new Error('fetch failed'));

    await expect(service.startMeeting(userId, roomId, dto)).rejects.toBeInstanceOf(BadGatewayException);
    expect(meetingModel.create).not.toHaveBeenCalled();
  });

  it('Mongo báo trùng (bấm 2 lần) → đóng room LiveKit vừa tạo, 409', async () => {
    const { service, meetingModel, roomModel, media } = build();
    meetingModel.create.mockRejectedValue(duplicateKeyError());

    await expect(service.startMeeting(userId, roomId, dto)).rejects.toBeInstanceOf(ConflictException);
    expect(media.closeRoom).toHaveBeenCalledWith(media.createRoom.mock.calls[0][0]);
    expect(roomModel.updateOne).not.toHaveBeenCalled();
  });

  it('thành công → kiểm quyền MANAGE_MEETING, $inc meetingCount, response có id không có _id', async () => {
    const { service, meetingModel, roomModel, access } = build();
    const created = fakeMeeting();
    meetingModel.create.mockResolvedValue(created);

    const res = await service.startMeeting(userId, roomId, dto);

    expect(access.assertRoomPermission).toHaveBeenCalledWith(userId, roomId, 'MANAGE_MEETING');
    expect(roomModel.updateOne).toHaveBeenCalledWith({ _id: roomId }, { $inc: { meetingCount: 1 } });
    expect(res).toMatchObject({ id: meetingId, roomId, title: created.title, status: MeetingStatus.ACTIVE });
    expect(res).not.toHaveProperty('_id');
  });
});

describe('listMeetings', () => {
  it('không phải thành viên → 403', async () => {
    const { service, access } = build();
    access.assertRoomAccess.mockRejectedValue(new ForbiddenException());

    await expect(service.listMeetings(userId, roomId, 1, 20)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('mới nhất trước, lấy dư 1 bản ghi để biết còn trang sau', async () => {
    const { service, meetingModel } = build();
    const rows = [fakeMeeting(), fakeMeeting({ _id: new Types.ObjectId() }), fakeMeeting({ _id: new Types.ObjectId() })];
    const chain = query(rows);
    meetingModel.find.mockReturnValue(chain);

    const res = await service.listMeetings(userId, roomId, 2, 2);

    expect(meetingModel.find).toHaveBeenCalledWith({ roomId });
    expect(chain.sort).toHaveBeenCalledWith({ startedAt: -1 });
    expect(chain.skip).toHaveBeenCalledWith(2);
    expect(chain.limit).toHaveBeenCalledWith(3);
    expect(res.items).toHaveLength(2);
    expect(res).toMatchObject({ page: 2, limit: 2, hasMore: true });
  });
});

describe('endMeeting', () => {
  const startedAt = new Date('2026-10-05T07:00:00Z');
  const endedAt = new Date('2026-10-05T07:30:00Z');

  it('ACTIVE → ENDED bằng update có điều kiện, rồi tính lại thống kê từ dữ liệu', async () => {
    const { service, meetingModel, participantModel, redis } = build();
    meetingModel.findById
      .mockReturnValueOnce(query(fakeMeeting({ startedAt })))
      .mockReturnValueOnce(query(fakeMeeting({ startedAt, status: MeetingStatus.ENDED, endedAt })));
    const pId = new Types.ObjectId();
    participantModel.find.mockReturnValue(
      query([
        {
          _id: pId,
          sessions: [
            { sid: 'PA_1', joinedAt: new Date('2026-10-05T07:00:00Z'), leftAt: new Date('2026-10-05T07:10:00Z') },
            { sid: 'PA_2', joinedAt: new Date('2026-10-05T07:20:00Z'), leftAt: null },
          ],
        },
      ]),
    );

    await service.endMeeting(meetingId, EndReason.HOST_ENDED, endedAt, userId);

    expect(meetingModel.updateOne).toHaveBeenCalledWith(
      { _id: meetingId, status: MeetingStatus.ACTIVE },
      { $set: { status: MeetingStatus.ENDED, endedAt, endedBy: userId, endReason: EndReason.HOST_ENDED } },
    );
    // Session còn mở đóng bằng endedAt — atomic, không đè leftAt thật
    expect(participantModel.updateMany).toHaveBeenCalledWith(
      { meetingId },
      { $set: { 'sessions.$[s].leftAt': endedAt } },
      { arrayFilters: [{ 's.leftAt': null }] },
    );
    // 10 phút + 10 phút (session 2 tính tới endedAt)
    expect(participantModel.updateOne).toHaveBeenCalledWith({ _id: pId }, { $set: { totalDurationSeconds: 1200 } });
    expect(meetingModel.updateOne).toHaveBeenCalledWith(
      { _id: meetingId },
      { $set: { totalParticipants: 1, durationSeconds: 1800 } },
    );
    expect(redis.del).toHaveBeenCalledWith(`presence:${meetingId}`);
  });

  it('endedAt sớm hơn startedAt → lấy startedAt', async () => {
    const { service, meetingModel } = build();
    meetingModel.findById.mockReturnValue(query(fakeMeeting({ startedAt })));

    await service.endMeeting(meetingId, EndReason.AUTO_EMPTY, new Date('2026-10-05T06:58:00Z'));

    expect(meetingModel.updateOne).toHaveBeenCalledWith(
      { _id: meetingId, status: MeetingStatus.ACTIVE },
      { $set: expect.objectContaining({ endedAt: startedAt, endedBy: null }) },
    );
  });

  it('meeting đã ENDED → update có điều kiện không ghi đè, nhưng finalize vẫn chạy lại', async () => {
    const { service, meetingModel, redis } = build();
    meetingModel.findById.mockReturnValue(query(fakeMeeting({ startedAt, status: MeetingStatus.ENDED, endedAt })));

    await service.endMeeting(meetingId, EndReason.AUTO_EMPTY, new Date('2026-10-05T08:00:00Z'));

    expect(meetingModel.updateOne).toHaveBeenCalledWith(
      { _id: meetingId, status: MeetingStatus.ACTIVE },
      expect.anything(),
    );
    expect(meetingModel.updateOne).toHaveBeenCalledWith(
      { _id: meetingId },
      { $set: { totalParticipants: 0, durationSeconds: 1800 } },
    );
    expect(redis.del).toHaveBeenCalledWith(`presence:${meetingId}`);
  });

  it('session vào sau lúc kết thúc (chạy song song với HOST kết thúc) → thời lượng 0, không âm', async () => {
    const { service, meetingModel, participantModel } = build();
    meetingModel.findById.mockReturnValue(query(fakeMeeting({ startedAt, status: MeetingStatus.ENDED, endedAt })));
    const pId = new Types.ObjectId();
    participantModel.find.mockReturnValue(
      query([{ _id: pId, sessions: [{ sid: 'PA_9', joinedAt: new Date('2026-10-05T07:30:05Z'), leftAt: null }] }]),
    );

    await service.endMeeting(meetingId, EndReason.HOST_ENDED, endedAt);

    expect(participantModel.updateOne).toHaveBeenCalledWith({ _id: pId }, { $set: { totalDurationSeconds: 0 } });
  });

  it('không có meeting → không ghi gì', async () => {
    const { service, meetingModel, redis } = build();

    await service.endMeeting(meetingId, EndReason.HOST_ENDED, endedAt);

    expect(meetingModel.updateOne).not.toHaveBeenCalled();
    expect(redis.del).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Chạy test — phải fail**

```powershell
Set-Location backend; npx vitest run src/modules/meetings/meetings.service.spec.ts; Set-Location ..
```
Expected: FAIL — `Failed to load url ./meetings.service.js`.

- [ ] **Step 3: DTO**

`backend/src/modules/meetings/dto/start-meeting.dto.ts`:
```ts
import { Transform } from 'class-transformer';
import { IsString, MaxLength, MinLength } from 'class-validator';

// Bỏ khoảng trắng 2 đầu trước khi validate (tên toàn dấu cách = rỗng)
const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class StartMeetingDto {
  // Bắt buộc. Frontend điền sẵn "Buổi học dd/MM HH:mm" theo giờ trình duyệt → backend không xử lý múi giờ (spec §5.2)
  @Transform(trim)
  @IsString()
  @MinLength(1, { message: 'Tên buổi học không được để trống' })
  @MaxLength(100, { message: 'Tên buổi học tối đa 100 ký tự' })
  title!: string;
}
```

`backend/src/modules/meetings/dto/list-meetings-query.dto.ts`:
```ts
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

// Cùng ràng buộc với GET /rooms
export class ListMeetingsQueryDto {
  // Chặn trên để $skip không vượt số nguyên 64-bit của Mongo
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit: number = 20;
}
```

- [ ] **Step 4: Viết service**

`backend/src/modules/meetings/meetings.service.ts`:
```ts
import { BadGatewayException, ConflictException, Inject, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Meeting } from './schemas/meeting.schema.js';
import type { MeetingDocument } from './schemas/meeting.schema.js';
import { MeetingParticipant } from './schemas/meeting-participant.schema.js';
import type { MeetingParticipantDocument } from './schemas/meeting-participant.schema.js';
import { Room } from '../rooms/schemas/room.schema.js';
import type { RoomDocument } from '../rooms/schemas/room.schema.js';
import { RoomAccessService } from '../room-members/room-access.service.js';
import { RedisService } from '../../common/services/redis.service.js';
import { MEDIA_PORT } from './ports/media.port.js';
import type { MediaPort } from './ports/media.port.js';
import { EndReason, MeetingStatus, RoomStatus } from '../../shared/enums.js';
import { RoomAction } from '../../shared/permissions.js';
import { StartMeetingDto } from './dto/start-meeting.dto.js';

// Lỗi trùng unique index của Mongo
function isDuplicateKey(err: unknown): boolean {
  return (err as { code?: number })?.code === 11000;
}

// Số giây giữa 2 mốc, không âm (session vào sau lúc kết thúc → 0)
function secondsBetween(from: Date, to: Date): number {
  return Math.max(0, Math.floor((new Date(to).getTime() - new Date(from).getTime()) / 1000));
}

// Meeting đọc từ Mongo (document hoặc object lean)
type MeetingLike = {
  _id: unknown;
  roomId: unknown;
  title: string;
  status: MeetingStatus;
  createdBy: unknown;
  startedAt?: Date;
  endedAt?: Date | null;
  endReason?: EndReason | null;
  peakParticipants?: number;
  totalParticipants?: number;
  messageCount?: number;
  durationSeconds?: number;
};

export type MeetingResponse = ReturnType<typeof toMeetingResponse>;

// Map document → response: id thay cho _id (ràng buộc 2)
export function toMeetingResponse(m: MeetingLike) {
  return {
    id: String(m._id),
    roomId: String(m.roomId),
    title: m.title,
    status: m.status,
    createdBy: String(m.createdBy),
    startedAt: m.startedAt,
    endedAt: m.endedAt ?? null,
    endReason: m.endReason ?? null,
    peakParticipants: m.peakParticipants ?? 0,
    totalParticipants: m.totalParticipants ?? 0,
    messageCount: m.messageCount ?? 0,
    durationSeconds: m.durationSeconds ?? 0,
  };
}

@Injectable()
export class MeetingsService {
  private readonly logger = new Logger(MeetingsService.name);

  constructor(
    @InjectModel(Meeting.name) private meetingModel: Model<MeetingDocument>,
    @InjectModel(MeetingParticipant.name) private participantModel: Model<MeetingParticipantDocument>,
    @InjectModel(Room.name) private roomModel: Model<RoomDocument>,
    private access: RoomAccessService,
    private redis: RedisService,
    @Inject(MEDIA_PORT) private media: MediaPort,
  ) {}

  // POST /rooms/:roomId/meetings — chỉ HOST (spec §5.2)
  async startMeeting(userId: string, roomId: string, dto: StartMeetingDto) {
    await this.access.assertRoomPermission(userId, roomId, RoomAction.MANAGE_MEETING);

    // Đã có meeting ACTIVE: room LiveKit còn → 409; room đã đóng (mất room_finished) → tự hồi phục (spec §9.1).
    // Không hỏi được LiveKit → viaMedia ném 502, không chốt gì
    const active = await this.meetingModel.findOne({ roomId, status: MeetingStatus.ACTIVE }).lean().exec();
    if (active) {
      const activeId = String(active._id);
      if (await this.viaMedia(() => this.media.roomExists(activeId))) {
        throw new ConflictException('Phòng đang có buổi học diễn ra');
      }
      await this.endMeeting(activeId, await this.systemEndReason(roomId), new Date());
    }

    // LiveKit TRƯỚC, Mongo sau → không bao giờ có meeting ACTIVE mà chưa có room LiveKit (spec §5.2)
    const meetingId = new Types.ObjectId();
    await this.viaMedia(() => this.media.createRoom(String(meetingId)));

    let meeting;
    try {
      meeting = await this.meetingModel.create({ _id: meetingId, roomId, title: dto.title, createdBy: userId });
    } catch (err) {
      // Room LiveKit vừa tạo bị thừa → đóng. Đóng cũng lỗi thì room trống tự đóng sau emptyTimeout
      await this.media
        .closeRoom(String(meetingId))
        .catch((closeErr) => this.logger.warn(`Không đóng được room LiveKit thừa ${String(meetingId)}: ${closeErr}`));
      // Unique partial index "1 meeting ACTIVE / room" báo trùng (bấm 2 lần / 2 request cùng lúc)
      if (isDuplicateKey(err)) throw new ConflictException('Phòng đang có buổi học diễn ra');
      throw err;
    }

    await this.roomModel.updateOne({ _id: roomId }, { $inc: { meetingCount: 1 } }).exec();
    return toMeetingResponse(meeting);
  }

  // GET /rooms/:roomId/meetings — lịch sử, mới nhất trước. Chỉ thành viên
  async listMeetings(userId: string, roomId: string, page: number, limit: number) {
    await this.access.assertRoomAccess(userId, roomId);
    const rows = await this.meetingModel
      .find({ roomId })
      .sort({ startedAt: -1 })
      .skip((page - 1) * limit)
      // Lấy dư 1 bản ghi để biết còn trang sau, khỏi phải đếm tổng
      .limit(limit + 1)
      .lean()
      .exec();
    return {
      items: rows.slice(0, limit).map(toMeetingResponse),
      page,
      limit,
      hasMore: rows.length > limit,
    };
  }

  // Kết thúc meeting — dùng chung cho HOST kết thúc, giải tán phòng, room_finished, tự hồi phục (spec §7.1).
  // Chạy lại bao nhiêu lần cũng ra cùng kết quả
  async endMeeting(meetingId: string, reason: EndReason, endedAt: Date, endedBy: string | null = null) {
    const meeting = await this.meetingModel.findById(meetingId).lean().exec();
    if (!meeting) return;

    // Không cho endedAt sớm hơn lúc bắt đầu (vd room_finished của meeting chưa ai vào)
    const startedAt = meeting.startedAt ?? endedAt;
    const at = endedAt.getTime() < new Date(startedAt).getTime() ? startedAt : endedAt;

    // Điều kiện status ACTIVE: meeting đã kết thúc thì KHÔNG ghi đè endedAt / endReason
    await this.meetingModel
      .updateOne(
        { _id: meetingId, status: MeetingStatus.ACTIVE },
        { $set: { status: MeetingStatus.ENDED, endedAt: at, endedBy, endReason: reason } },
      )
      .exec();

    // Vẫn chạy kể cả khi update không khớp → sửa được lần finalize trước bị dở
    await this.finalize(meetingId);
  }

  // Tính lại thống kê từ dữ liệu — idempotent (spec §7.1)
  private async finalize(meetingId: string) {
    const meeting = await this.meetingModel.findById(meetingId).lean().exec();
    if (!meeting?.endedAt) return;
    const endedAt = meeting.endedAt;

    // Đóng session còn mở (mất participant_left / người còn trong call lúc kết thúc). Atomic, không đè leftAt thật
    await this.participantModel
      .updateMany({ meetingId }, { $set: { 'sessions.$[s].leftAt': endedAt } }, { arrayFilters: [{ 's.leftAt': null }] })
      .exec();

    // Tổng thời gian từng người — mỗi meeting chỉ vài chục document
    const participants = await this.participantModel.find({ meetingId }).lean().exec();
    for (const p of participants) {
      const total = (p.sessions ?? []).reduce((sum, s) => sum + secondsBetween(s.joinedAt, s.leftAt ?? endedAt), 0);
      await this.participantModel.updateOne({ _id: p._id }, { $set: { totalDurationSeconds: total } }).exec();
    }

    // Unique {meetingId, userId} → số document = số người khác nhau đã vào
    await this.meetingModel
      .updateOne(
        { _id: meetingId },
        {
          $set: {
            totalParticipants: participants.length,
            durationSeconds: secondsBetween(meeting.startedAt ?? endedAt, endedAt),
          },
        },
      )
      .exec();

    await this.redis.del(`presence:${meetingId}`);
  }

  // Lý do khi hệ thống tự kết thúc (room_finished / tự hồi phục): phòng đã giải tán → ROOM_DISSOLVED, còn lại AUTO_EMPTY
  private async systemEndReason(roomId: unknown): Promise<EndReason> {
    const room = await this.roomModel.findById(roomId).select('status').lean().exec();
    return room?.status === RoomStatus.DISSOLVED ? EndReason.ROOM_DISSOLVED : EndReason.AUTO_EMPTY;
  }

  // Gọi LiveKit; lỗi (timeout, mạng, 5xx) → 502, không đổi trạng thái gì (spec §4.2)
  private async viaMedia<T>(call: () => Promise<T>): Promise<T> {
    try {
      return await call();
    } catch (err) {
      this.logger.error(`Gọi media server lỗi: ${err}`);
      throw new BadGatewayException('Không kết nối được máy chủ media');
    }
  }
}
```

- [ ] **Step 5: Chạy test — phải pass**

```powershell
Set-Location backend; npx vitest run src/modules/meetings/meetings.service.spec.ts; Set-Location ..
```
Expected: **15 passed**.

- [ ] **Step 6: Controller + module**

`backend/src/modules/meetings/meetings.controller.ts`:
```ts
import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { MeetingsService } from './meetings.service.js';
import { StartMeetingDto } from './dto/start-meeting.dto.js';
import { ListMeetingsQueryDto } from './dto/list-meetings-query.dto.js';

// Mọi route meeting đều cần đăng nhập (ADR-008).
// req.user là document User (JwtStrategy.validate) → dùng req.user.id, req.user.displayName
@UseGuards(JwtAuthGuard)
@Controller()
export class MeetingsController {
  constructor(private meetings: MeetingsService) {}

  // POST /rooms/:roomId/meetings  { title } — HOST bắt đầu buổi học
  @Post('rooms/:roomId/meetings')
  start(@Req() req: any, @Param('roomId') roomId: string, @Body() dto: StartMeetingDto) {
    return this.meetings.startMeeting(req.user.id, roomId, dto);
  }

  // GET /rooms/:roomId/meetings?page=1&limit=20 — lịch sử buổi học của phòng
  @Get('rooms/:roomId/meetings')
  list(@Req() req: any, @Param('roomId') roomId: string, @Query() query: ListMeetingsQueryDto) {
    return this.meetings.listMeetings(req.user.id, roomId, query.page, query.limit);
  }
}
```

Thay toàn bộ `backend/src/modules/meetings/meetings.module.ts`:
```ts
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PassportModule } from '@nestjs/passport';
import { Meeting, MeetingSchema } from './schemas/meeting.schema.js';
import { MeetingParticipant, MeetingParticipantSchema } from './schemas/meeting-participant.schema.js';
import { Room, RoomSchema } from '../rooms/schemas/room.schema.js';
import { RoomMembersModule } from '../room-members/room-members.module.js';
import { MeetingsController } from './meetings.controller.js';
import { MeetingsService } from './meetings.service.js';
import { MEDIA_PORT } from './ports/media.port.js';
import { LivekitMediaAdapter } from './adapters/livekit-media.adapter.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Meeting.name, schema: MeetingSchema },
      { name: MeetingParticipant.name, schema: MeetingParticipantSchema },
      // Room: $inc meetingCount, đọc status khi hệ thống tự kết thúc meeting
      { name: Room.name, schema: RoomSchema },
    ]),
    // RoomAccessService để kiểm quyền
    RoomMembersModule,
    // JwtAuthGuard cần AuthModuleOptions trong module dùng nó (bài học Task 10 module room)
    PassportModule.register({ session: false }),
  ],
  controllers: [MeetingsController],
  // Port "media" cài bằng LiveKit — đổi vendor chỉ đổi useClass (ràng buộc 9)
  providers: [MeetingsService, { provide: MEDIA_PORT, useClass: LivekitMediaAdapter }],
  // RoomsService gọi khi kick / rời / giải tán (Task 7)
  exports: [MeetingsService],
})
export class MeetingsModule {}
```

- [ ] **Step 7: Toàn bộ test + build + chạy thật**

```powershell
Set-Location backend; npm test; npm run build; Set-Location ..
docker compose up -d --build
docker compose logs backend --tail 40
```
Expected: `Tests 90 passed (90)`; build exit 0; log có `Mapped {/rooms/:roomId/meetings, POST}`, `Mapped {/rooms/:roomId/meetings, GET}`, `Nest application successfully started`. Thiếu biến LiveKit → app dừng với `Biến môi trường LiveKit không hợp lệ — …` (đúng fail-fast).

Chạy **Phụ lục B, phần B1 dòng 1–4**. Expected đúng như comment từng dòng.

- [ ] **Step 8: `docs/api/endpoint.md` — thêm nhóm Meetings (sau mục Rooms, trước mục Chat)**

```markdown
## Meetings

Mọi endpoint REST cần header `Authorization: Bearer <accessToken>`. `roomId` / `meetingId` sai định dạng → `400`. Không gọi được LiveKit → `502` "Không kết nối được máy chủ media" (không đổi trạng thái gì).

**Meeting response:** `{ id, roomId, title, status, createdBy, startedAt, endedAt, endReason, peakParticipants, totalParticipants, messageCount, durationSeconds }` — `status`: `ACTIVE` | `ENDED`; `endReason`: `HOST_ENDED` | `AUTO_EMPTY` (hệ thống tự kết thúc: phòng trống 3 phút hoặc media server dừng) | `ROOM_DISSOLVED` | `null`.

### POST /rooms/:roomId/meetings
Bắt đầu buổi học. Quyền: HOST.

| Body | Kiểu | Ràng buộc |
|---|---|---|
| title | string | bắt buộc, 1–100 ký tự (đã trim) — frontend điền sẵn "Buổi học dd/MM HH:mm" |

- Response `201`: meeting response (`status: ACTIVE`).
- `403`: không phải HOST. `404`: phòng không tồn tại / đã giải tán.
- `409`: phòng đang có buổi học diễn ra. Meeting cũ còn ACTIVE trong DB nhưng room LiveKit đã đóng → tự chốt meeting cũ (`AUTO_EMPTY`) rồi tạo mới, không trả 409.

### GET /rooms/:roomId/meetings
Lịch sử buổi học, mới nhất trước (buổi đang diễn ra đứng đầu). Quyền: thành viên.

| Query | Kiểu | Mặc định | Ghi chú |
|---|---|---|---|
| page | number | 1 | 1–1000 |
| limit | number | 20 | 1–50 |

Response `200`: `{ items: MeetingResponse[], page, limit, hasMore }`.
```

- [ ] **Step 9: Progress + commit (khi user cho phép)**

```powershell
git add backend/src/modules/meetings docs/api/endpoint.md docs/progress.md
git commit -m "feat: HOST bắt đầu buổi học, lịch sử buổi học, chốt meeting dùng chung" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Vào meeting (cấp token) + HOST kết thúc

Spec §5.2 (join, end), §9.1.

**Files:**
- Modify: `backend/src/modules/meetings/meetings.service.ts`
- Modify: `backend/src/modules/meetings/meetings.service.spec.ts`
- Modify: `backend/src/modules/meetings/meetings.controller.ts`
- Modify: `docs/api/endpoint.md`, `docs/progress.md`

**Interfaces:**
- Consumes: `endMeeting`, `systemEndReason`, `viaMedia`, `toMeetingResponse` (Task 4); `MediaPort.roomExists / createJoinToken / closeRoom` (Task 3).
- Produces:
  - `joinMeeting(userId: string, displayName: string, meetingId: string): Promise<{ token: string; livekitUrl: string; myRole: RoomRole; meeting: MeetingResponse }>`
  - `endByHost(userId: string, meetingId: string): Promise<void>`
  - private `findMeeting(meetingId: string)` — 400 sai định dạng, 404 không có.
  - Route `POST /meetings/:meetingId/join` (200), `POST /meetings/:meetingId/end` (204).

- [ ] **Step 1: Viết test (fail)**

Trong `meetings.service.spec.ts`, sửa dòng import `@nestjs/common` thành:
```ts
import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
```
Thêm cuối file:
```ts
describe('joinMeeting', () => {
  it('meetingId sai định dạng → 400', async () => {
    const { service } = build();
    await expect(service.joinMeeting(userId, 'An', 'abc')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('không có meeting → 404', async () => {
    const { service } = build();
    await expect(service.joinMeeting(userId, 'An', meetingId)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('không phải thành viên phòng của meeting → 403, không cấp token', async () => {
    const { service, meetingModel, access, media } = build();
    meetingModel.findById.mockReturnValue(query(fakeMeeting()));
    access.assertRoomAccess.mockRejectedValue(new ForbiddenException());

    await expect(service.joinMeeting(userId, 'An', meetingId)).rejects.toBeInstanceOf(ForbiddenException);
    expect(access.assertRoomAccess).toHaveBeenCalledWith(userId, roomId);
    expect(media.createJoinToken).not.toHaveBeenCalled();
  });

  it('meeting đã ENDED → 409, không hỏi LiveKit', async () => {
    const { service, meetingModel, media } = build();
    meetingModel.findById.mockReturnValue(query(fakeMeeting({ status: MeetingStatus.ENDED })));

    await expect(service.joinMeeting(userId, 'An', meetingId)).rejects.toBeInstanceOf(ConflictException);
    expect(media.roomExists).not.toHaveBeenCalled();
    expect(media.createJoinToken).not.toHaveBeenCalled();
  });

  it('room LiveKit không còn (mất room_finished) → chốt meeting rồi 409', async () => {
    const { service, meetingModel, media } = build();
    meetingModel.findById.mockReturnValue(query(fakeMeeting()));
    media.roomExists.mockResolvedValue(false);

    await expect(service.joinMeeting(userId, 'An', meetingId)).rejects.toBeInstanceOf(ConflictException);
    expect(meetingModel.updateOne).toHaveBeenCalledWith(
      { _id: meetingId, status: MeetingStatus.ACTIVE },
      { $set: expect.objectContaining({ endReason: EndReason.AUTO_EMPTY }) },
    );
    expect(media.createJoinToken).not.toHaveBeenCalled();
  });

  it('không hỏi được LiveKit → 502, không chốt meeting', async () => {
    const { service, meetingModel, media } = build();
    meetingModel.findById.mockReturnValue(query(fakeMeeting()));
    media.roomExists.mockRejectedValue(new Error('fetch failed'));

    await expect(service.joinMeeting(userId, 'An', meetingId)).rejects.toBeInstanceOf(BadGatewayException);
    expect(meetingModel.updateOne).not.toHaveBeenCalled();
  });

  it('thành công → token đúng room / identity / tên, trả myRole + meeting', async () => {
    const { service, meetingModel, media } = build();
    meetingModel.findById.mockReturnValue(query(fakeMeeting()));

    const res = await service.joinMeeting(userId, 'An', meetingId);

    expect(media.createJoinToken).toHaveBeenCalledWith({ roomName: meetingId, userId, displayName: 'An' });
    expect(res).toMatchObject({
      token: 'lk-token',
      livekitUrl: 'ws://localhost:7880',
      myRole: RoomRole.MEMBER,
      meeting: { id: meetingId, status: MeetingStatus.ACTIVE },
    });
  });
});

describe('endByHost', () => {
  it('không phải HOST → 403, không chốt, không đóng room', async () => {
    const { service, meetingModel, access, media } = build();
    meetingModel.findById.mockReturnValue(query(fakeMeeting()));
    access.assertRoomPermission.mockRejectedValue(new ForbiddenException());

    await expect(service.endByHost(userId, meetingId)).rejects.toBeInstanceOf(ForbiddenException);
    expect(meetingModel.updateOne).not.toHaveBeenCalled();
    expect(media.closeRoom).not.toHaveBeenCalled();
  });

  it('HOST → chốt HOST_ENDED kèm endedBy, rồi mới đóng room LiveKit', async () => {
    const { service, meetingModel, access, media } = build();
    meetingModel.findById.mockReturnValue(query(fakeMeeting()));

    await service.endByHost(userId, meetingId);

    expect(access.assertRoomPermission).toHaveBeenCalledWith(userId, roomId, 'MANAGE_MEETING');
    expect(meetingModel.updateOne).toHaveBeenCalledWith(
      { _id: meetingId, status: MeetingStatus.ACTIVE },
      { $set: expect.objectContaining({ endReason: EndReason.HOST_ENDED, endedBy: userId }) },
    );
    expect(media.closeRoom).toHaveBeenCalledWith(meetingId);
    expect(meetingModel.updateOne.mock.invocationCallOrder[0]).toBeLessThan(media.closeRoom.mock.invocationCallOrder[0]);
  });

  it('meeting đã ENDED → vẫn đóng room, không lỗi (idempotent — lối thoát khi meeting kẹt)', async () => {
    const { service, meetingModel, media } = build();
    meetingModel.findById.mockReturnValue(
      query(fakeMeeting({ status: MeetingStatus.ENDED, endedAt: new Date('2026-10-05T07:30:00Z') })),
    );

    await expect(service.endByHost(userId, meetingId)).resolves.toBeUndefined();
    expect(media.closeRoom).toHaveBeenCalledWith(meetingId);
  });

  it('closeRoom lỗi → 502 để HOST bấm lại', async () => {
    const { service, meetingModel, media } = build();
    meetingModel.findById.mockReturnValue(query(fakeMeeting()));
    media.closeRoom.mockRejectedValue(new Error('fetch failed'));

    await expect(service.endByHost(userId, meetingId)).rejects.toBeInstanceOf(BadGatewayException);
  });
});
```

- [ ] **Step 2: Chạy test — phải fail**

```powershell
Set-Location backend; npx vitest run src/modules/meetings/meetings.service.spec.ts; Set-Location ..
```
Expected: 11 test mới FAIL (`service.joinMeeting is not a function`), 15 test cũ pass.

- [ ] **Step 3: Thêm vào service**

Sửa dòng import `@nestjs/common` thành:
```ts
import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
```

Thêm 2 hàm public ngay sau `listMeetings`:
```ts
  // POST /meetings/:meetingId/join — thành viên, meeting ACTIVE. Token cấp lại mỗi lần vào (webrtc.md §2)
  async joinMeeting(userId: string, displayName: string, meetingId: string) {
    const meeting = await this.findMeeting(meetingId);
    const member = await this.access.assertRoomAccess(userId, String(meeting.roomId));

    if (meeting.status !== MeetingStatus.ACTIVE) {
      throw new ConflictException('Buổi học đã kết thúc');
    }
    // Mongo còn ACTIVE mà LiveKit trả lời "không có room" → tự hồi phục (spec §9.1).
    // Không hỏi được LiveKit → 502, không chốt gì (đằng nào cũng không vào được call)
    if (!(await this.viaMedia(() => this.media.roomExists(meetingId)))) {
      await this.endMeeting(meetingId, await this.systemEndReason(meeting.roomId), new Date());
      throw new ConflictException('Buổi học đã kết thúc');
    }

    const { token, url } = await this.viaMedia(() =>
      this.media.createJoinToken({ roomName: meetingId, userId, displayName }),
    );
    return { token, livekitUrl: url, myRole: member.role, meeting: toMeetingResponse(meeting) };
  }

  // POST /meetings/:meetingId/end — chỉ HOST. Idempotent: đã kết thúc vẫn đóng room, bấm lại được (spec §5.2)
  async endByHost(userId: string, meetingId: string) {
    const meeting = await this.findMeeting(meetingId);
    await this.access.assertRoomPermission(userId, String(meeting.roomId), RoomAction.MANAGE_MEETING);

    await this.endMeeting(meetingId, EndReason.HOST_ENDED, new Date(), userId);
    // Đóng room LiveKit → mọi người bị ngắt với ROOM_DELETED. Lỗi → 502 để HOST bấm lại
    await this.viaMedia(() => this.media.closeRoom(meetingId));
  }
```

Thêm hàm private (cạnh `systemEndReason`):
```ts
  // Meeting theo id: sai định dạng → 400, không có → 404
  private async findMeeting(meetingId: string) {
    if (!Types.ObjectId.isValid(meetingId)) {
      throw new BadRequestException('meetingId không hợp lệ');
    }
    const meeting = await this.meetingModel.findById(meetingId).lean().exec();
    if (!meeting) {
      throw new NotFoundException('Buổi học không tồn tại');
    }
    return meeting;
  }
```

- [ ] **Step 4: Chạy test — phải pass**

```powershell
Set-Location backend; npx vitest run src/modules/meetings/meetings.service.spec.ts; Set-Location ..
```
Expected: **26 passed**.

- [ ] **Step 5: Controller — thêm 2 route**

Sửa dòng import `@nestjs/common` trong `meetings.controller.ts` thành:
```ts
import { Body, Controller, Get, HttpCode, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
```
Thêm vào class:
```ts
  // POST /meetings/:meetingId/join — trả { token, livekitUrl, myRole, meeting }
  @Post('meetings/:meetingId/join')
  @HttpCode(200)
  join(@Req() req: any, @Param('meetingId') meetingId: string) {
    return this.meetings.joinMeeting(req.user.id, req.user.displayName, meetingId);
  }

  // POST /meetings/:meetingId/end — HOST kết thúc buổi học cho mọi người
  @Post('meetings/:meetingId/end')
  @HttpCode(204)
  end(@Req() req: any, @Param('meetingId') meetingId: string) {
    return this.meetings.endByHost(req.user.id, meetingId);
  }
```

- [ ] **Step 6: Toàn bộ test + build + chạy thật**

```powershell
Set-Location backend; npm test; npm run build; Set-Location ..
docker compose up -d --build
docker compose logs backend --tail 30
```
Expected: `Tests 101 passed (101)`; build exit 0; log thêm `Mapped {/meetings/:meetingId/join, POST}`, `Mapped {/meetings/:meetingId/end, POST}`.

Chạy **Phụ lục B, phần B1 toàn bộ (dòng 1–9)**. Expected đúng như comment từng dòng. Dòng 5 chứng minh container backend gọi được LiveKit qua `http://livekit:7880` (`roomExists`).

- [ ] **Step 7: `docs/api/endpoint.md` — thêm vào nhóm Meetings**

```markdown
### POST /meetings/:meetingId/join
Vào buổi học — cấp token LiveKit mới mỗi lần gọi. Quyền: thành viên phòng của meeting.

- Response `200`: `{ token, livekitUrl, myRole, meeting }` — `livekitUrl` là địa chỉ LiveKit cho trình duyệt (dev `ws://localhost:7880`); token: `identity = userId`, `name = displayName`, `room = meetingId`, mọi thành viên cùng quyền publish + subscribe, **không** gửi data qua LiveKit (`canPublishData: false`), hạn `LIVEKIT_TOKEN_TTL_HOURS` giờ.
- `403`: không phải thành viên. `404`: meeting không tồn tại / phòng đã giải tán.
- `409`: buổi học đã kết thúc (kể cả khi DB còn ACTIVE nhưng room LiveKit đã đóng — tự chốt meeting).

### POST /meetings/:meetingId/end
Kết thúc buổi học cho mọi người: chốt `ENDED` (`HOST_ENDED`), đóng room LiveKit → mọi người bị ngắt. Quyền: HOST.
- Response `204`. **Idempotent**: buổi đã kết thúc vẫn trả `204` (không ghi đè `endedAt`) — dùng được khi meeting bị kẹt.
- `403`: không phải HOST. `404`: meeting không tồn tại. `502`: không đóng được room LiveKit — bấm lại.
```

- [ ] **Step 8: Progress + commit (khi user cho phép)**

```powershell
git add backend/src/modules/meetings docs/api/endpoint.md docs/progress.md
git commit -m "feat: vào buổi học bằng token LiveKit, HOST kết thúc buổi học" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Webhook LiveKit — `meeting_participants`, presence, tự kết thúc

Spec §4.4, §6, §7.2, §9.2–9.3, §10.

**Files:**
- Modify: `backend/src/modules/meetings/schemas/meeting-participant.schema.ts` (`sid`)
- Modify: `backend/src/common/services/redis.service.ts` (`scard`)
- Modify: `backend/src/main.ts` (raw body)
- Create: `backend/src/modules/meetings/media-webhook.controller.ts`
- Modify: `backend/src/modules/meetings/meetings.service.ts`, `meetings.service.spec.ts`, `meetings.module.ts`
- Modify: `docs/database/DB_DESIGN.md`, `docs/api/endpoint.md`, `docs/progress.md`

**Interfaces:**
- Consumes: `MediaEvent`, `MediaPort.parseWebhook / removeParticipant` (Task 3); `endMeeting`, `systemEndReason` (Task 4).
- Produces:
  - `handleMediaEvent(event: MediaEvent): Promise<void>` — điều kiện biết trước → resolve; lỗi bất ngờ → reject (controller trả 500).
  - `RedisService.scard(key: string): Promise<number>`.
  - Route `POST /webhooks/livekit` (200 / 401 / 500).

- [ ] **Step 1: Viết test (fail)**

Thêm cuối `meetings.service.spec.ts`:
```ts
describe('handleMediaEvent', () => {
  const sid = 'PA_abc';
  const joinedAt = new Date('2026-10-05T07:05:00Z');
  const leftAt = new Date('2026-10-05T07:15:00Z');
  const joined = (overrides: Record<string, unknown> = {}) => ({
    type: 'participant_joined' as const,
    eventId: 'EV_1',
    roomName: meetingId,
    userId,
    displayName: 'An',
    sid,
    at: joinedAt,
    ...overrides,
  });
  const left = (overrides: Record<string, unknown> = {}) => ({
    type: 'participant_left' as const,
    eventId: 'EV_2',
    roomName: meetingId,
    userId,
    sid,
    at: leftAt,
    ...overrides,
  });

  it('event không quan tâm / room không phải meeting (room lk khi thử) / không có meeting → không làm gì', async () => {
    const { service, meetingModel, participantModel } = build();

    await service.handleMediaEvent({ type: 'ignored', eventId: 'EV_0', event: 'track_published' });
    await service.handleMediaEvent(joined({ roomName: 'spike-room' }));
    expect(meetingModel.findById).not.toHaveBeenCalled();

    await service.handleMediaEvent(joined());
    expect(participantModel.updateOne).not.toHaveBeenCalled();
  });

  it('identity không phải userId (bot lk load-test) → bỏ qua', async () => {
    const { service, meetingModel, participantModel, access } = build();
    meetingModel.findById.mockReturnValue(query(fakeMeeting()));

    await service.handleMediaEvent(joined({ userId: 'pub_0' }));

    expect(access.assertRoomAccess).not.toHaveBeenCalled();
    expect(participantModel.updateOne).not.toHaveBeenCalled();
  });

  it('joined: thành viên vào → upsert participant, thêm session theo sid, SADD presence, $max peak', async () => {
    const { service, meetingModel, participantModel, access, redis } = build();
    meetingModel.findById.mockReturnValue(query(fakeMeeting()));
    redis.scard.mockResolvedValue(2);

    await service.handleMediaEvent(joined());

    expect(access.assertRoomAccess).toHaveBeenCalledWith(userId, roomId);
    expect(participantModel.updateOne).toHaveBeenNthCalledWith(
      1,
      { meetingId, userId },
      { $setOnInsert: { displayName: 'An', roleAtJoin: RoomRole.MEMBER, sessions: [], totalDurationSeconds: 0 } },
      { upsert: true },
    );
    // Gửi lại cùng sid → filter $ne không khớp → không thêm lần 2
    expect(participantModel.updateOne).toHaveBeenNthCalledWith(
      2,
      { meetingId, userId, 'sessions.sid': { $ne: sid } },
      { $push: { sessions: { sid, joinedAt, leftAt: null } } },
    );
    expect(redis.sadd).toHaveBeenCalledWith(`presence:${meetingId}`, userId);
    expect(redis.expire).toHaveBeenCalledWith(`presence:${meetingId}`, 86400);
    expect(meetingModel.updateOne).toHaveBeenCalledWith({ _id: meetingId }, { $max: { peakParticipants: 2 } });
  });

  it('joined: không còn là thành viên (bị kick, vào lại bằng token cũ) → removeParticipant, không ghi gì', async () => {
    const { service, meetingModel, participantModel, access, redis, media } = build();
    meetingModel.findById.mockReturnValue(query(fakeMeeting()));
    access.assertRoomAccess.mockRejectedValue(new ForbiddenException());

    await service.handleMediaEvent(joined());

    expect(media.removeParticipant).toHaveBeenCalledWith(meetingId, userId);
    expect(participantModel.updateOne).not.toHaveBeenCalled();
    expect(redis.sadd).not.toHaveBeenCalled();
  });

  it('joined: meeting đã ENDED (room LiveKit chưa kịp đóng) → removeParticipant', async () => {
    const { service, meetingModel, participantModel, access, media } = build();
    meetingModel.findById.mockReturnValue(query(fakeMeeting({ status: MeetingStatus.ENDED })));

    await service.handleMediaEvent(joined());

    expect(media.removeParticipant).toHaveBeenCalledWith(meetingId, userId);
    expect(access.assertRoomAccess).not.toHaveBeenCalled();
    expect(participantModel.updateOne).not.toHaveBeenCalled();
  });

  it('joined: Mongo lỗi khi kiểm thành viên → ném lỗi (500, LiveKit gửi lại), KHÔNG đá người ra', async () => {
    const { service, meetingModel, access, media } = build();
    meetingModel.findById.mockReturnValue(query(fakeMeeting()));
    access.assertRoomAccess.mockRejectedValue(new Error('mongo down'));

    await expect(service.handleMediaEvent(joined())).rejects.toThrow('mongo down');
    expect(media.removeParticipant).not.toHaveBeenCalled();
  });

  it('joined: upsert báo trùng (2 tab cùng lúc) → vẫn thêm session', async () => {
    const { service, meetingModel, participantModel } = build();
    meetingModel.findById.mockReturnValue(query(fakeMeeting()));
    participantModel.updateOne.mockReturnValueOnce(failingQuery(duplicateKeyError()));

    await service.handleMediaEvent(joined());

    expect(participantModel.updateOne).toHaveBeenCalledTimes(2);
  });

  it('left: đóng đúng session theo sid; hết session mở → SREM presence', async () => {
    const { service, meetingModel, participantModel, redis } = build();
    meetingModel.findById.mockReturnValue(query(fakeMeeting()));

    await service.handleMediaEvent(left());

    expect(participantModel.updateOne).toHaveBeenCalledWith(
      { meetingId, userId },
      { $set: { 'sessions.$[s].leftAt': leftAt } },
      { arrayFilters: [{ 's.sid': sid, 's.leftAt': null }] },
    );
    expect(participantModel.exists).toHaveBeenCalledWith({
      meetingId,
      userId,
      sessions: { $elemMatch: { leftAt: null } },
    });
    expect(redis.srem).toHaveBeenCalledWith(`presence:${meetingId}`, userId);
  });

  it('left: còn session mở (tab mới vào trước khi tab cũ báo rời) → không SREM', async () => {
    const { service, meetingModel, participantModel, redis } = build();
    meetingModel.findById.mockReturnValue(query(fakeMeeting()));
    participantModel.exists.mockReturnValue(query({ _id: new Types.ObjectId() }));

    await service.handleMediaEvent(left());

    expect(redis.srem).not.toHaveBeenCalled();
  });

  it('room_finished, phòng còn ACTIVE → AUTO_EMPTY với endedAt adapter tính sẵn', async () => {
    const { service, meetingModel } = build();
    meetingModel.findById.mockReturnValue(query(fakeMeeting()));
    const endedAt = new Date('2026-10-05T07:40:00Z');

    await service.handleMediaEvent({ type: 'room_finished', eventId: 'EV_3', roomName: meetingId, endedAt });

    expect(meetingModel.updateOne).toHaveBeenCalledWith(
      { _id: meetingId, status: MeetingStatus.ACTIVE },
      { $set: { status: MeetingStatus.ENDED, endedAt, endedBy: null, endReason: EndReason.AUTO_EMPTY } },
    );
  });

  it('room_finished, phòng đã giải tán → ROOM_DISSOLVED', async () => {
    const { service, meetingModel, roomModel } = build();
    meetingModel.findById.mockReturnValue(query(fakeMeeting()));
    roomModel.findById.mockReturnValue(query({ status: RoomStatus.DISSOLVED }));

    await service.handleMediaEvent({
      type: 'room_finished',
      eventId: 'EV_4',
      roomName: meetingId,
      endedAt: new Date('2026-10-05T07:40:00Z'),
    });

    expect(meetingModel.updateOne).toHaveBeenCalledWith(
      { _id: meetingId, status: MeetingStatus.ACTIVE },
      { $set: expect.objectContaining({ endReason: EndReason.ROOM_DISSOLVED }) },
    );
  });

  it('Mongo lỗi khi đọc meeting → lỗi bay lên (500)', async () => {
    const { service, meetingModel } = build();
    meetingModel.findById.mockReturnValue(failingQuery(new Error('mongo down')));

    await expect(service.handleMediaEvent(left())).rejects.toThrow('mongo down');
  });
});
```

- [ ] **Step 2: Chạy test — phải fail**

```powershell
Set-Location backend; npx vitest run src/modules/meetings/meetings.service.spec.ts; Set-Location ..
```
Expected: 12 test mới FAIL (`service.handleMediaEvent is not a function`), 26 test cũ pass.

- [ ] **Step 3: Schema `sid` + `scard`**

`meeting-participant.schema.ts`, trong class `ParticipantSession` thêm **trước** `joinedAt`:
```ts
  // participant.sid của LiveKit — mỗi kết nối một sid; khoá idempotent của webhook (spec §6.1)
  @Prop({ required: true })
  sid!: string;
```

`redis.service.ts`, thêm sau `sismember`:
```ts
  // Số phần tử của Set (số người đang online trong presence:{meetingId})
  async scard(key: string): Promise<number> {
    return this.client.sCard(key);
  }
```

- [ ] **Step 4: Thêm vào service**

Sửa dòng import `@nestjs/common` thành:
```ts
import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  HttpException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
```
Sửa 2 dòng import port thành:
```ts
import { MEDIA_PORT } from './ports/media.port.js';
import type { MediaEvent, MediaPort } from './ports/media.port.js';
```
Thêm hằng số ngay dưới hàm `secondsBetween`:
```ts
// Tên room / identity do backend tạo luôn là String(ObjectId) — 24 ký tự hex.
// Chặt hơn ObjectId.isValid (nhận cả chuỗi 12 ký tự bất kỳ như "bench-room-1")
const OBJECT_ID_HEX = /^[a-f\d]{24}$/i;

// TTL key presence:{meetingId} (DB_DESIGN Phần E) — làm mới mỗi lần có người vào
const PRESENCE_TTL_SECONDS = 24 * 60 * 60;

type JoinedEvent = Extract<MediaEvent, { type: 'participant_joined' }>;
type LeftEvent = Extract<MediaEvent, { type: 'participant_left' }>;
```
Thêm hàm public sau `endByHost`:
```ts
  // Webhook LiveKit (spec §6). Điều kiện biết trước → return (controller trả 200, LiveKit không gửi lại).
  // Lỗi bất ngờ (Mongo, Redis, LiveKit API) → ném ra → 500 → LiveKit gửi lại; mọi bước idempotent nên an toàn
  async handleMediaEvent(event: MediaEvent) {
    if (event.type === 'ignored') return;
    // Room không do backend tạo (lk room create khi thử / benchmark)
    if (!OBJECT_ID_HEX.test(event.roomName)) return;

    const meeting = await this.meetingModel.findById(event.roomName).lean().exec();
    if (!meeting) return;

    if (event.type === 'room_finished') {
      await this.endMeeting(event.roomName, await this.systemEndReason(meeting.roomId), event.endedAt);
      return;
    }
    // Identity không phải userId (bot lk load-test) hoặc thiếu sid → không ghi
    if (!OBJECT_ID_HEX.test(event.userId) || !event.sid) return;

    if (event.type === 'participant_joined') {
      await this.onParticipantJoined(meeting, event);
    } else {
      await this.onParticipantLeft(event.roomName, event);
    }
  }
```
Thêm 2 hàm private (cạnh `finalize`):
```ts
  private async onParticipantJoined(meeting: { _id: unknown; roomId: unknown; status: MeetingStatus }, e: JoinedEvent) {
    const meetingId = String(meeting._id);

    // Meeting đã kết thúc nhưng room LiveKit chưa kịp đóng → không cho ở lại
    if (meeting.status !== MeetingStatus.ACTIVE) {
      await this.media.removeParticipant(meetingId, e.userId);
      return;
    }

    // Không còn là thành viên (bị kick / tự rời / phòng giải tán) mà vào lại bằng token cũ → đưa ra ngay.
    // LiveKit tự host không thu hồi token khi removeParticipant (spec §1 câu 2)
    let member;
    try {
      member = await this.access.assertRoomAccess(e.userId, String(meeting.roomId));
    } catch (err) {
      // Lỗi Mongo (không phải 4xx) → ném → 500 → LiveKit gửi lại; không đá nhầm người đang hợp lệ
      if (!(err instanceof HttpException)) throw err;
      await this.media.removeParticipant(meetingId, e.userId);
      return;
    }

    // 1 document / user / meeting. 2 event cùng user chạy song song (2 tab) → upsert báo trùng thì bỏ qua
    await this.participantModel
      .updateOne(
        { meetingId, userId: e.userId },
        {
          $setOnInsert: {
            displayName: e.displayName.slice(0, 60) || 'Thành viên',
            roleAtJoin: member.role,
            sessions: [],
            totalDurationSeconds: 0,
          },
        },
        { upsert: true },
      )
      .exec()
      .catch((err) => {
        if (!isDuplicateKey(err)) throw err;
      });

    // Thêm session theo sid — LiveKit gửi lại cùng sid thì không thêm lần 2
    await this.participantModel
      .updateOne(
        { meetingId, userId: e.userId, 'sessions.sid': { $ne: e.sid } },
        { $push: { sessions: { sid: e.sid, joinedAt: e.at, leftAt: null } } },
      )
      .exec();

    // Presence ở Redis; đỉnh số người ghi Mongo bằng $max — atomic, event trùng không làm sai (spec §10)
    const key = `presence:${meetingId}`;
    await this.redis.sadd(key, e.userId);
    await this.redis.expire(key, PRESENCE_TTL_SECONDS);
    const online = await this.redis.scard(key);
    await this.meetingModel.updateOne({ _id: meetingId }, { $max: { peakParticipants: online } }).exec();
  }

  // participant_left và participant_connection_aborted xử lý y hệt nhau (spec §6.3)
  private async onParticipantLeft(meetingId: string, e: LeftEvent) {
    // Đóng đúng session theo sid. Gửi lại / aborted chưa từng có session → không khớp → không làm gì
    await this.participantModel
      .updateOne(
        { meetingId, userId: e.userId },
        { $set: { 'sessions.$[s].leftAt': e.at } },
        { arrayFilters: [{ 's.sid': e.sid, 's.leftAt': null }] },
      )
      .exec();

    // Còn session mở (tab mới vào trước khi tab cũ báo rời) → vẫn đang ở trong meeting
    const stillIn = await this.participantModel
      .exists({ meetingId, userId: e.userId, sessions: { $elemMatch: { leftAt: null } } })
      .exec();
    if (!stillIn) {
      await this.redis.srem(`presence:${meetingId}`, e.userId);
    }
  }
```

- [ ] **Step 5: Chạy test — phải pass**

```powershell
Set-Location backend; npx vitest run src/modules/meetings/meetings.service.spec.ts; Set-Location ..
```
Expected: **38 passed**.

- [ ] **Step 6: Controller webhook + raw body**

`backend/src/modules/meetings/media-webhook.controller.ts`:
```ts
import { Controller, Headers, HttpCode, Inject, Post, Req, UnauthorizedException } from '@nestjs/common';
import { MeetingsService } from './meetings.service.js';
import { MEDIA_PORT } from './ports/media.port.js';
import type { MediaPort } from './ports/media.port.js';

// Webhook của media server. KHÔNG dùng JWT — xác thực bằng chữ ký (PROJECT_CONTEXT §7.4).
// Nhiều instance: NGINX chuyển mỗi event tới 1 instance; mọi side effect nằm trong Mongo / Redis
@Controller('webhooks')
export class MediaWebhookController {
  constructor(
    @Inject(MEDIA_PORT) private media: MediaPort,
    private meetings: MeetingsService,
  ) {}

  // POST /webhooks/livekit — 200 xử lý xong / bỏ qua; 401 sai chữ ký; 500 lỗi bất ngờ (LiveKit gửi lại)
  @Post('livekit')
  @HttpCode(200)
  async receive(@Req() req: { rawBody?: Buffer }, @Headers('authorization') authorization?: string) {
    // rawBody có nhờ main.ts bật rawBody + parser application/webhook+json (spec §4.4)
    const raw = req.rawBody?.toString('utf8');
    if (!raw) {
      throw new UnauthorizedException('Thiếu nội dung webhook');
    }
    const event = await this.media.parseWebhook(raw, authorization);
    await this.meetings.handleMediaEvent(event);
    return { ok: true };
  }
}
```

`meetings.module.ts`: thêm import và đăng ký controller:
```ts
import { MediaWebhookController } from './media-webhook.controller.js';
```
```ts
  controllers: [MeetingsController, MediaWebhookController],
```

`backend/src/main.ts`: thêm import:
```ts
import type { NestExpressApplication } from '@nestjs/platform-express';
```
Thay dòng `const app = await NestFactory.create(AppModule);` bằng:
```ts
  // rawBody: giữ body gốc để verify chữ ký webhook LiveKit (spec §4.4)
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true });
  // LiveKit gửi webhook với Content-Type application/webhook+json — parser JSON mặc định bỏ qua loại này
  app.useBodyParser('json', { type: 'application/webhook+json' });
```

- [ ] **Step 7: Toàn bộ test + build + chạy thật với LiveKit**

```powershell
Set-Location backend; npm test; npm run build; Set-Location ..
docker compose up -d --build
docker compose logs backend --tail 30
```
Expected: `Tests 113 passed (113)`; build exit 0; log có `Mapped {/webhooks/livekit, POST}`.

Webhook thật, chế độ **container** (Task 1 đã thử chế độ native):
1. Không chữ ký → 401:
   ```powershell
   curl.exe -s -o NUL -w "%{http_code}`n" -X POST http://localhost:3001/webhooks/livekit -H "Content-Type: application/webhook+json" -d "{}"
   ```
   Expected: `401`.
2. Chạy **Phụ lục B, B1 dòng 1–5** (có `$mt`, `$j`). Chép `frontend/public/lk-test.html` từ **Phụ lục A** (đồ bỏ), `Set-Location frontend; npm run dev`, mở `http://localhost:3000/lk-test.html`, dán `$j.token`, Connect.
3. Kiểm Mongo / Redis (cửa sổ PowerShell có biến `$mt`):
   ```powershell
   docker exec mongo-dev mongosh online-group-learning --quiet --eval "printjson(db.meeting_participants.find({ meetingId: ObjectId('$($mt.id)') }, { displayName: 1, roleAtJoin: 1, sessions: 1, totalDurationSeconds: 1 }).toArray())"
   docker exec redis-dev redis-cli SMEMBERS "presence:$($mt.id)"
   docker exec mongo-dev mongosh online-group-learning --quiet --eval "printjson(db.meetings.findOne({ _id: ObjectId('$($mt.id)') }, { status: 1, peakParticipants: 1 }))"
   ```
   Expected: 1 participant `roleAtJoin: 'MEMBER'`, 1 session có `sid: 'PA_…'`, `leftAt: null`; presence có userId của MEMBER; `peakParticipants: 1`.
   Mongo trống → `docker compose logs backend --tail 50` + `docker compose logs livekit --tail 50`: thấy `401 Thiếu nội dung webhook` = raw body không tới controller (xem lại Step 6 `main.ts`); không thấy request nào = LiveKit không gọi được `host.docker.internal:3001`. Dừng, dùng superpowers:systematic-debugging.
4. Đóng tab → chạy lại lệnh ở (3). Expected: session có `leftAt`; presence rỗng.
5. Chờ ~3 phút (≥ `MEETING_AUTO_END_AFTER_MIN`) → lệnh `meetings.findOne` (bỏ projection). Expected: `status: 'ENDED'`, `endReason: 'AUTO_EMPTY'`, `endedAt` ≈ `leftAt` ở bước 4 (lệch vài giây), `totalParticipants: 1`, `durationSeconds` > 0.
6. Dọn: `Remove-Item frontend/public/lk-test.html`, `Ctrl+C` frontend dev.

- [ ] **Step 8: `docs/database/DB_DESIGN.md`**

Dòng 46, thay:
```
| **Counter thay đổi liên tục KHÔNG để trong Mongo** | Số người đang online nằm ở Redis; Mongo chỉ lưu `peakParticipants` khi meeting kết thúc |
```
bằng:
```
| **Counter thay đổi liên tục KHÔNG để trong Mongo** | Số người đang online nằm ở Redis (`presence:{meetingId}`); `peakParticipants` cập nhật bằng `$max` mỗi lần có người vào `[phát sinh kỹ thuật]` — atomic, không cần Lua (spec meeting §10) |
```

C.5, thay dòng comment `// --- thống kê, chỉ ghi khi meeting kết thúc ---` bằng:
```
  // --- thống kê: peakParticipants cập nhật bằng $max khi có người vào; còn lại ghi khi kết thúc (finalize) ---
```
Dòng 254, thay `- \`{ status: 1, startedAt: 1 }\` ← job auto-end quét meeting ACTIVE` bằng:
```
- `{ status: 1, startedAt: 1 }` ← giữ lại; hiện không job nào dùng — tự kết thúc meeting bằng timeout LiveKit + webhook (ADR-022)
```
Dòng 506 (bảng tổng hợp index), cột cuối `job auto-end` → `giữ lại, chưa dùng (ADR-022)`.

C.6, trong khối code `ParticipantSession` thêm dòng đầu:
```
  @Prop({ required: true }) sid: string;   // participant.sid của LiveKit — khoá idempotent của webhook
```
và thêm dưới dòng `**Ai ghi vào đây:** **LiveKit webhook**…`:
```
**Idempotent:** session thêm bằng `$push` chỉ khi chưa có session cùng `sid`; đóng session bằng `arrayFilters` theo `sid` → LiveKit gửi lại event không ghi trùng. `participant_connection_aborted` xử lý như `participant_left` (spec meeting §6).
```

Phần E: xoá dòng `presence:peak:{meetingId}`; dòng `presence:{meetingId}` đổi cột cuối thành `userId đang online — webhook joined (SADD) / left (SREM) ghi, finalize xoá khi meeting kết thúc`.

- [ ] **Step 9: `docs/api/endpoint.md` — thêm vào nhóm Meetings**

```markdown
### POST /webhooks/livekit
Webhook của LiveKit (không dành cho client). Không dùng JWT — xác thực bằng chữ ký: header `Authorization` là JWT chứa sha256 của raw body; `Content-Type: application/webhook+json`.

| Mã | Khi nào |
|---|---|
| `200` | xử lý xong, **hoặc** bỏ qua có chủ đích: room không phải meeting (room tạo bằng `lk`), identity không phải userId (bot load-test), không có meeting, event không quan tâm, người không còn là thành viên (đã bị đưa ra khỏi room) |
| `401` | sai / thiếu chữ ký |
| `500` | lỗi bất ngờ (Mongo, Redis, LiveKit API) → LiveKit gửi lại; mọi bước idempotent |

Event xử lý: `participant_joined` (ghi session theo `sid`, presence, `$max` peak; không còn là thành viên / meeting đã kết thúc → `removeParticipant`), `participant_left` + `participant_connection_aborted` (đóng session theo `sid`), `room_finished` (chốt meeting `AUTO_EMPTY` / `ROOM_DISSOLVED` — ADR-022).
```

- [ ] **Step 10: Progress + commit (khi user cho phép)**

```powershell
git add backend/src docs/database/DB_DESIGN.md docs/api/endpoint.md docs/progress.md
git commit -m "feat: webhook LiveKit ghi người tham gia, presence, tự kết thúc meeting" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Kick / rời / giải tán phòng → đưa ra khỏi call, kết thúc meeting

Spec §8, §9.4. Xử lý `TODO(module meeting)` trong `rooms.service.ts`.

**Files:**
- Modify: `backend/src/modules/meetings/meetings.service.ts`, `meetings.service.spec.ts`
- Modify: `backend/src/modules/rooms/rooms.service.ts`, `rooms.service.spec.ts`, `rooms.module.ts`
- Modify: `docs/api/endpoint.md`, `docs/progress.md`

**Interfaces:**
- Consumes: `endMeeting` (Task 4); `MediaPort.removeParticipant / closeRoom` (Task 3); `MeetingsModule` export `MeetingsService` (Task 4).
- Produces:
  - `MeetingsService.removeFromActiveMeeting(roomId: string, userId: string): Promise<void>` — **không bao giờ reject**.
  - `MeetingsService.endActiveMeetingOfRoom(roomId: string): Promise<void>` — **không bao giờ reject**.
  - `RoomsService` constructor thêm tham số thứ 6 `meetings: MeetingsService`.

- [ ] **Step 1: Viết test meetings (fail)**

Thêm cuối `meetings.service.spec.ts`:
```ts
describe('removeFromActiveMeeting', () => {
  it('phòng không có meeting ACTIVE → không gọi LiveKit', async () => {
    const { service, media } = build();

    await service.removeFromActiveMeeting(roomId, userId);

    expect(media.removeParticipant).not.toHaveBeenCalled();
  });

  it('có meeting ACTIVE → đưa người đó ra khỏi room LiveKit', async () => {
    const { service, meetingModel, media } = build();
    meetingModel.findOne.mockReturnValue(query(fakeMeeting()));

    await service.removeFromActiveMeeting(roomId, userId);

    expect(meetingModel.findOne).toHaveBeenCalledWith({ roomId, status: MeetingStatus.ACTIVE });
    expect(media.removeParticipant).toHaveBeenCalledWith(meetingId, userId);
  });

  it('LiveKit lỗi → không ném lỗi (không làm hỏng kick / rời phòng)', async () => {
    const { service, meetingModel, media } = build();
    meetingModel.findOne.mockReturnValue(query(fakeMeeting()));
    media.removeParticipant.mockRejectedValue(new Error('fetch failed'));

    await expect(service.removeFromActiveMeeting(roomId, userId)).resolves.toBeUndefined();
  });

  it('Mongo lỗi → không ném lỗi', async () => {
    const { service, meetingModel } = build();
    meetingModel.findOne.mockReturnValue(failingQuery(new Error('mongo down')));

    await expect(service.removeFromActiveMeeting(roomId, userId)).resolves.toBeUndefined();
  });
});

describe('endActiveMeetingOfRoom', () => {
  it('phòng không có meeting ACTIVE → không làm gì', async () => {
    const { service, meetingModel, media } = build();

    await service.endActiveMeetingOfRoom(roomId);

    expect(meetingModel.updateOne).not.toHaveBeenCalled();
    expect(media.closeRoom).not.toHaveBeenCalled();
  });

  it('chốt ROOM_DISSOLVED rồi đóng room LiveKit', async () => {
    const { service, meetingModel, media } = build();
    meetingModel.findOne.mockReturnValue(query(fakeMeeting()));
    meetingModel.findById.mockReturnValue(query(fakeMeeting()));

    await service.endActiveMeetingOfRoom(roomId);

    expect(meetingModel.updateOne).toHaveBeenCalledWith(
      { _id: meetingId, status: MeetingStatus.ACTIVE },
      { $set: expect.objectContaining({ endReason: EndReason.ROOM_DISSOLVED }) },
    );
    expect(media.closeRoom).toHaveBeenCalledWith(meetingId);
  });

  it('chốt lỗi (Mongo) → VẪN đóng room LiveKit, không ném lỗi', async () => {
    const { service, meetingModel, media } = build();
    meetingModel.findOne.mockReturnValue(query(fakeMeeting()));
    meetingModel.findById.mockReturnValue(failingQuery(new Error('mongo down')));

    await expect(service.endActiveMeetingOfRoom(roomId)).resolves.toBeUndefined();
    expect(media.closeRoom).toHaveBeenCalledWith(meetingId);
  });

  it('closeRoom lỗi → không ném lỗi', async () => {
    const { service, meetingModel, media } = build();
    meetingModel.findOne.mockReturnValue(query(fakeMeeting()));
    meetingModel.findById.mockReturnValue(query(fakeMeeting()));
    media.closeRoom.mockRejectedValue(new Error('fetch failed'));

    await expect(service.endActiveMeetingOfRoom(roomId)).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: Chạy test — phải fail**

```powershell
Set-Location backend; npx vitest run src/modules/meetings/meetings.service.spec.ts; Set-Location ..
```
Expected: 8 test mới FAIL (`is not a function`), 38 test cũ pass.

- [ ] **Step 3: Thêm 2 hàm vào `MeetingsService`** (sau `handleMediaEvent`)

```ts
  // Gọi từ RoomsService khi kick / rời phòng (spec §8). KHÔNG BAO GIỜ ném lỗi —
  // thao tác chính (xoá thành viên) đã xong; lỗi ở đây chỉ ghi log
  async removeFromActiveMeeting(roomId: string, userId: string) {
    try {
      const active = await this.meetingModel.findOne({ roomId, status: MeetingStatus.ACTIVE }).lean().exec();
      if (!active) return;
      await this.media.removeParticipant(String(active._id), userId);
    } catch (err) {
      // Người đó còn trong call tới khi tự thoát; vào lại bị webhook chặn; HOST có thể kết thúc buổi học
      this.logger.error(`Không đưa được user ${userId} ra khỏi meeting của room ${roomId}: ${err}`);
    }
  }

  // Gọi từ RoomsService khi giải tán phòng (spec §8). KHÔNG BAO GIỜ ném lỗi.
  // 2 bước độc lập: bước chốt lỗi vẫn đóng room → room_finished tới sau vẫn chốt ROOM_DISSOLVED
  async endActiveMeetingOfRoom(roomId: string) {
    let meetingId: string;
    try {
      const active = await this.meetingModel.findOne({ roomId, status: MeetingStatus.ACTIVE }).lean().exec();
      if (!active) return;
      meetingId = String(active._id);
    } catch (err) {
      // Không biết meetingId → không đóng được room; room trống dần → room_finished → ROOM_DISSOLVED
      this.logger.error(`Không tìm được meeting ACTIVE của room ${roomId} khi giải tán: ${err}`);
      return;
    }

    try {
      await this.endMeeting(meetingId, EndReason.ROOM_DISSOLVED, new Date());
    } catch (err) {
      this.logger.error(`Không chốt được meeting ${meetingId} khi giải tán: ${err}`);
    }

    try {
      await this.media.closeRoom(meetingId);
    } catch (err) {
      this.logger.error(`Không đóng được room LiveKit ${meetingId} khi giải tán: ${err}`);
    }
  }
```

- [ ] **Step 4: Chạy test meetings — phải pass**

```powershell
Set-Location backend; npx vitest run src/modules/meetings/meetings.service.spec.ts; Set-Location ..
```
Expected: **46 passed**.

- [ ] **Step 5: Viết test rooms (fail)**

`rooms.service.spec.ts`, trong `build()` thêm trước dòng `const service = new RoomsService(`:
```ts
  // Module meeting: hai hàm không bao giờ ném lỗi (spec meeting §8)
  const meetings = {
    removeFromActiveMeeting: vi.fn().mockResolvedValue(undefined),
    endActiveMeetingOfRoom: vi.fn().mockResolvedValue(undefined),
  };
```
sửa lời gọi constructor thành:
```ts
  const service = new RoomsService(
    roomModel as any,
    memberModel as any,
    access as any,
    redis as any,
    userModel as any,
    meetings as any,
  );
  return { service, roomModel, memberModel, access, redis, userModel, meetings };
```
Thêm cuối file:
```ts
describe('tích hợp module meeting', () => {
  const targetId = new Types.ObjectId().toString();

  it('kick thành công → đưa người bị kick ra khỏi meeting đang diễn ra, SAU khi xoá thành viên', async () => {
    const { service, memberModel, meetings } = build();

    await service.kickMember(userId, roomId, targetId);

    expect(meetings.removeFromActiveMeeting).toHaveBeenCalledWith(roomId, targetId);
    expect(memberModel.deleteOne.mock.invocationCallOrder[0]).toBeLessThan(
      meetings.removeFromActiveMeeting.mock.invocationCallOrder[0],
    );
  });

  it('kick người không có trong phòng (404) → không gọi meeting', async () => {
    const { service, memberModel, meetings } = build();
    memberModel.deleteOne.mockReturnValue(query({ deletedCount: 0 }));

    await expect(service.kickMember(userId, roomId, targetId)).rejects.toBeInstanceOf(NotFoundException);
    expect(meetings.removeFromActiveMeeting).not.toHaveBeenCalled();
  });

  it('MEMBER kick (403) → không gọi meeting', async () => {
    const { service, access, meetings } = build();
    access.assertRoomPermission.mockRejectedValue(new ForbiddenException());

    await expect(service.kickMember(userId, roomId, targetId)).rejects.toBeInstanceOf(ForbiddenException);
    expect(meetings.removeFromActiveMeeting).not.toHaveBeenCalled();
  });

  it('rời phòng → đưa mình ra khỏi meeting đang diễn ra', async () => {
    const { service, meetings } = build();

    await service.leaveRoom(userId, roomId);

    expect(meetings.removeFromActiveMeeting).toHaveBeenCalledWith(roomId, userId);
  });

  it('rời phòng khi bản ghi đã bị xoá ở request khác → vẫn đưa ra khỏi meeting', async () => {
    const { service, memberModel, meetings } = build();
    memberModel.deleteOne.mockReturnValue(query({ deletedCount: 0 }));

    await service.leaveRoom(userId, roomId);

    expect(meetings.removeFromActiveMeeting).toHaveBeenCalledWith(roomId, userId);
  });

  it('giải tán → kết thúc meeting đang diễn ra, SAU khi đổi status phòng', async () => {
    const { service, roomModel, meetings } = build();

    await service.dissolveRoom(userId, roomId);

    expect(meetings.endActiveMeetingOfRoom).toHaveBeenCalledWith(roomId);
    expect(roomModel.updateOne.mock.invocationCallOrder[0]).toBeLessThan(
      meetings.endActiveMeetingOfRoom.mock.invocationCallOrder[0],
    );
  });

  it('MEMBER giải tán (403) → không gọi meeting', async () => {
    const { service, access, meetings } = build();
    access.assertRoomPermission.mockRejectedValue(new ForbiddenException());

    await expect(service.dissolveRoom(userId, roomId)).rejects.toBeInstanceOf(ForbiddenException);
    expect(meetings.endActiveMeetingOfRoom).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 6: Chạy test rooms — phải fail**

```powershell
Set-Location backend; npx vitest run src/modules/rooms/rooms.service.spec.ts; Set-Location ..
```
Expected: 4 test mới FAIL (`expected "spy" to be called`) — kick thành công, 2 test rời phòng, giải tán; 3 test "không gọi meeting" pass sẵn; test cũ vẫn pass.

- [ ] **Step 7: Sửa `rooms.service.ts`**

Thêm import (cạnh các import module khác):
```ts
import { MeetingsService } from '../meetings/meetings.service.js';
```
Constructor thêm tham số cuối:
```ts
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    // Kick / rời / giải tán ảnh hưởng meeting đang diễn ra (spec meeting §8)
    private meetings: MeetingsService,
  ) {}
```
`kickMember` — thay 2 dòng cuối:
```ts
    const removed = await this.removeMember(roomId, targetUserId);
    if (!removed) {
      throw new NotFoundException('Người này không có trong phòng');
    }
    // TODO(chat gateway): thu hồi socket của người bị kick khỏi kênh room:{roomId}
```
bằng:
```ts
    const removed = await this.removeMember(roomId, targetUserId);
    if (!removed) {
      throw new NotFoundException('Người này không có trong phòng');
    }
    // Đưa ra khỏi cuộc gọi đang diễn ra — hàm không ném lỗi, kick vẫn 204
    await this.meetings.removeFromActiveMeeting(roomId, targetUserId);
    // TODO(chat gateway): thu hồi socket của người bị kick khỏi kênh room:{roomId}
```
`leaveRoom` — thay:
```ts
    await this.removeMember(roomId, userId);
    // TODO(chat gateway): thu hồi socket của người vừa rời khỏi kênh room:{roomId}
```
bằng:
```ts
    await this.removeMember(roomId, userId);
    // Rời phòng thì rời luôn cuộc gọi đang diễn ra
    await this.meetings.removeFromActiveMeeting(roomId, userId);
    // TODO(chat gateway): thu hồi socket của người vừa rời khỏi kênh room:{roomId}
```
`dissolveRoom` — thay dòng:
```ts
    // TODO(module meeting): kết thúc meeting ACTIVE của room với EndReason.ROOM_DISSOLVED
```
bằng:
```ts
    // Kết thúc meeting đang diễn ra (ROOM_DISSOLVED) + đóng room LiveKit — hàm không ném lỗi
    await this.meetings.endActiveMeetingOfRoom(roomId);
```

`rooms.module.ts` — thêm import và vào `imports`:
```ts
import { MeetingsModule } from '../meetings/meetings.module.js';
```
```ts
    // MeetingsService: kick / rời / giải tán ảnh hưởng meeting đang diễn ra
    MeetingsModule,
```

- [ ] **Step 8: Toàn bộ test + build + chạy thật**

```powershell
Set-Location backend; npm test; npm run build; Set-Location ..
docker compose up -d --build
docker compose logs backend --tail 20
```
Expected: `Tests 128 passed (128)`; build exit 0; `Nest application successfully started` (không lỗi DI vòng). Chạy **Phụ lục B, B2**. Expected đúng như comment.

- [ ] **Step 9: `docs/api/endpoint.md` — sửa nhóm Rooms**

`DELETE /rooms/:roomId/members/me`: thêm gạch đầu dòng `- Đang ở trong buổi học → bị đưa ra khỏi cuộc gọi.`
`DELETE /rooms/:roomId/members/:userId`: thêm `- Người bị kick đang ở trong buổi học → bị đưa ra khỏi cuộc gọi; vào lại bằng token cũ cũng bị đưa ra (webhook kiểm thành viên).`
`POST /rooms/:roomId/dissolve`: thay dòng `- Chưa làm: kết thúc meeting đang diễn ra (chờ module meeting).` bằng `- Buổi học đang diễn ra kết thúc với \`ROOM_DISSOLVED\`, mọi người bị ngắt khỏi cuộc gọi.`
Lỗi LiveKit ở 3 thao tác này **không** đổi mã trả về (vẫn `204`) — ghi chú một dòng dưới tiêu đề nhóm Rooms.

- [ ] **Step 10: Progress + commit (khi user cho phép)**

```powershell
git add backend/src docs/api/endpoint.md docs/progress.md
git commit -m "feat: kick, rời, giải tán phòng đưa người ra khỏi buổi học đang diễn ra" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 8: Frontend — khu "Buổi học" ở trang room

Spec §11.1, §11.2. Chưa cần package LiveKit (Task 9 cài). Không viết unit test (page UI — CLAUDE.md).

**Files:**
- Modify: `frontend/src/services/room.service.ts` (`export` hàm `request`)
- Create: `frontend/src/types/meeting.ts`
- Create: `frontend/src/services/meeting.service.ts`
- Create: `frontend/src/features/meetings/meeting-section.tsx`
- Modify: `frontend/app/rooms/[roomId]/page.tsx`
- Modify: `docs/progress.md`

**Interfaces:**
- Consumes: API Task 4–5 (`docs/api/endpoint.md` nhóm Meetings).
- Produces:
  - Kiểu `Meeting`, `MeetingListResponse`, `JoinMeetingResponse`, `EndReason` (`@/types/meeting`).
  - `startMeeting(token, roomId, title)`, `listMeetings(token, roomId)`, `joinMeeting(token, meetingId)`, `endMeeting(token, meetingId)` (`@/services/meeting.service`).
  - `<MeetingSection roomId token isHost />` (`@/features/meetings/meeting-section`).

- [ ] **Step 1: Export `request`**

`frontend/src/services/room.service.ts`, thay dòng:
```ts
async function request<T>(token: string, path: string, init: RequestInit = {}): Promise<T> {
```
bằng:
```ts
export async function request<T>(token: string, path: string, init: RequestInit = {}): Promise<T> {
```

- [ ] **Step 2: Kiểu dữ liệu + gọi API**

`frontend/src/types/meeting.ts`:
```ts
// Kiểu dữ liệu khớp response của backend (docs/api/endpoint.md — Meetings)
import type { RoomRole } from './room';

export type MeetingStatus = 'ACTIVE' | 'ENDED';
export type EndReason = 'HOST_ENDED' | 'AUTO_EMPTY' | 'ROOM_DISSOLVED';

export interface Meeting {
  id: string;
  roomId: string;
  title: string;
  status: MeetingStatus;
  createdBy: string;
  startedAt: string;
  endedAt: string | null;
  endReason: EndReason | null;
  peakParticipants: number;
  totalParticipants: number;
  messageCount: number;
  durationSeconds: number;
}

export interface MeetingListResponse {
  items: Meeting[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface JoinMeetingResponse {
  token: string;
  livekitUrl: string;
  myRole: RoomRole;
  meeting: Meeting;
}
```

`frontend/src/services/meeting.service.ts`:
```ts
import type { JoinMeetingResponse, Meeting, MeetingListResponse } from '@/types/meeting';
import { request } from './room.service';

export const startMeeting = (token: string, roomId: string, title: string) =>
  request<Meeting>(token, `/rooms/${roomId}/meetings`, { method: 'POST', body: JSON.stringify({ title }) });

// 20 buổi gần nhất — không phân trang (spec §11.2)
export const listMeetings = (token: string, roomId: string) =>
  request<MeetingListResponse>(token, `/rooms/${roomId}/meetings?page=1&limit=20`);

export const joinMeeting = (token: string, meetingId: string) =>
  request<JoinMeetingResponse>(token, `/meetings/${meetingId}/join`, { method: 'POST' });

export const endMeeting = (token: string, meetingId: string) =>
  request<void>(token, `/meetings/${meetingId}/end`, { method: 'POST' });
```

- [ ] **Step 3: `MeetingSection`**

`frontend/src/features/meetings/meeting-section.tsx`:
```tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { endMeeting, listMeetings, startMeeting } from '@/services/meeting.service';
import type { EndReason, Meeting } from '@/types/meeting';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

const END_REASON_LABEL: Record<EndReason, string> = {
  HOST_ENDED: 'Host kết thúc',
  AUTO_EMPTY: 'Tự kết thúc',
  ROOM_DISSOLVED: 'Phòng giải tán',
};

// "Buổi học 05/10 14:30" theo giờ trình duyệt — backend không xử lý múi giờ (spec §5.2)
function defaultTitle() {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `Buổi học ${pad(now.getDate())}/${pad(now.getMonth() + 1)} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  return minutes >= 60 ? `${Math.floor(minutes / 60)} giờ ${minutes % 60} phút` : `${minutes} phút`;
}

// Khu "Buổi học" ở trang phòng. Nút của HOST chỉ ẩn/hiện — backend mới kiểm quyền.
// Chưa tự cập nhật khi buổi học bắt đầu / kết thúc (chờ bước Realtime gateway) — tải lại trang để thấy.
export function MeetingSection({ roomId, token, isHost }: { roomId: string; token: string; isHost: boolean }) {
  const router = useRouter();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [error, setError] = useState('');
  const [title, setTitle] = useState(defaultTitle);
  // Tăng lên để tải lại danh sách sau mỗi thao tác
  const [reloadKey, setReloadKey] = useState(0);
  const reload = () => setReloadKey((k) => k + 1);

  useEffect(() => {
    listMeetings(token, roomId)
      .then((res) => setMeetings(res.items))
      .catch((err: Error) => setError(err.message));
  }, [token, roomId, reloadKey]);

  // Mới nhất đứng đầu → buổi đang diễn ra (nếu có) là items[0]
  const active = meetings[0]?.status === 'ACTIVE' ? meetings[0] : null;
  const history = active ? meetings.slice(1) : meetings;

  const start = async () => {
    setError('');
    try {
      const meeting = await startMeeting(token, roomId, title);
      router.push(`/meetings/${meeting.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Có lỗi xảy ra');
      // 409: đang có buổi học diễn ra → tải lại để thấy và vào
      reload();
    }
  };

  const end = async (meetingId: string) => {
    if (!confirm('Kết thúc buổi học? Mọi người trong cuộc gọi sẽ bị ngắt.')) return;
    setError('');
    try {
      await endMeeting(token, meetingId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Có lỗi xảy ra');
    }
    reload();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Buổi học</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {active ? (
          <div className="flex items-center justify-between gap-3 rounded-md border p-3">
            <div>
              <p className="font-semibold">{active.title}</p>
              <p className="text-sm text-muted-foreground">
                Đang diễn ra từ {new Date(active.startedAt).toLocaleTimeString('vi-VN')}
              </p>
            </div>
            <div className="flex gap-2">
              <Button asChild>
                <Link href={`/meetings/${active.id}`}>Tham gia</Link>
              </Button>
              {/* Kết thúc dùng được cả khi buổi học bị kẹt (API idempotent) */}
              {isHost && (
                <Button variant="destructive" onClick={() => end(active.id)}>
                  Kết thúc
                </Button>
              )}
            </div>
          </div>
        ) : isHost ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              start();
            }}
            className="flex gap-3"
          >
            <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={100} required />
            <Button type="submit">Bắt đầu</Button>
          </form>
        ) : (
          <p className="text-sm text-muted-foreground">Chưa có buổi học nào đang diễn ra.</p>
        )}

        {history.length > 0 && (
          <ul className="divide-y">
            {history.map((m) => (
              <li key={m.id} className="flex justify-between items-center py-2 gap-3">
                <div>
                  <p className="font-medium">{m.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {new Date(m.startedAt).toLocaleString('vi-VN')} · {formatDuration(m.durationSeconds)} · tối đa{' '}
                    {m.peakParticipants} / tổng {m.totalParticipants} người
                  </p>
                </div>
                {m.endReason && <Badge variant="secondary">{END_REASON_LABEL[m.endReason]}</Badge>}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 4: Gắn vào trang room**

`frontend/app/rooms/[roomId]/page.tsx`: thêm import (cạnh các import `@/components/ui/...`):
```tsx
import { MeetingSection } from '@/features/meetings/meeting-section';
```
Chèn ngay **sau** `</Card>` của khối `{/* Chia sẻ mã / đường dẫn */}` và **trước** `{/* Thành viên */}`:
```tsx
        {/* Buổi học: bắt đầu / tham gia / kết thúc / lịch sử */}
        <MeetingSection roomId={roomId} token={token} isHost={isHost} />
```

- [ ] **Step 5: Build + lint**

```powershell
Set-Location frontend; npm run build; npm run lint; Set-Location ..
```
Expected: build exit 0; lint chỉ còn 2 lỗi + 3 warning có sẵn (`auth.context.tsx` 35:7, 36:7) — không lỗi mới.

- [ ] **Step 6: Chạy tay**

Backend + LiveKit đang chạy (`docker compose up -d`). `Set-Location frontend; npm run dev`. Hai profile Chrome riêng (profile riêng = localStorage riêng → đăng nhập 2 tài khoản):
```powershell
& "C:\Program Files\Google\Chrome\Application\chrome.exe" --user-data-dir="$env:TEMP\chrome-meeting-b" --use-fake-device-for-media-stream http://localhost:3000
```
1. HOST (profile thường): vào phòng → thấy khu "Buổi học", ô tên điền sẵn "Buổi học dd/MM HH:mm" đúng giờ máy → **Bắt đầu** → chuyển sang `/meetings/<id>` (trang chưa có — 404 là đúng ở task này). Quay lại trang phòng, tải lại → thấy buổi đang diễn ra + **Tham gia** + **Kết thúc**.
2. MEMBER (profile B): vào phòng → thấy buổi đang diễn ra + **Tham gia**, **không** có nút Kết thúc, không có ô Bắt đầu.
3. HOST bấm **Kết thúc** → buổi học xuống danh sách lịch sử với nhãn "Host kết thúc".
4. HOST bấm Bắt đầu 2 lần thật nhanh → lần 2 hiện lỗi "Phòng đang có buổi học diễn ra" (hoặc đã chuyển trang) — không có 2 buổi ACTIVE.

- [ ] **Step 7: Progress + commit (khi user cho phép)**

```powershell
git add frontend/src frontend/app docs/progress.md
git commit -m "feat: frontend khu buổi học ở trang phòng" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Frontend — trang cuộc gọi `/meetings/[meetingId]`

Spec §11.3–§11.5, §16. Không viết unit test (page UI).

**Files:**
- Modify: `frontend/package.json`, `frontend/package-lock.json`
- Create: `frontend/app/meetings/[meetingId]/page.tsx`
- Create: `frontend/src/features/meetings/meeting-stage.tsx`
- Modify: `docs/progress.md`

**Interfaces:**
- Consumes: `joinMeeting`, `endMeeting`, `JoinMeetingResponse` (Task 8); `useAuth`, `useProtectedRoute` (có sẵn).
- Produces: route `/meetings/[meetingId]` (Task 10 kiểm); `<MeetingStage />` (chỉ dùng bên trong `<LiveKitRoom>`).

- [ ] **Step 1: Cài 3 package**

```powershell
Set-Location frontend
npm install livekit-client @livekit/components-react @livekit/components-styles
Set-Location ..
```
Expected: `package.json` có 3 package. **Lỗi peer dependency** (React 19 / Next 16) → DỪNG, dán lỗi, hỏi user — không tự thêm `--legacy-peer-deps` / `--force`.

- [ ] **Step 2: `MeetingStage`**

`frontend/src/features/meetings/meeting-stage.tsx`:
```tsx
'use client';

import { ControlBar, GridLayout, ParticipantTile, RoomAudioRenderer, useTracks } from '@livekit/components-react';
import { Track } from 'livekit-client';

// Phần cuộc gọi — PHẢI nằm bên trong <LiveKitRoom>: useTracks cần RoomContext (spec §11.3).
// Không dùng <VideoConference>: nó tự gắn <Chat> chạy trên data channel (trái P2 — app data đi Socket.IO)
export function MeetingStage() {
  // Camera của mọi người (chưa bật cam vẫn có ô placeholder) + màn hình đang chia sẻ
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false },
  );

  return (
    <div className="flex h-full flex-col">
      {/* GridLayout tự phân trang khi nhiều ô (webrtc.md §5) */}
      <GridLayout tracks={tracks} className="min-h-0 flex-1">
        <ParticipantTile />
      </GridLayout>
      {/* Tắt nút chat: chat của hệ thống đi Socket.IO, không qua LiveKit */}
      <ControlBar controls={{ chat: false }} />
      <RoomAudioRenderer />
    </div>
  );
}
```

- [ ] **Step 3: Trang cuộc gọi**

`frontend/app/meetings/[meetingId]/page.tsx`:
```tsx
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { LiveKitRoom } from '@livekit/components-react';
import { DisconnectReason, MediaDeviceFailure, VideoPresets, type RoomOptions } from 'livekit-client';
import '@livekit/components-styles';
import { useAuth } from '@/context/auth.context';
import { useProtectedRoute } from '@/hooks/useProtectedRoute';
import { endMeeting, joinMeeting } from '@/services/meeting.service';
import type { JoinMeetingResponse } from '@/types/meeting';
import { MeetingStage } from '@/features/meetings/meeting-stage';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

// Hằng số cấp module (config bất biến) → prop `options` không đổi giữa các lần render (spec §11.3, §11.4)
const ROOM_OPTIONS: RoomOptions = {
  adaptiveStream: true, // nhận đúng layer theo kích thước ô, dừng video ô không hiển thị
  dynacast: true, // ngừng gửi layer không ai xem
  videoCaptureDefaults: { resolution: VideoPresets.h360.resolution }, // mặc định h720; mục tiêu webrtc.md §6 là 360p
};

// Thông báo khi bị ngắt — lý do khác → "Mất kết nối" + nút Vào lại (spec §11.3)
const DISCONNECT_MESSAGE: Partial<Record<DisconnectReason, string>> = {
  [DisconnectReason.ROOM_DELETED]: 'Buổi học đã kết thúc',
  [DisconnectReason.PARTICIPANT_REMOVED]: 'Bạn đã bị mời ra khỏi buổi học',
  [DisconnectReason.DUPLICATE_IDENTITY]: 'Bạn đã vào buổi học từ tab khác',
};

const DEVICE_MESSAGE: Record<MediaDeviceFailure, string> = {
  [MediaDeviceFailure.PermissionDenied]: 'trình duyệt chưa được cấp quyền',
  [MediaDeviceFailure.NotFound]: 'không tìm thấy thiết bị',
  [MediaDeviceFailure.DeviceInUse]: 'thiết bị đang được ứng dụng khác dùng',
  [MediaDeviceFailure.Other]: 'lỗi không xác định',
};

// Khung giữa màn hình cho các trạng thái chờ / lỗi / đã kết thúc
function Screen({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">{children}</div>;
}

export default function MeetingPage() {
  const { meetingId } = useParams<{ meetingId: string }>();
  const { token } = useAuth();
  const { isLoading } = useProtectedRoute();
  const router = useRouter();

  const [join, setJoin] = useState<JoinMeetingResponse | null>(null);
  const [joinError, setJoinError] = useState('');
  // Đã bị ngắt: thông báo + có cho "Vào lại" không
  const [ended, setEnded] = useState<{ message: string; canRetry: boolean } | null>(null);
  const [deviceWarning, setDeviceWarning] = useState('');
  const [actionError, setActionError] = useState('');
  // Tăng lên để gọi lại API vào meeting (nút "Vào lại")
  const [attempt, setAttempt] = useState(0);
  // Cờ "đã kết nối" để trong ref, không trong state → onError có deps [] (spec §11.4)
  const connectedRef = useRef(false);

  // Cờ huỷ: Strict Mode chạy effect 2 lần → API bị gọi 2 lần nhưng chỉ 1 token tới <LiveKitRoom> (spec §11.4)
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    joinMeeting(token, meetingId)
      .then((res) => {
        if (!cancelled) setJoin(res);
      })
      .catch((err: Error) => {
        if (!cancelled) setJoinError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [token, meetingId, attempt]);

  const roomId = join?.meeting.roomId;

  // Mọi callback truyền cho <LiveKitRoom> bọc useCallback với deps không đổi: effect kết nối của nó
  // có onError trong deps và gọi lại room.connect mỗi khi deps đổi — kể cả lúc đang Reconnecting (spec §11.4)
  const onConnected = useCallback(() => {
    connectedRef.current = true;
  }, []);

  const onDisconnected = useCallback(
    (reason?: DisconnectReason) => {
      // Tự bấm Rời ở thanh điều khiển → về trang phòng
      if (reason === DisconnectReason.CLIENT_INITIATED) {
        router.push(roomId ? `/rooms/${roomId}` : '/rooms');
        return;
      }
      const message = reason !== undefined ? DISCONNECT_MESSAGE[reason] : undefined;
      setEnded(message ? { message, canRetry: false } : { message: 'Mất kết nối tới buổi học', canRetry: true });
    },
    [router, roomId],
  );

  // Chỉ chặn khi CHƯA kết nối được (token sai, room không tồn tại…); sau đó lỗi thiết bị do banner lo
  const onError = useCallback((err: Error) => {
    if (!connectedRef.current) {
      setEnded({ message: `Không kết nối được buổi học: ${err.message}`, canRetry: true });
    }
  }, []);

  // Lỗi camera / micro không chặn cuộc gọi — vẫn nghe và xem được mọi người (spec §11.5)
  const onMediaDeviceFailure = useCallback((failure?: MediaDeviceFailure, kind?: MediaDeviceKind) => {
    const device = kind === 'audioinput' ? 'micro' : 'camera';
    setDeviceWarning(
      `Không bật được ${device}: ${DEVICE_MESSAGE[failure ?? MediaDeviceFailure.Other]}. ` +
        'Bạn vẫn nghe và xem được mọi người; có thể bật lại ở thanh điều khiển.',
    );
  }, []);

  const retry = () => {
    connectedRef.current = false;
    setJoin(null);
    setJoinError('');
    setEnded(null);
    setAttempt((a) => a + 1);
  };

  // HOST kết thúc cho mọi người → LiveKit ngắt tất cả với ROOM_DELETED → màn hình "Buổi học đã kết thúc"
  const endForAll = async () => {
    if (!token || !confirm('Kết thúc buổi học cho mọi người?')) return;
    setActionError('');
    try {
      await endMeeting(token, meetingId);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Có lỗi xảy ra');
    }
  };

  const backHref = roomId ? `/rooms/${roomId}` : '/rooms';

  if (isLoading || !token) {
    return (
      <Screen>
        <p className="text-lg text-muted-foreground">Đang tải...</p>
      </Screen>
    );
  }

  if (joinError) {
    return (
      <Screen>
        <Alert variant="destructive" className="max-w-sm">
          <AlertDescription>{joinError}</AlertDescription>
        </Alert>
        <Button asChild variant="link">
          <Link href="/rooms">← Về danh sách phòng</Link>
        </Button>
      </Screen>
    );
  }

  if (ended) {
    return (
      <Screen>
        <p className="text-lg font-semibold">{ended.message}</p>
        {ended.canRetry && <Button onClick={retry}>Vào lại</Button>}
        <Button asChild variant="link">
          <Link href={backHref}>← Về phòng</Link>
        </Button>
      </Screen>
    );
  }

  if (!join) {
    return (
      <Screen>
        <p className="text-lg text-muted-foreground">Đang vào buổi học...</p>
      </Screen>
    );
  }

  return (
    <div className="flex h-screen flex-col" data-lk-theme="default">
      <header className="flex items-center justify-between gap-3 px-4 py-2">
        <h1 className="font-semibold">{join.meeting.title}</h1>
        {/* Chỉ ẩn/hiện — backend kiểm quyền HOST */}
        {join.myRole === 'HOST' && (
          <Button variant="destructive" size="sm" onClick={endForAll}>
            Kết thúc buổi học
          </Button>
        )}
      </header>
      {(deviceWarning || actionError) && (
        <Alert variant={actionError ? 'destructive' : 'default'} className="mx-4 w-auto">
          <AlertDescription>{actionError || deviceWarning}</AlertDescription>
        </Alert>
      )}
      {/* Chỉ render khi đã có token → token / serverUrl đặt một lần, không đổi */}
      <LiveKitRoom
        serverUrl={join.livekitUrl}
        token={join.token}
        connect
        audio
        video
        options={ROOM_OPTIONS}
        onConnected={onConnected}
        onDisconnected={onDisconnected}
        onError={onError}
        onMediaDeviceFailure={onMediaDeviceFailure}
        className="min-h-0 flex-1"
      >
        <MeetingStage />
      </LiveKitRoom>
    </div>
  );
}
```

- [ ] **Step 4: Build + lint**

```powershell
Set-Location frontend; npm run build; npm run lint; Set-Location ..
```
Expected: build exit 0, route `ƒ /meetings/[meetingId]` (hoặc `○`) có trong danh sách; lint không lỗi mới. TS báo `MediaDeviceFailure` / `DisconnectReason` / `RoomOptions` không export từ `livekit-client` → xem `node_modules/livekit-client/dist/src/index.d.ts`, sửa đường import cho đúng (không đổi hành vi), ghi progress.

- [ ] **Step 5: Chạy tay nhanh** (kiểm đủ 11 kịch bản ở Task 10)

Như Task 8 Step 6 (2 profile Chrome). HOST bắt đầu → vào trang cuộc gọi, cho phép cam / mic. MEMBER bấm Tham gia. Expected:
- Hai bên thấy và nghe nhau; MEMBER bấm nút chia sẻ màn hình → HOST thấy màn hình; **không** có nút chat ở thanh điều khiển.
- MEMBER bấm Rời → về trang phòng (không hiện "Mất kết nối").
- HOST bấm **Kết thúc buổi học** → cả hai thấy "Buổi học đã kết thúc".
- Đang `npm run dev` (Strict Mode): vào trang cuộc gọi **không** bị đá về trang phòng.

- [ ] **Step 6: Progress + commit (khi user cho phép)**

```powershell
git add frontend/package.json frontend/package-lock.json frontend/app/meetings frontend/src/features/meetings/meeting-stage.tsx docs/progress.md
git commit -m "feat: trang cuộc gọi buổi học bằng LiveKit (video, audio, chia sẻ màn hình)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Chạy thật 11 kịch bản + chốt tài liệu

Spec §13, §14. Không viết code mới (trừ dòng log tạm ở kịch bản 11 — đồ bỏ). Output thật dán vào progress.

**Files:**
- Modify: `docs/architecture/webrtc.md` (§1 trạng thái, §5)
- Modify: `docs/progress.md`
- Đồ bỏ (không commit): `frontend/public/lk-test.html`, 2 dòng `setLogLevel` trong `frontend/app/meetings/[meetingId]/page.tsx`

**Interfaces:**
- Consumes: toàn bộ Task 1–9; khoảng gửi lại webhook đo ở Task 1 Step 14.

- [ ] **Step 1: Kiểm đầu phiên + chạy toàn bộ**

```powershell
git status --short
Set-Location backend; npm test; npm run build; Set-Location ..
Set-Location frontend; npm run build; npm run lint; Set-Location ..
docker compose up -d --build
docker compose ps
```
Expected: `Tests 128 passed (128)`; 2 build exit 0; lint không lỗi mới; 4 container `mongo-dev`, `redis-dev`, `livekit-dev`, `backend-dev` đều `running`. Rồi `Set-Location frontend; npm run dev`.

Chuẩn bị: 2 tài khoản (HOST ở Chrome thường, MEMBER ở profile B — lệnh ở Task 8 Step 6), cùng một phòng. Lấy `meetingId` từ URL `/meetings/<id>` mỗi lần bắt đầu buổi mới, gán vào PowerShell: `$id = '<id>'`. Lệnh kiểm dùng chung:
```powershell
docker exec mongo-dev mongosh online-group-learning --quiet --eval "printjson(db.meetings.findOne({ _id: ObjectId('$id') }, { status: 1, endReason: 1, startedAt: 1, endedAt: 1, peakParticipants: 1, totalParticipants: 1, durationSeconds: 1 }))"
docker exec mongo-dev mongosh online-group-learning --quiet --eval "printjson(db.meeting_participants.find({ meetingId: ObjectId('$id') }, { displayName: 1, roleAtJoin: 1, sessions: 1, totalDurationSeconds: 1 }).toArray())"
docker exec redis-dev redis-cli SMEMBERS "presence:$id"
```

- [ ] **Step 2: Kịch bản 1–6**

| # | Làm | Expected (dán output lệnh kiểm vào progress) |
|---|---|---|
| 1 | HOST bắt đầu, cả hai vào; MEMBER chia sẻ màn hình | Thấy / nghe nhau, HOST thấy màn hình MEMBER. Mongo: 2 participant, mỗi người 1 session có `sid`, `leftAt: null`; presence 2 userId; `peakParticipants: 2`. |
| 2 | MEMBER bấm Rời | Về trang phòng. Session MEMBER có `leftAt`; presence còn 1 (HOST). |
| 3 | MEMBER vào lại; HOST ở trang phòng (tab khác) kick MEMBER | MEMBER thấy "Bạn đã bị mời ra khỏi buổi học"; MEMBER mở lại URL meeting → "Bạn không phải thành viên room này" (403). |
| 4 | Thêm lại MEMBER (ô "Thêm" bằng email), MEMBER vào; HOST bấm Kết thúc buổi học | Cả hai thấy "Buổi học đã kết thúc". Mongo: `ENDED`, `HOST_ENDED`, `durationSeconds` khớp thời gian thật, `totalParticipants: 2`, mọi session có `leftAt`; presence rỗng (key đã xoá). |
| 5 | Buổi mới, cả hai vào rồi cùng Rời; chờ 3 phút | Mongo: `AUTO_EMPTY`, `endedAt` ≈ `leftAt` muộn nhất (lệch vài giây — nhờ `roomEndReason`). Ghi rõ lệch bao nhiêu giây. |
| 6 | Buổi mới, MEMBER đang trong call; HOST giải tán phòng | MEMBER thấy "Buổi học đã kết thúc"; Mongo `ROOM_DISSOLVED`. (Phòng mất → tạo phòng mới cho các kịch bản sau.) |

- [ ] **Step 3: Kịch bản 7 — tự hồi phục khi mất `room_finished`**

1. Phòng mới, HOST bắt đầu, cả hai vào, gán `$id`.
2. `docker compose stop backend`.
3. Cả hai bấm Rời (cuộc gọi vẫn chạy vì media không qua backend; Rời có thể báo lỗi chuyển trang — bỏ qua).
4. Chờ `3 phút + 2 × khoảng gửi lại đo ở Task 1` (vd Task 1 đo 15 s → chờ 3 phút 30 giây). `docker compose logs livekit --tail 30` thấy webhook gửi tới `host.docker.internal:3001` thất bại rồi bị bỏ.
5. `docker compose start backend`; lệnh kiểm meeting → vẫn `ACTIVE` (đúng: mất webhook).
6. HOST tải lại trang phòng → bấm **Tham gia** → "Buổi học đã kết thúc" (409, tự hồi phục) **hoặc** bấm **Bắt đầu** buổi mới → tạo được.
Expected: meeting cũ `ENDED`, `AUTO_EMPTY`, `endedAt` = lúc phát hiện (giới hạn spec §14 mục 3); buổi mới tạo được.

- [ ] **Step 4: Kịch bản 8–9**

8. ```powershell
   curl.exe -s -o NUL -w "%{http_code}`n" -X POST http://localhost:3001/webhooks/livekit -H "Content-Type: application/webhook+json" -d "{}"
   ```
   Expected: `401`.
9. Đang `npm run dev`: MEMBER mở trang cuộc gọi, ở yên 30 giây. Expected: không bị đá về trang phòng; Mongo **1 session** cho MEMBER trong buổi đó; console trình duyệt không có lỗi đỏ từ LiveKit.

- [ ] **Step 5: Kịch bản 10 — bị kick rồi vào lại bằng token cũ**

1. Chép `frontend/public/lk-test.html` từ **Phụ lục A** (đồ bỏ).
2. MEMBER vào buổi học. Mở DevTools (F12) → Network → request `join` → Response → chép `token`.
3. HOST kick MEMBER → MEMBER thấy "Bạn đã bị mời ra khỏi buổi học".
4. Ở profile B mở `http://localhost:3000/lk-test.html`, dán token cũ, **bỏ** dấu "bật cam + mic", Connect.
Expected: log trang có `Connected` rồi trong khoảng 1 giây `Disconnected, reason = … PARTICIPANT_REMOVED`; `docker compose logs backend --tail 20` không có lỗi; Mongo **không** có session mới cho MEMBER sau thời điểm kick. Ghi thời gian từ Connected tới Disconnected.
5. `Remove-Item frontend/public/lk-test.html`.

- [ ] **Step 6: Kịch bản 11 — lỗi thiết bị + callback cố định**

1. **Tạm** (đồ bỏ) thêm vào `frontend/app/meetings/[meetingId]/page.tsx` ngay dưới các import:
   ```tsx
   import { setLogLevel } from 'livekit-client';
   import { setLogLevel as setComponentsLogLevel } from '@livekit/components-react';
   setLogLevel('debug');
   setComponentsLogLevel('debug');
   ```
   (`@livekit/components-react` không export `setLogLevel` → import từ `@livekit/components-core`.)
2. Chrome thường: chặn quyền camera cho `localhost:3000` (biểu tượng khoá trên thanh địa chỉ → Camera → Chặn). HOST vào buổi học.
Expected: banner "Không bật được camera: trình duyệt chưa được cấp quyền…"; vẫn ở trong call, vẫn nghe MEMBER. Console: **đúng 1** dòng `connecting`, **không có** dòng `already connected to room`.
3. Gỡ 2 dòng tạm; `git diff frontend/app` phải rỗng. Mở lại quyền camera.

- [ ] **Step 7: `docs/architecture/webrtc.md`**

Dòng 3 thay `Trạng thái: **[PLANNED]** — chưa có code. Toàn bộ mục này là thiết kế` bằng:
```
Trạng thái: **[MỘT PHẦN ĐÃ LÀM]** — module meeting (spec `docs/task/meeting/meeting_module_spec.md`): token, webhook, LiveKit dev trong Docker Compose, trang cuộc gọi. Chưa có: TURN (bước deploy), benchmark (§7), audio-only.
```
§5, thay mục "Bật ngay từ đầu, không để tối ưu sau" bằng:
```
**Bật ngay từ đầu, không để tối ưu sau:**
- simulcast — ✅ mặc định của livekit-client
- dynacast — ✅ `RoomOptions.dynacast`
- adaptive stream — ✅ `RoomOptions.adaptiveStream` (nhận layer theo kích thước ô, dừng video ô không hiển thị)
- giới hạn resolution — ✅ quay 360p (`videoCaptureDefaults`); phía nhận do adaptive stream chọn layer theo ô
- chỉ subscribe video của ô trong viewport — ✅ `GridLayout` phân trang + adaptive stream
- audio-only mode cho meeting đông — ⏳ để bước benchmark, quyết theo số đo B1/B3 (spec meeting §1 câu 9)
```

- [ ] **Step 8: Kiểm cuối + progress**

```powershell
git status --short     # chỉ còn docs/architecture/webrtc.md, docs/progress.md
Set-Location backend; npm test; Set-Location ..
```
Ghi mục Task 10 vào `docs/progress.md`: output 11 kịch bản (dán nguyên lệnh kiểm), số liệu đo được (lệch `endedAt` ở kịch bản 5, thời gian bị đá ở kịch bản 10), giới hạn gặp thật. Thêm bảng tổng kết module meeting (Task → commit) giống "Tổng kết module room", mục **Để lại task sau**: socket `meeting:*` (bước gateway), TURN (deploy), audio-only + benchmark, whiteboard tạo khi bắt đầu meeting.

- [ ] **Step 9: Commit (khi user cho phép)**

```powershell
git add docs/architecture/webrtc.md docs/progress.md
git commit -m "docs: chốt module meeting sau khi chạy thật 11 kịch bản" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Phụ lục A — trang thử LiveKit `lk-test.html` (đồ bỏ)

Dùng ở Task 1 Step 10, Task 6 Step 7, Task 10 Step 5. Đặt tạm ở `frontend/public/lk-test.html` → mở `http://localhost:3000/lk-test.html` (localhost là secure context). **Xoá sau khi dùng, không commit.**

```html
<!doctype html>
<meta charset="utf-8" />
<title>LiveKit test (đồ bỏ)</title>
<script src="https://cdn.jsdelivr.net/npm/livekit-client/dist/livekit-client.umd.min.js"></script>
<p>
  <input id="url" value="ws://localhost:7880" size="28" />
  <input id="token" placeholder="dán token" size="60" />
  <label><input id="media" type="checkbox" checked /> bật cam + mic</label>
  <button id="go">Connect</button>
</p>
<pre id="log"></pre>
<div id="media-box"></div>
<script>
  const { Room, RoomEvent, DisconnectReason } = LivekitClient;
  const log = (...a) => {
    document.getElementById('log').textContent += new Date().toISOString() + ' ' + a.join(' ') + '\n';
  };
  document.getElementById('go').onclick = async () => {
    const room = new Room();
    room.on(RoomEvent.Connected, () => log('Connected room=' + room.name, 'identity=' + room.localParticipant.identity));
    room.on(RoomEvent.Disconnected, (reason) => log('Disconnected, reason =', reason, DisconnectReason[reason]));
    room.on(RoomEvent.ParticipantConnected, (p) => log('ParticipantConnected', p.identity));
    room.on(RoomEvent.TrackSubscribed, (track, _pub, p) => {
      log('TrackSubscribed', track.kind, 'từ', p.identity);
      document.getElementById('media-box').appendChild(track.attach());
    });
    try {
      await room.connect(document.getElementById('url').value, document.getElementById('token').value.trim());
      if (document.getElementById('media').checked) await room.localParticipant.enableCameraAndMicrophone();
    } catch (e) {
      log('Lỗi:', e.message);
    }
  };
</script>
```

## Phụ lục B — smoke API meeting (PowerShell)

Chạy ở gốc repo, container `backend` + `livekit` đang chạy. Biến header đặt tên `$hAuth` / `$mAuth` (PowerShell không phân biệt hoa thường — `$H` sẽ ghi đè `$h`).

**B1** — dòng 1–4 từ Task 4; dòng 5–9 từ Task 5:
```powershell
$api = 'http://localhost:3001'
$n = Get-Random -Maximum 999999
$h = Invoke-RestMethod -Method Post "$api/auth/register" -ContentType 'application/json' -Body (@{ email = "h$n@test.com"; username = "h$n"; displayName = 'Host'; password = '123456' } | ConvertTo-Json)
$m = Invoke-RestMethod -Method Post "$api/auth/register" -ContentType 'application/json' -Body (@{ email = "m$n@test.com"; username = "m$n"; displayName = 'Member'; password = '123456' } | ConvertTo-Json)
$hAuth = @{ Authorization = "Bearer $($h.accessToken)" }
$mAuth = @{ Authorization = "Bearer $($m.accessToken)" }
$room = Invoke-RestMethod -Method Post "$api/rooms" -Headers $hAuth -ContentType 'application/json' -Body '{"name":"Nhom meeting"}'
Invoke-RestMethod -Method Post "$api/rooms/join" -Headers $mAuth -ContentType 'application/json' -Body (@{ code = $room.joinCode } | ConvertTo-Json) | Out-Null
# Trả 'OK' nếu gọi thành công, ngược lại mã HTTP
function Status([scriptblock]$call) { try { & $call | Out-Null; 'OK' } catch { [int]$_.Exception.Response.StatusCode } }

# 1. MEMBER bắt đầu buổi học → 403
Status { Invoke-RestMethod -Method Post "$api/rooms/$($room.id)/meetings" -Headers $mAuth -ContentType 'application/json' -Body '{"title":"Buoi 1"}' }
# 2. HOST bắt đầu → có id, status ACTIVE
$mt = Invoke-RestMethod -Method Post "$api/rooms/$($room.id)/meetings" -Headers $hAuth -ContentType 'application/json' -Body '{"title":"Buoi 1"}'; $mt | Select-Object id, title, status
# 3. HOST bắt đầu lần 2 → 409
Status { Invoke-RestMethod -Method Post "$api/rooms/$($room.id)/meetings" -Headers $hAuth -ContentType 'application/json' -Body '{"title":"Buoi 2"}' }
# 4. Lịch sử (MEMBER) → 1 dòng ACTIVE
(Invoke-RestMethod "$api/rooms/$($room.id)/meetings" -Headers $mAuth).items | Select-Object id, title, status
# 5. MEMBER vào → ws://localhost:7880, MEMBER, độ dài token > 100
$j = Invoke-RestMethod -Method Post "$api/meetings/$($mt.id)/join" -Headers $mAuth; $j.livekitUrl; $j.myRole; $j.token.Length
# 6. MEMBER kết thúc → 403
Status { Invoke-RestMethod -Method Post "$api/meetings/$($mt.id)/end" -Headers $mAuth }
# 7. HOST kết thúc → OK; bấm lại → OK (idempotent)
Status { Invoke-RestMethod -Method Post "$api/meetings/$($mt.id)/end" -Headers $hAuth }
Status { Invoke-RestMethod -Method Post "$api/meetings/$($mt.id)/end" -Headers $hAuth }
# 8. MEMBER vào lại → 409
Status { Invoke-RestMethod -Method Post "$api/meetings/$($mt.id)/join" -Headers $mAuth }
# 9. Lịch sử → ENDED, HOST_ENDED
(Invoke-RestMethod "$api/rooms/$($room.id)/meetings" -Headers $mAuth).items | Select-Object title, status, endReason, durationSeconds
```

**B2** — từ Task 7, chạy sau toàn bộ B1 trong cùng cửa sổ:
```powershell
# 10. Buổi mới; kick MEMBER khi buổi đang chạy (MEMBER không ở trong room LiveKit) → OK — removeParticipant "không tìm thấy" được bỏ qua
$mt2 = Invoke-RestMethod -Method Post "$api/rooms/$($room.id)/meetings" -Headers $hAuth -ContentType 'application/json' -Body '{"title":"Buoi giai tan"}'
Status { Invoke-RestMethod -Method Delete "$api/rooms/$($room.id)/members/$($m.user.id)" -Headers $hAuth }
# 11. HOST giải tán → OK
Status { Invoke-RestMethod -Method Post "$api/rooms/$($room.id)/dissolve" -Headers $hAuth }
# 12. Buổi vừa tạo → status ENDED, endReason ROOM_DISSOLVED
docker exec mongo-dev mongosh online-group-learning --quiet --eval "printjson(db.meetings.findOne({ _id: ObjectId('$($mt2.id)') }, { status: 1, endReason: 1, endedAt: 1 }))"
# 13. Log backend không có dòng lỗi "Không đóng được room LiveKit" / "Không đưa được user"
docker compose logs backend --tail 30
```
