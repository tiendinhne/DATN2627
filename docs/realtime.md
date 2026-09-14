# Realtime Architecture (Socket.IO)

Trạng thái: **[PLANNED]** — chưa implement. Contract type đã có trong `shared/src/events/`.

## 1. Nguyên tắc

Socket.IO **chỉ** cho application data. Không bao giờ audio/video/screen.

- Namespace: `/meeting`
- Room: `meeting:${meetingId}`
- Transport: `['websocket']` only — xem ADR-006

## 2. Connection lifecycle

```
client connect (auth.token = JWT)
  → WsAuthGuard verify JWT  → resolve userId
  → check membership + meeting ACTIVE
  → socket.join(`meeting:${meetingId}`)
  → server emit meeting:snapshot
```

JWT truyền qua `socket.handshake.auth.token`, **không qua query string** (query bị log ở proxy). Socket chưa auth không được join room nào. Re-check membership mỗi lần join room.

## 3. Event envelope [CONFIRMED]

M��i event server → client bọc trong envelope:

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

M��i emit đi qua **một publisher duy nhất**, không gọi `server.to()` rải rác — để gắn envelope nhất quán và sau này thêm logging/metrics chỉ sửa một chỗ.

## 4. Event catalog [CONFIRMED]

**Client → Server**

| Event | Payload |
|---|---|
| `meeting:join` | `{ meetingId, lastSeq? }` |
| `chat:send` | `{ clientMsgId, content, fileId? }` |
| `wb:ops` | `{ elements[] }` |
| `wb:pointer` | `{ x, y }` |
| `wb:resync` | `{ lastSeq }` |
| `ai:generate` | `{ requestId, prompt, kind }` |

**Server → Client**

| Event | Payload |
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

## 5. Ordering, duplicate, reconnect [CONFIRMED]

- `seq` đơn điệu tăng, cấp bằng **Redis `INCR`** → atomic across instances, tự nhiên có total order
- **Ring buffer 500 op gần nhất** trong Redis List (LPUSH + LTRIM)
- Client reconnect gửi `lastSeq`: chênh ≤ 500 → **replay diff**; ngược lại → **full snapshot**
- Chống trùng chat: `clientMsgId` + unique index `{meetingId, clientMsgId}` → DB chặn, không cần logic dedupe
- Chống trùng whiteboard: idempotent tự nhiên nhờ LWW (áp lại cùng op cho cùng kết quả)
- Cursor đi kênh riêng, throttle 50ms, **không tăng `seq`**, không lưu

Cơ chế này phục vụ đồng thời reconnect thông thường **và** chuyển instance khi auto-scale.

## 6. Horizontal scale [CONFIRMED]

### 6.1 Vấn đề (diễn giải cho báo cáo)

GVHD: chép chương trình đếm số nguyên tố ra 10 máy không làm nó nhanh hơn.

Với web server, "chia việc" đã do load balancer làm sẵn vì mỗi request/connection là một đơn vị độc lập. Vấn đề thật nằm ở **chia sẻ trạng thái**. Nếu instance A giữ danh sách socket trong RAM thì 3 instance không phải một hệ thống mạnh gấp 3, mà là 3 hệ thống rời rạc cãi nhau về sự thật.

```
Đếm số nguyên tố:  vấn đề = chia công việc
Web server:        vấn đề = chia sẻ trạng thái
```

### 6.2 Checklist stateless

| State | Sai | Đúng |
|---|---|---|
| Session đăng nhập | MemoryStore | JWT stateless + refresh hash trong Mongo |
| Danh sách socket theo room | `Map<roomId, Socket[]>` | Socket.IO Redis adapter |
| Whiteboard live state | biến global | Redis `wb:{meetingId}` |
| Sequence counter | `let seq = 0` | Redis `INCR` |
| Ring buffer op | array trong RAM | Redis List |
| Presence | `Set<userId>` | Redis Set + TTL |
| Rate limit | counter in-memory | Redis `INCR` + `EXPIRE` |
| File upload | ghi `/tmp` local | Object Storage |
| Cron job | `@Cron` chạy mọi replica | Distributed lock |

### 6.3 LiveKit webhook trong môi trường đa instance

Webhook chỉ tới **một** instance. Mọi side effect phải đi qua Mongo hoặc Redis, không giữ trong RAM. Redis adapter lo fan-out tới client ở instance khác.

### 6.4 Scheduled job

`@nestjs/schedule` chạy trên mọi replica. Job auto-end meeting phải bọc distributed lock:

```
SET lock:auto-end-meetings <instanceId> NX PX 30000
```

Giải phóng bằng Lua script kiểm tra token khớp, tránh xoá nhầm lock của instance khác.
Limitation cần ghi trong báo cáo: chỉ một Redis nên lock là single point of failure.

### 6.5 Graceful shutdown

`GET /health` (liveness) + `GET /ready` (kiểm tra Mongo + Redis). Bắt `SIGTERM` → ngừng nhận kết nối mới → emit `server:draining` → chờ ~10s → đóng. Client reconnect sang instance khác và `wb:resync` theo `lastSeq`.

## 7. Kế hoạch chứng minh [PLANNED]

| # | Thí nghiệm | Kỳ vọng | Ý nghĩa |
|---|---|---|---|
| E1 | 2 instance, **tắt** Redis adapter, A ở inst-1, B ở inst-2 | B **không nhận được** | chứng minh phản đề |
| E2 | Lặp E1 với adapter **bật** | B nhận đủ, đúng thứ tự | code hỗ trợ distributed |
| E3 | Load test 1 / 2 / 3 instance | throughput tăng gần tuyến tính | scale ngang hiệu quả thật |
| E4 | Kill instance giữa phiên | reconnect, resync, **không mất op** | fault tolerance |
| E5 | AWS ASG auto-scale | instance tự thêm/bớt | phần khuyến khích của GVHD |

E1 + E2 là cặp quan trọng nhất — quay video hoặc chụp lại.
`instanceId` trong log là **bắt buộc** cho E3, không có nó thì không chứng minh được LB phân phối đều.
