# Architecture

## 1. Topology [CONFIRMED]

```
Browser
 ├─ https://app.<domain>    → Vercel (Next.js 15, CDN, HTTPS tự động)
 ├─ https://api.<domain>    → NGINX () ─┬─► backend-1 (NestJS)
 │   REST + Socket.IO (WSS)                           ├─► backend-2
 │                                                    └─► backend-3
 │                                                        │
 │                                          REDIS + MONGODB (shared state)
 ├─ wss://livekit.<domain>  → LiveKit :7880 (signaling)
 ├─ UDP 7882                → LiveKit media (SRTP)
 └─ TCP 5349                → LiveKit TURN/TLS (fallback)
```

Media WebRTC là UDP/SRTP đi **thẳng** tới LiveKit. NGINX chỉ proxy HTTP và WebSocket.

## 2. Trách nhiệm từng thành phần

| Thành phần | Chịu trách nhiệm | KHÔNG chịu trách nhiệm |
|---|---|---|
| Next.js (Vercel) | UI, interaction, auth state, LiveKit client, Socket.IO client, Excalidraw host | quyết định permission |
| NestJS | auth/authz, room/meeting/user, sinh LiveKit token, nhận LiveKit webhook, Socket.IO gateway, whiteboard authority, AI pipeline, persistence | media transport |
| LiveKit | media transport, SFU forwarding, simulcast/dynacast, congestion control, TURN | business logic |
| Redis | live whiteboard state, seq counter, ring buffer, presence, rate limit, distributed lock, Socket.IO pub/sub | persistence lâu dài |
| MongoDB | persistence | state thay đổi liên tục (số người online) |
| NGINX | TLS, reverse proxy, **load balancer** | media |

## 3. Nguồn sự thật [CONFIRMED]

Bảng này là quy tắc bất di bất dịch. Mọi tranh cãi "cái này ai quản" tra ở đây.

| Dữ liệu | Nguồn sự thật | Đường truyền |
|---|---|---|
| Audio/Video/Screen media | **LiveKit SFU** | WebRTC SRTP/UDP |
| Ai đang trong meeting | **LiveKit** | webhook → backend |
| Mic/Camera on-off | **LiveKit** track mute state | LiveKit events |
| Chat message | **Backend / MongoDB** | Socket.IO |
| Whiteboard element | **Redis (live) → Mongo (persist)** | Socket.IO |
| Room/Meeting/role | **Backend / MongoDB** | REST + Socket.IO |
| Cursor, typing | ephemeral, không lưu | Socket.IO |

**Client không được tự báo "tôi đã join".** Nếu cả LiveKit và Socket.IO cùng phát presence, hai nguồn sẽ lệch khi mạng chập chờn và không có cách nào biết cái nào đúng.

## 4. Module map [CONFIRMED]

```
backend/src/
├── config/              env.schema.ts (Zod fail-fast)
├── database/            mongoose connection
├── common/
│   ├── filters/         http-exception.filter.ts, ws-exception.filter.ts
│   ├── interceptors/    transform (_id→id), logging (instanceId)
│   ├── guards/ decorators/ pipes/ middleware/ utils/
│   └── redis/           RedisService, DistributedLockService
└── modules/
    ├── auth/            [layered]    dto, guards, strategies
    ├── users/           [layered]    schemas
    ├── rooms/           [layered]    dto, schemas
    ├── room-members/    [layered]    dto, schemas
    ├── meetings/        [hexagonal]  + ports/media-server, adapters/livekit, webhook controller
    ├── whiteboard/      [hexagonal]  + domain/lww-merge, ports/state, adapters/redis
    ├── chat/            [layered]    dto, schemas
    ├── ai-assistant/    [hexagonal]  + domain/dsl, ports/ai-provider, adapters/{gemini,elk}
    ├── files/           [hexagonal]  + ports/object-storage, adapters/{minio,r2}
    ├── realtime/        gateways, adapters (Redis IO adapter), dto
    └── health/          liveness + readiness cho LB/ASG

shared/src/{enums, events, permissions, whiteboard, errors} **hiẹn tại đang ở backend
frontend/src/{features, components, hooks, services, stores, lib, types}
infrastructure/{docker, nginx, livekit, redis}
```

Quy tắc nhận diện: có `domain/` + `ports/` → hexagonal. Chỉ có `*.service.ts` → layered. Xem ADR-019.

## 5. Event-driven [CONFIRMED]

Ba tầng, **không được gộp**:

| Tầng | Tên | Phạm vi | Cơ chế |
|---|---|---|---|
| Domain event | `meeting.ended` | trong 1 process | `EventEmitter2` |
| Realtime event | `meeting:ended` | server → client | Socket.IO |
| Cross-instance fan-out | — | giữa các backend instance | Socket.IO Redis adapter |

Domain event đổi tự do. Realtime event là contract với client, đổi phải sửa frontend.

**Catalog domain event dự kiến** [PLANNED]:

| Event | Phát bởi | Nghe bởi |
|---|---|---|
| `room.dissolved` | rooms | meetings, room-members |
| `meeting.started` | meetings | whiteboard (tạo/clone board) |
| `meeting.ended` | meetings | whiteboard (persist), chat (chốt count), participant (chốt duration), realtime |
| `participant.joined` | meetings (webhook) | meetings, realtime |
| `participant.left` | meetings (webhook) | meetings (check rỗng → auto-end), realtime |
| `whiteboard.ops-applied` | whiteboard | realtime, persistence scheduler |
| `chat.message-sent` | chat | realtime |
| `ai.diagram-generated` | ai-assistant | whiteboard |
| `member.imported` | import-export | rooms (memberCount), realtime |

Listener phải **idempotent** và **không được ném lỗi làm hỏng luồng chính**: persist whiteboard thất bại không được làm `endMeeting` thất bại theo.

## 6. Domain model [CONFIRMED]

```
User
 ├── owns / joins ──► Room  (lâu dài, join code + link)
 │                     ├── RoomMember (HOST|MEMBER)
 │                     └── has many ──► Meeting
 │                                       ├── MeetingParticipant
 │                                       ├── Message
 │                                       ├── Whiteboard (1–1)
 │                                       └── LiveKit Room (1–1, name = meetingId)
```

**Lifecycle:**
- Room: `ACTIVE → DISSOLVED` (chỉ HOST, soft delete)
- Meeting: `ACTIVE → ENDED` (HOST chủ động, hoặc auto khi 0 participant 3 phút)
- Một room tối đa 1 meeting ACTIVE (enforce bằng unique partial index)
- Host disconnect: grace 120s  participant join sớm nhất thành `ACTING_HOST`; host gốc quay lại lấy lại quyền
- Chỉ HOST được tạo và kết thúc meeting
