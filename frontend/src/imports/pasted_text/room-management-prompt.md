# PROMPT BỔ SUNG — ROOM MANAGEMENT

Hãy bổ sung đầy đủ chức năng **quản lý Room** cho frontend.

Room là không gian học tập lâu dài của nhóm. Người dùng có thể tạo/join Room, quản lý thành viên và các Meeting bên trong Room.

Phải phân biệt rõ:

```text
ROOM
│
├── Room information
├── Members
├── Chat
│
└── Meetings
     ├── Meeting 1
     ├── Meeting 2
     └── Meeting 3
```

**Room không bị kết thúc khi một Meeting kết thúc.**

---

# 1. ROLE TRONG ROOM

Mỗi member có role:

```text
OWNER
MEMBER
```

Owner là người tạo Room và có quyền quản lý Room.

Member có quyền sử dụng Room nhưng không được thực hiện các thao tác quản trị Room.

Frontend phải dựa trên role để hiển thị/ẩn các action.

---

# 2. ROOM OWNER ACTIONS

Owner có thể:

* Edit Room
* Invite Member
* Remove/Kick Member
* Start Meeting
* End Meeting đang diễn ra
* Delete Room

Member có thể:

* View Room
* View Members
* View Chat
* Send Chat
* Join Meeting
* Leave Room

Member **không được**:

* Delete Room
* Remove member khác
* End Meeting của người khác nếu không có quyền Host
* Edit thông tin Room

---

# 3. ROOM HEADER

Room Header:

```text
┌────────────────────────────────────────────────────────────┐
│ ← Dashboard                                                │
│                                                            │
│ Software Engineering Group                    [•••]        │
│ Nhóm học Software Engineering                              │
│                                                            │
│ 8 members                                                   │
└────────────────────────────────────────────────────────────┘
```

Với Owner, nút `•••` mở:

```text
Room Actions

Edit Room
Invite Members
Room Settings
Delete Room
```

Với Member:

```text
Room Actions

Leave Room
```

Không hiển thị Delete Room cho Member.

---

# 4. EDIT ROOM

Owner click:

```text
••• → Edit Room
```

Mở shadcn Dialog.

Fields:

```text
Room Name
Description
```

Ví dụ:

```text
Edit Room

Room Name
[Software Engineering Group]

Description
[Nhóm học môn Công nghệ phần mềm...]

[Cancel] [Save Changes]
```

States:

* loading
* validation error
* success
* server error

Sau khi Save:

```text
Dialog closed
↓
Room Header updated
↓
Toast:
"Room updated successfully"
```

---

# 5. INVITE MEMBERS

Owner có button:

```text
[Invite Members]
```

Có thể đặt ở:

* Room Header
* Members page

Khi click mở Dialog:

```text
Invite Members

Invite people to this room

[Search username or email]

Search results

○ Nguyễn Văn A
  nguyenvana@email.com

○ Trần Văn B
  tranvanb@email.com

                    [Cancel] [Invite]
```

Nếu chưa muốn triển khai user search ở backend, frontend có thể mock data.

---

# 6. ROOM INVITE BY CODE

Ngoài việc tìm user, hỗ trợ Room Code.

Dialog:

```text
Invite Members

Room Code

┌──────────────────────────┐
│ SE-2026-8F3K             │
└──────────────────────────┘

[Copy Code]
```

Có thể có:

```text
Share this code with your classmates
```

Frontend cần có:

* Copy button
* Copied state
* QR code có thể để optional

Không cần xây dựng hệ thống invitation phức tạp nếu chưa nằm trong phạm vi backend.

---

# 7. MEMBERS PAGE

Route:

```text
/rooms/[roomId]/members
```

Layout:

```text
Members
8 members

[Invite Members]

Owner
──────────────────────────
Avatar
Nguyễn Văn A
Owner
Online

Members
──────────────────────────
Avatar
Trần Văn B
Member
Online
                                  [•••]

Avatar
Lê Văn C
Member
Offline
                                  [•••]
```

Owner có menu `•••` đối với Member.

---

# 8. MEMBER ACTION MENU

Owner click:

```text
••• 
```

Hiển thị:

```text
Member Actions

View Profile
Remove from Room
```

Không cần quá nhiều action.

Không hiển thị:

```text
Remove from Room
```

đối với chính Owner.

Owner không thể tự kick chính mình.

---

# 9. REMOVE / KICK MEMBER

Khi Owner chọn:

```text
Remove from Room
```

Phải mở confirmation dialog.

```text
Remove Member?

Are you sure you want to remove
Trần Văn B from this room?

They will no longer have access
to this room and its resources.

[Cancel] [Remove Member]
```

Không thực hiện ngay khi click menu.

Phải có confirmation để tránh thao tác nhầm.

---

# 10. REMOVE MEMBER — SUCCESS

Sau khi xác nhận:

```text
Remove Member
↓
API
↓
Success
↓
Update member list
↓
Toast
```

Toast:

```text
Trần Văn B has been removed from the room.
```

Member biến mất khỏi Members list.

Nếu Room có realtime Socket.IO:

```text
Owner removes Member
↓
Backend
↓
Socket event
↓
Removed member receives event
↓
Frontend redirects them away from Room
```

Frontend cần chuẩn bị component/state cho behavior này.

---

# 11. REMOVED MEMBER UI

Nếu một user đang ở Room nhưng bị Owner remove:

```text
Room access revoked

You no longer have access to this room.

[Back to Dashboard]
```

Không để user tiếp tục thao tác trong Room.

---

# 12. LEAVE ROOM

Member có thể tự rời Room.

Đặt trong:

```text
Room Actions
→ Leave Room
```

Confirmation:

```text
Leave Room?

Are you sure you want to leave
"Software Engineering Group"?

You will no longer have access to
this room's meetings, chat and resources.

[Cancel] [Leave Room]
```

Sau khi xác nhận:

```text
Leave Room
↓
Success
↓
Redirect to Dashboard
```

Toast:

```text
You left the room.
```

---

# 13. OWNER LEAVE ROOM

Owner **không nên có hành động "Leave Room" đơn giản** nếu hệ thống chưa có chức năng chuyển quyền Owner.

Thay vào đó:

```text
Owner
→ Room Settings
→ Delete Room
```

hoặc nếu sau này muốn hỗ trợ:

```text
Transfer Ownership
→ Select Member
→ Confirm
→ Leave Room
```

Nhưng `Transfer Ownership` là optional và không cần triển khai nếu vượt phạm vi đồ án.

---

# 14. DELETE ROOM

Owner có quyền:

```text
Room Actions
→ Delete Room
```

Đây là destructive action.

Phải dùng confirmation dialog rõ ràng.

```text
Delete Room?

Are you sure you want to delete
"Software Engineering Group"?

This action will permanently remove
the room and its associated data.

This may include:

• Room information
• Membership
• Meetings
• Chat history
• Whiteboards

This action cannot be undone.

[Cancel] [Delete Room]
```

Nút Delete phải có visual destructive state.

---

# 15. DELETE ROOM — IMPORTANT

Không được nhầm:

```text
Delete Room
```

với:

```text
End Meeting
```

Hai hành động hoàn toàn khác nhau.

```text
END MEETING
→ Kết thúc một phiên học
→ Room vẫn tồn tại
→ Chat vẫn tồn tại
→ Meeting history vẫn tồn tại
→ Whiteboard được lưu

DELETE ROOM
→ Xóa không gian học tập
→ Room không còn hoạt động
→ Members không còn truy cập
```

Frontend phải thể hiện rõ sự khác biệt này.

---

# 16. ROOM SETTINGS

Tạo:

```text
/rooms/[roomId]/settings
```

hoặc sử dụng Dialog/Sheet từ Room Actions.

Nếu muốn giữ scope nhỏ, ưu tiên dùng Sheet/Dialog thay vì thêm một page.

Các section:

### General

```text
Room Name
Description
```

### Membership

```text
Invite members
Member management
```

### Danger Zone

```text
Delete Room
```

Ví dụ:

```text
Room Settings

General
──────────────────────────
Room Name
[Software Engineering]

Description
[...]

[Save Changes]


Danger Zone
──────────────────────────
Delete this room permanently.

[Delete Room]
```

---

# 17. ROOM OWNER BADGE

Ở Members page:

```text
Nguyễn Văn A
Owner
```

Owner badge cần nổi bật nhưng không quá lớn.

Có thể sử dụng:

```text
<Badge>Owner</Badge>
```

Member:

```text
<Badge variant="secondary">Member</Badge>
```

---

# 18. ONLINE / OFFLINE STATUS

Members page hiển thị:

```text
● Online
○ Offline
```

Có thể dùng Socket.IO để realtime update sau này.

Mock data:

```typescript
type MemberStatus = "online" | "offline";
```

Không cần xây dựng status system phức tạp.

---

# 19. ACTIVE MEETING MANAGEMENT

Nếu Room đang có Meeting:

Owner có thể thấy:

```text
● LIVE

Họp tiến độ tuần 5

6 participants

[Join Meeting]
[End Meeting]
```

Member chỉ thấy:

```text
● LIVE

Họp tiến độ tuần 5

6 participants

[Join Meeting]
```

Không hiển thị `End Meeting` cho Member nếu họ không phải Host.

---

# 20. START MEETING

Owner hoặc member có quyền bắt đầu Meeting theo business rule.

Dialog:

```text
Start a Meeting

Meeting name
[Họp tiến độ tuần 5]

[Cancel] [Start Meeting]
```

Sau khi tạo:

```text
Create Meeting
↓
Meeting created
↓
Redirect
↓
/meetings/[meetingId]
```

---

# 21. END MEETING

Đây là hành động của Host.

Trong Meeting Workspace:

```text
[End Meeting]
```

Không nên cho phép click một lần là kết thúc.

Confirmation:

```text
End Meeting?

Are you sure you want to end
"Họp tiến độ tuần 5"?

The meeting will end for all participants.

Your whiteboard changes will be saved.

Chat history will remain available
in the Room Chat.

[Cancel] [End Meeting]
```

Điểm rất quan trọng:

**Phải giải thích trong confirmation rằng Chat vẫn được lưu trong Room Chat.**

---

# 22. END MEETING FLOW

Khi Host xác nhận:

```text
Host
 ↓
End Meeting
 ↓
Save final Whiteboard state
 ↓
Close realtime connections
 ↓
Update Meeting status = ENDED
 ↓
Notify participants
 ↓
Participants leave Meeting
 ↓
Redirect to Room
```

Sau đó:

```text
/rooms/[roomId]
```

Meeting xuất hiện trong:

```text
Room
→ Meetings
```

với:

```text
Status: Ended
```

---

# 23. PARTICIPANTS WHEN MEETING ENDS

Những người đang ở Meeting phải nhận thông báo:

```text
Meeting ended

The host has ended this meeting.

Your whiteboard has been saved
and the chat remains available
in the room.

[Back to Room]
```

Không để user ở trong Meeting UI sau khi Meeting đã kết thúc.

---

# 24. MEETING HISTORY AFTER END

Sau khi Meeting kết thúc:

```text
Meetings

Họp tiến độ tuần 5

Ended
12 Sep 2026
45 minutes
8 participants

Whiteboard saved

[View Details]
```

Không hiển thị:

```text
Join Meeting
```

cho Meeting đã kết thúc.

Có thể hiển thị:

```text
View Details
```

hoặc:

```text
View Meeting
```

để xem thông tin/history theo phạm vi đồ án.

---

# 25. ROOM CHAT AFTER MEETING ENDS

Đây là behavior bắt buộc.

Meeting:

```text
Họp tiến độ tuần 5
Status: Ended
```

Nhưng Room Chat vẫn:

```text
19:30
Nguyễn Văn A:
Mọi người bắt đầu nhé.

20:00
🎥 Trong cuộc họp: "Họp tiến độ tuần 5"
Trần Văn B:
Backend đã hoàn thành.

20:15
🎥 Trong cuộc họp: "Họp tiến độ tuần 5"
Nguyễn Văn C:
Mình sẽ hoàn thành frontend ngày mai.

21:00
Nguyễn Văn A:
OK, mai tiếp tục.
```

Không xóa hoặc ẩn message.

---

# 26. ROOM DELETE VS MEETING END

Frontend phải thể hiện bằng terminology chính xác:

| Action        | Effect                      |
| ------------- | --------------------------- |
| Start Meeting | Tạo một phiên học mới       |
| Join Meeting  | Tham gia phiên học          |
| End Meeting   | Kết thúc phiên học hiện tại |
| View Meeting  | Xem thông tin/history       |
| Leave Room    | User rời Room               |
| Remove Member | Owner loại một member       |
| Edit Room     | Thay đổi thông tin Room     |
| Delete Room   | Xóa Room                    |

Không dùng từ `Delete Meeting` thay cho `End Meeting` nếu mục đích là kết thúc phiên đang diễn ra.

---

# 27. ROOM ACTION PERMISSION MATRIX

Frontend phải chuẩn bị permission logic:

| Action        |          Owner |                   Member |
| ------------- | -------------: | -----------------------: |
| View Room     |              ✓ |                        ✓ |
| Edit Room     |              ✓ |                        ✗ |
| Invite Member |              ✓ |                        ✗ |
| View Members  |              ✓ |                        ✓ |
| Remove Member |              ✓ |                        ✗ |
| Leave Room    | Không mặc định |                        ✓ |
| Start Meeting |              ✓ | Có thể tùy business rule |
| Join Meeting  |              ✓ |                        ✓ |
| End Meeting   |           Host |                        ✗ |
| View Chat     |              ✓ |                        ✓ |
| Send Chat     |              ✓ |                        ✓ |
| Delete Room   |              ✓ |                        ✗ |

Lưu ý:

**Frontend chỉ dùng permission để điều khiển UI. Backend vẫn phải kiểm tra authorization thực tế.**

---

# 28. ROOM MANAGEMENT COMPONENTS

Tạo các reusable components:

```text
components/
└── room/
    ├── RoomHeader.tsx
    ├── RoomTabs.tsx
    ├── RoomActions.tsx
    ├── RoomOverview.tsx
    ├── ActiveMeetingCard.tsx
    ├── RecentMeetings.tsx
    ├── RecentActivity.tsx
    ├── RoomChatPreview.tsx
    ├── RoomMemberPreview.tsx
    │
    ├── MemberList.tsx
    ├── MemberCard.tsx
    ├── MemberActions.tsx
    │
    ├── InviteMemberDialog.tsx
    ├── EditRoomDialog.tsx
    ├── RemoveMemberDialog.tsx
    ├── LeaveRoomDialog.tsx
    ├── DeleteRoomDialog.tsx
    ├── EndMeetingDialog.tsx
    │
    └── RoomSettings.tsx
```

---

# 29. MOCK DATA

Frontend prototype cần có:

```typescript
Room
Member
Meeting
Message
```

Ví dụ:

```typescript
const room = {
  id: "room-001",
  name: "Software Engineering Group",
  description: "Nhóm học môn Công nghệ phần mềm",
  ownerId: "user-001",
  memberCount: 8,
};
```

Member:

```typescript
const member = {
  id: "user-002",
  username: "Nguyen Van B",
  role: "member",
  status: "online",
};
```

Meeting:

```typescript
const meeting = {
  id: "meeting-001",
  roomId: "room-001",
  title: "Họp tiến độ tuần 5",
  hostId: "user-001",
  status: "live",
  participantCount: 6,
};
```

---

# 30. DESTRUCTIVE ACTION UX

Đối với:

```text
Remove Member
Leave Room
End Meeting
Delete Room
```

luôn sử dụng confirmation dialog.

Không sử dụng browser:

```text
window.confirm()
```

Ưu tiên shadcn:

```text
AlertDialog
```

Các action destructive phải có:

* title
* description
* consequence
* Cancel
* destructive action

---

# 31. TOAST / FEEDBACK

Sau mỗi action:

### Invite

```text
Member invited successfully.
```

### Remove

```text
Member removed from the room.
```

### Edit

```text
Room updated successfully.
```

### Leave

```text
You left the room.
```

### End Meeting

```text
Meeting ended successfully.
Whiteboard saved.
```

### Delete

```text
Room deleted successfully.
```

---

# 32. FINAL ROOM MANAGEMENT FLOW

Frontend phải thể hiện được toàn bộ flow:

```text
Create Room
     ↓
Room Overview
     ↓
Invite Members
     ↓
Members join
     ↓
Manage Members
     │
     ├── Remove Member
     │
     └── Member leaves
     ↓
Start Meeting
     ↓
Meeting
     ├── Video
     ├── Audio
     ├── Screen Share
     ├── Chat
     ├── Whiteboard
     └── AI
     ↓
End Meeting
     ↓
Save Whiteboard
     ↓
Meeting = Ended
     ↓
Chat remains in Room
     ↓
Meeting History
     ↓
Room continues to exist
```

Room chỉ bị xóa khi Owner chủ động:

```text
Room Actions
     ↓
Delete Room
     ↓
Confirmation
     ↓
Delete
```

---

# 33. CORE PRODUCT PRINCIPLE

Hãy thiết kế UX dựa trên nguyên tắc:

**Room là không gian học tập lâu dài.**

**Meeting là một phiên học diễn ra bên trong Room.**

Do đó:

```text
ROOM
│
├── Members
│    ├── Invite
│    ├── Remove
│    └── Leave
│
├── Chat
│    ├── Room messages
│    └── Meeting messages
│
├── Meetings
│    ├── Meeting 1
│    ├── Meeting 2
│    └── Meeting 3
│
└── Settings
     ├── Edit Room
     └── Delete Room
```

Trong Meeting:

```text
MEETING
│
├── Video / Audio
├── Screen Share
├── Meeting Chat
├── Whiteboard
└── AI
```

Khi Meeting kết thúc:

```text
Meeting → Ended
Whiteboard → Saved
Chat → Remains in Room
Room → Still Active
```

Đây phải là behavior xuyên suốt toàn bộ frontend.
