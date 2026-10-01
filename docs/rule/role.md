Chỉ có host và member, không có các role khác
Tham khảo cách của google meeting.
Host là chủ phòng và có quyền kick thành viên( member ) ra khỏi room (Call API delete member ra khỏi room)
1 cuộc họp diễn ra chỉ cho phép các member có trong phòng đó tham gia, nếu người lạ muốn tham gia cuộc họp thì bắt buộc họ đã tham gia phòng.
cách thức tham gia phòng( xem mô tả đã có) 

| Hành động | HOST | MEMBER 
|---|:--:|:--:|:--:|:--:|
| Dissolve room | ✅ | ❌
| Đổi role | ✅ | ❌ |
| Quản lý / kick member | ✅ | ❌ |
| Import members / Export | ✅ | ❌ |
| Tạo / kết thúc meeting | ✅ | ❌ |
| Publish media, screen share | ✅ | ✅ 
| Chat | ✅ | ✅ 
| Vẽ whiteboard | ✅ | ✅ 
| Xoá element người khác / clear board | ✅ | ✅ 
| Gọi AI generate | ✅ | ✅ 
| Upload file | ✅ | ✅ 

##  MỞ RỘNG ( Nhưng không nằm trong scope hiện tại)
Mở rộng giới hạn của meeting thành public ( có host/co-host/member/viewer) và có rule riêng
