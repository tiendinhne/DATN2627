Tổng hợp các endpoint/api của toàn hệ thống

## Yêu cầu ghi file
Khi code xong module/api. phải thêm chi tiết api đó là gì, request/response ra sau. Dễ đọc dễ hình dung
Phân chia thêm từng nhóm module riêng biệt
Vd: Auth,...

## Chat (thiết kế — chưa code)

### GET /rooms/:roomId/messages
Lấy lịch sử chat của room, mới nhất trước.

| Query | Kiểu | Mặc định | Ghi chú |
|---|---|---|---|
| before | messageId | — | cursor: lấy tin cũ hơn tin này |
| limit | number | 50 | tối đa 100 |
| meetingId | ObjectId | — | có thì chỉ lấy tin của meeting đó |

Quyền: thành viên room, không bị ban.
Response: `{ items: [{ id, roomId, meetingId, meetingTitle?, senderId, senderName, type, content, fileId, createdAt }], nextCursor }`
