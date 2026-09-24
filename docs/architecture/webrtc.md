# WebRTC / LiveKit

Trạng thái: **[PLANNED]** — chưa có code. Toàn bộ mục này là thiết kế
## 1. Phân chia trách nhiệm

Backend **không phải** media server. Backend: auth, sinh access token, nhận webhook, business logic.
LiveKit: media transport, SFU forwarding, simulcast/dynacast, congestion control, TURN.

## 2. Token flow [CONFIRMED]

```
Client → POST /meetings/:id/join  (JWT)
       → Backend: check membership + meeting ACTIVE + resolve role
       → resolve effective role theo Meeting.mode (DISCUSSION | LECTURE)
       → sinh LiveKit AccessToken:
            identity   = userId
            room       = meeting._id.toString()
            grant      = toLiveKitGrant(role, mode)   // canPublish: false cho VIEWER
            TTL        = 6 giờ
       → trả { token, livekitUrl }
Client → connect LiveKit bằng token
```

- LiveKit API key/secret **chỉ ở backend**.
- Token cấp lại mỗi lần join meeting, không tái sử dụng giữa các meeting.
- `identity = userId` → LiveKit tự ngắt participant trùng identity, nên mở tab thứ hai sẽ kick tab cũ. Đây là hành vi mong muốn (presence đếm đúng 1 user = 1 slot).

## 3. Webhook flow [CONFIRMED]

```
LiveKit → POST /webhooks/livekit  (có chữ ký)
        → VERIFY CHỮ KÝ (bắt buộc)
        → parse room name → meetingId
        → cập nhật MeetingParticipant (Mongo)
        → cập nhật presence + peak (Redis)
        → emit domain event → realtime broadcast qua Redis adapter
```

Event quan tâm: `participant_joined`, `participant_left`, `room_finished`.

**Không verify chữ ký = ai cũng giả được webhook để đá người khác khỏi meeting.**

## 4. Port và NAT [CONFIRMED]

| Port | Proto | Dịch vụ | Public |
|---|---|---|---|
| 443 | TCP | NGINX — REST + Socket.IO | ✅ |
| 80 | TCP | redirect + ACME | ✅ |
| 7882 | UDP | LiveKit media (single-port mode) | ✅ |
| 7881 | TCP | LiveKit ICE/TCP fallback | ✅ |
| 5349 | TCP | TURN over TLS | ✅ |
| 3478 | UDP | TURN/UDP | ✅ |
| 7880 | TCP | LiveKit HTTP/WS | qua proxy |

- **Single-port UDP mode** (`rtc.udp_port: 7882`), không dùng dải 50000–60000 vì Docker map 10.000 port cực chậm.
- **TURN bắt buộc.** Không có TURN thì mạng trường / 4G / NAT đối xứng sẽ fail và buổi bảo vệ có thể hỏng. Dùng embedded TURN của LiveKit, TLS trên 5349 (không dùng 443 vì trùng NGINX).
- **`network_mode: host`** cho container LiveKit trên Linux, tránh NAT hai lớp (Docker bridge + VPS NAT) làm hỏng ICE candidate. Nếu buộc dùng bridge thì set `rtc.use_external_ip: true`.

## 5. Bandwidth — ràng buộc quyết định mục tiêu [CONFIRMED]

```
Server egress ≈ N × (N − 1) × bitrate_per_stream
```

| N bật cam | 720p @1.5 Mbps | 360p @0.5 Mbps |
|---|---|---|
| 6 | ~45 Mbps | ~15 Mbps |
| 10 | ~135 Mbps | ~45 Mbps |
| 20 | ~570 Mbps | ~190 Mbps |

Meeting 10 người ở 360p ≈ **20 GB egress mỗi giờ**. Hệ thống có thể chết vì network trước khi chết vì CPU — phát hiện này phải nêu trong báo cáo.

**Bật ngay từ đầu, không để tối ưu sau:**
- simulcast (LiveKit mặc định bật cho camera)
- dynacast (ngừng forward layer không ai subscribe)
- adaptive stream (client chỉ nhận layer đúng kích thước tile)
- giới hạn resolution theo layout: grid ≥5 người → 180p/360p; speaker view → 720p
- chỉ subscribe video của tile trong viewport (paginate 9 tile/trang)
- audio-only mode cho meeting đông

## 6. Mục tiêu participant [CONFIRMED — là mục tiêu, chưa phải kết quả]

| Kịch bản | Mục tiêu |
|---|---|
| Video 360p + audio, tất cả publish | 8–12 participant |
| 1 người screen share + còn lại subscribe | 20–30 participant |
| Audio-only | 20–30 participant |

Phải xác nhận bằng benchmark. Nếu thực đo thấp hơn, báo cáo ghi **số thực đo kèm phân tích điểm nghẽn** — điều đó có giá trị học thuật cao hơn một con số đẹp không kiểm chứng được.

Đây là **mục tiêu thiết kế, chưa phải kết quả**. Phải xác nhận bằng benchmark. Nếu thực đo thấp hơn thì báo cáo ghi số thực đo kèm phân tích điểm nghẽn — điều đó có giá trị học thuật cao hơn một con số đẹp không kiểm chứng được.

## 7. Benchmark [PLANNED]

Không mời được 20 người thật, và một laptop không chạy nổi 20 browser có camera.

- **`livekit-cli load-test`** sinh publisher/subscriber giả
- k6 hoặc script Node cho REST + Socket.IO
- **Máy sinh tải phải tách khỏi máy chạy SFU**, nếu không số liệu CPU vô nghĩa

chỉ là kịch bản, giữ mọi thứ ở mức sinh viên chứ không phải là 1 production
| # | Kịch bản | Biến |
|---|---|---|
| B1 | N publisher video+audio, all subscribe | N = 2,4,6,8,10,12 |
| B2 | 1 screen share + N subscriber | N = 5,10,20,30 |
| B3 | Audio-only | N = 10,20,30 |
| B4 | Join/leave churn 20% mỗi 30s | N = 10 |
| B5 | Whiteboard concurrent | 5 / 10 client vẽ liên tục 3 phút |
| B6 | Reconnect sau ngắt mạng 10s | |

Metric: join success rate, join latency p50/p95, CPU %, RAM, network in/out, packet loss, jitter, whiteboard op latency p95, event loss sau reconnect.

**Mọi con số phải đo thực tế.** Không lấy số trong docs của LiveKit. Mỗi kịch bản chạy ≥ 3 lần, báo cáo trung bình + độ lệch.