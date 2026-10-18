Bạn là một Senior Frontend Engineer + UI/UX Designer. Hãy xây dựng giao diện frontend hoàn chỉnh cho một đồ án tốt nghiệp đại học có tên:

**“Hệ thống học nhóm trực tuyến dựa trên WebRTC, tích hợp bảng vẽ cộng tác thông minh”**

Tên tiếng Anh:

**“A WebRTC-Based Online Group Learning System with an Intelligent Collaborative Whiteboard”**

Mục tiêu là xây dựng một web application hỗ trợ sinh viên/giảng viên học nhóm trực tuyến thông qua phòng học, họp trực tuyến bằng WebRTC, chat realtime và bảng vẽ cộng tác có tích hợp AI.

---

# 1. TECH STACK

Frontend bắt buộc sử dụng:

* Next.js
* TypeScript
* App Router
* Tailwind CSS
* shadcn/ui
* Lucide React Icons

Kiến trúc frontend phải được tổ chức rõ ràng để sau này có thể kết nối với backend NestJS.

Không hard-code toàn bộ UI trong một file.

Ưu tiên component hóa:

* layout
* navbar
* sidebar
* room components
* meeting components
* chat components
* whiteboard components
* AI components
* modal/dialog
* form
* reusable UI components

Frontend cần sẵn sàng để tích hợp:

* REST API
* WebSocket / Socket.IO
* WebRTC / LiveKit
* Excalidraw
* AI API thông qua backend

Ở giai đoạn đầu có thể sử dụng mock data để hoàn thiện giao diện.

---

# 2. UI/UX DIRECTION

Thiết kế giao diện theo phong cách:

**Modern Education Platform + Google Classroom + Google Meet + collaborative workspace**

Không sao chép nguyên bản giao diện của Google Classroom hoặc Google Meet.

Thiết kế cần có cảm giác:

* hiện đại
* sạch
* chuyên nghiệp
* dễ sử dụng
* phù hợp với sinh viên và giảng viên
* không quá nhiều màu sắc
* không quá nhiều animation
* tập trung vào nội dung học tập

Responsive cho:

* Desktop
* Laptop
* Tablet

Desktop là giao diện ưu tiên vì Meeting và Whiteboard cần không gian lớn.

---

# 3. INFORMATION ARCHITECTURE

Frontend có cấu trúc navigation như sau:

```text
Landing Page
│
├── Login
├── Register
│
└── Dashboard
    │
    ├── Create Room
    ├── Join Room
    │
    └── Room
        │
        ├── Overview
        ├── Chat
        ├── Meetings
        └── Members
              │
              └── Meeting
                  ├── Video / Audio
                  ├── Screen Share
                  ├── Meeting Chat
                  ├── Whiteboard
                  └── AI Assistant
```

Điểm rất quan trọng:

**Whiteboard không phải một trang độc lập trực tiếp dưới Room.**

Mỗi Meeting có một Whiteboard riêng.

Ví dụ:

```text
Room A
│
├── Meeting 1
│   └── Whiteboard 1
│
├── Meeting 2
│   └── Whiteboard 2
│
└── Meeting 3
    └── Whiteboard 3
```

Meeting history được lưu trong Room.

---

# 4. ROUTING

Sử dụng Next.js App Router.

Tạo cấu trúc route tương tự:

```text
src/app/

├── page.tsx

├── (auth)/
│   ├── login/
│   │   └── page.tsx
│   └── register/
│       └── page.tsx

├── dashboard/
│   └── page.tsx

├── rooms/
│   └── [roomId]/
│       ├── page.tsx
│       ├── chat/
│       │   └── page.tsx
│       ├── meetings/
│       │   └── page.tsx
│       └── members/
│           └── page.tsx

├── meetings/
│   └── [meetingId]/
│       └── page.tsx

├── profile/
│   └── page.tsx

└── settings/
    └── page.tsx
```

Create Room và Join Room nên sử dụng Dialog/Modal thay vì tạo thêm page riêng.

Không tạo:

```text
rooms/[roomId]/whiteboard
```

vì Whiteboard thuộc Meeting.

Không tạo:

```text
meetings/[meetingId]/chat
```

vì Meeting Chat chỉ là một panel bên trong Meeting Workspace.

---

# 5. LANDING PAGE

Route:

```text
/
```

Thiết kế Landing Page giới thiệu hệ thống.

Sections:

### Hero

Tiêu đề:

“Learn Together. Create Together.”

Subtitle:

“Một không gian học nhóm trực tuyến với video meeting, realtime collaboration và bảng vẽ thông minh.”

Buttons:

* Get Started
* Sign In

Có một visual minh họa Meeting + Whiteboard ở bên phải.

### Features

Hiển thị 4–5 feature cards:

1. Online Group Learning
2. Realtime Video & Audio
3. Collaborative Whiteboard
4. Realtime Chat
5. AI-powered Whiteboard

### How it works

Flow:

```text
Create Room
↓
Invite Members
↓
Start Meeting
↓
Collaborate
↓
Save Your Work
```

### Footer

Có:

* Project name
* About
* Technology
* GitHub
* Copyright

Không cần thêm quá nhiều marketing section.

---

# 6. LOGIN PAGE

Route:

```text
/login
```

Thiết kế form:

* Email or Username
* Password
* Show/Hide Password
* Remember me
* Login button
* Continue with Google
* Link to Register
* Forgot password

Layout:

```text
-------------------------------------
| Illustration | Login Form         |
|              |                    |
|              | Welcome back       |
|              | Email/Username     |
|              | Password           |
|              | Login              |
|              | Google             |
|              | Register           |
-------------------------------------
```

Hiển thị validation:

* required
* invalid email
* wrong credentials
* loading state
* server error

---

# 7. REGISTER PAGE

Route:

```text
/register
```

Fields:

* Username
* Email
* Password
* Confirm Password

Buttons:

* Create Account
* Continue with Google

Hiển thị:

* password strength
* validation
* loading
* success/error state

Không tạo form quá phức tạp.

---

# 8. DASHBOARD

Route:

```text
/dashboard
```

Đây là màn hình chính sau khi đăng nhập.

Layout:

```text
----------------------------------------------------
| Sidebar       | Header                            |
|               |-----------------------------------|
| Dashboard     | Search                            |
| My Rooms      |                                   |
| Profile       | Welcome back, User                |
| Settings      |                                   |
|               | [Create Room] [Join Room]        |
|               |                                   |
|               | Recent Rooms                      |
|               | -------------------------------- |
|               | Room Card | Room Card | Room    |
|               |                                   |
|               | Upcoming Meetings                |
----------------------------------------------------
```

Sidebar:

* Dashboard
* My Rooms
* Profile
* Settings
* Logout

Dashboard content:

### Welcome section

Ví dụ:

“Good afternoon, An”

### Quick actions

Buttons:

* Create Room
* Join Room

### Recent Rooms

Room cards hiển thị:

* room name
* description
* number of members
* last activity
* active meeting indicator
* Join/Open button

### Upcoming / Recent Meetings

Hiển thị:

* meeting name
* room
* date
* duration
* status

---

# 9. CREATE ROOM MODAL

Không tạo page riêng.

Sử dụng shadcn Dialog.

Fields:

* Room Name
* Description
* Room Code

Room Code có thể được hệ thống generate tự động.

Buttons:

* Cancel
* Create Room

Sau khi tạo thành công:

```text
Create Room
↓
Room created
↓
Redirect to Room Overview
```

---

# 10. JOIN ROOM MODAL

Dialog:

```text
Join a Room
```

Field:

```text
Room Code
```

Button:

```text
Join Room
```

States:

* invalid code
* room not found
* already member
* loading
* success

---

# 11. ROOM OVERVIEW

Route:

```text
/rooms/[roomId]
```

Đây là trang tổng quan của một Room.

Header:

```text
< Back to Dashboard

Room Name
Room description

[Start Meeting]
[Invite Members]
```

Navigation tabs:

```text
Overview | Chat | Meetings | Members
```

Content:

### Room information

* Room name
* Description
* Created date
* Owner
* Member count

### Active Meeting

Nếu đang có meeting:

```text
Live now
Meeting Name
X members are currently in the meeting

[Join Meeting]
```

Nếu không:

```text
No active meeting

[Start Meeting]
```

### Recent Meetings

Hiển thị một số meeting gần đây.

---

# 12. ROOM CHAT

Route:

```text
/rooms/[roomId]/chat
```

Đây là **chat chính của Room**.

Rất quan trọng:

Meeting Chat cũng được đưa vào Room Chat.

Database concept:

```text
Message
├── id
├── roomId
├── senderId
├── meetingId
├── content
└── createdAt
```

Nếu:

```text
meetingId = null
```

thì đó là message bình thường của Room.

Nếu:

```text
meetingId = meetingId
```

thì message được gửi trong Meeting.

UI cần phân biệt message đến từ Meeting.

Ví dụ:

```text
[Meeting: Họp tiến độ]

Nguyễn Văn A
Mọi người xem phần này giúp mình nhé.
```

Message trong Meeting khi hiển thị ở Room Chat có badge:

```text
In meeting: Họp tiến độ
```

Người không tham gia Meeting vẫn có thể đọc message đó.

---

# 13. ROOM CHAT UI

Layout:

```text
----------------------------------------------------
| Room Chat                                         |
|--------------------------------------------------|
|                                                   |
| User A                                            |
| Hello everyone                                    |
|                                                   |
| User B                                            |
| [Meeting: Họp tiến độ]                            |
| Mình đã hoàn thành phần backend.                 |
|                                                   |
|--------------------------------------------------|
| Type a message...                         [Send] |
----------------------------------------------------
```

Features:

* realtime message
* timestamp
* avatar
* sender name
* message grouping
* meeting badge
* scroll to latest
* empty state
* loading state

---

# 14. MEETINGS PAGE

Route:

```text
/rooms/[roomId]/meetings
```

Hiển thị lịch sử Meeting của Room.

Header:

```text
Meetings

[Start New Meeting]
```

Meeting cards/table:

* Meeting name
* Started by
* Date
* Duration
* Participants
* Status
* Board available
* View button

Ví dụ:

```text
Họp tiến độ tuần 5
12 Sep 2026
45 minutes
8 participants

[View Meeting]
```

Mỗi Meeting có Whiteboard riêng.

---

# 15. MEMBERS PAGE

Route:

```text
/rooms/[roomId]/members
```

Hiển thị:

* avatar
* username
* email
* role
* online/offline
* joined date

Roles:

* Owner
* Member

Owner có thể thấy:

```text
Remove member
```

Không cần xây dựng hệ thống permission quá phức tạp.

---

# 16. MEETING WORKSPACE

Route:

```text
/meetings/[meetingId]
```

Đây là màn hình quan trọng nhất của toàn bộ hệ thống.

Thiết kế tương tự một online learning workspace.

Desktop-first.

Layout:

```text
--------------------------------------------------------------
| Meeting Header                                             |
| Room / Meeting Name                      Members / Leave  |
--------------------------------------------------------------
|                                                            |
|                     WHITEBOARD                             |
|                                                            |
|                                                            |
|                                                            |
|------------------------------------------------------------|
| Video Participants                                         |
| [Cam] [Cam] [Cam] [Cam]                                   |
--------------------------------------------------------------
| Mic | Camera | Screen Share | Chat | AI | Leave           |
--------------------------------------------------------------
```

Có thể sử dụng layout:

```text
Left:
Participants / video

Center:
Whiteboard

Right:
Chat / AI panel

Bottom:
Meeting controls
```

Ưu tiên Whiteboard là khu vực lớn nhất.

---

# 17. MEETING HEADER

Header hiển thị:

* Room name
* Meeting name
* connection status
* number of participants
* meeting duration
* Leave button

Ví dụ:

```text
Software Engineering
Họp tiến độ tuần 5

● Connected

8 participants

[Leave]
```

Nếu user là host:

```text
[End Meeting]
```

Host kết thúc Meeting sẽ:

* save final board state
* close realtime connections
* update meeting status

---

# 18. VIDEO / AUDIO AREA

Sử dụng mock UI trước.

Mỗi participant tile:

```text
--------------------------------
|                              |
|         Video                |
|                              |
|                         Mic  |
| User Name                    |
--------------------------------
```

States:

* camera on
* camera off
* microphone on
* microphone muted
* speaking indicator
* screen sharing

Không cần tự implement WebRTC logic trong UI prompt này.

Hãy tạo component interface để sau này tích hợp LiveKit.

Ví dụ component:

```text
ParticipantGrid
ParticipantTile
MeetingControls
ScreenShareView
```

---

# 19. MEETING CONTROLS

Bottom control bar:

```text
[Mic]
[Camera]
[Screen Share]
[Chat]
[Participants]
[More]
[Leave]
```

Nếu host:

```text
[End Meeting]
```

Controls cần có:

* hover state
* active state
* disabled state
* tooltip

---

# 20. MEETING CHAT

Meeting Chat là panel trong Meeting Workspace.

Không tạo route riêng.

UI:

```text
---------------------------
| Meeting Chat             |
|--------------------------|
| User A                   |
| Let's start...           |
|                          |
| User B                   |
| I agree.                 |
|--------------------------|
| Type message...     Send |
---------------------------
```

Message gửi trong Meeting phải được đánh dấu:

```text
meetingId = currentMeetingId
```

Sau đó message vẫn thuộc Room Chat.

Khi Meeting kết thúc, message **không bị xóa**.

---

# 21. WHITEBOARD

Whiteboard là phần quan trọng nhất của Meeting.

Mỗi Meeting có một Whiteboard riêng.

Sử dụng:

**Excalidraw**

UI có thể wrap Excalidraw trong:

```text
Whiteboard
```

Component.

Whiteboard hỗ trợ:

* free drawing
* shapes
* text
* arrows/connectors
* move
* edit
* erase
* select

Realtime:

```text
User A changes board
↓
WebSocket
↓
Backend
↓
Other participants
↓
Board updated
```

Frontend cần chuẩn bị abstraction để sau này tích hợp Socket.IO.

Không tự tạo một whiteboard canvas giả nếu Excalidraw có thể được tích hợp trực tiếp.

---

# 22. WHITEBOARD TOOLBAR

Có thể bổ sung một toolbar phía trên hoặc bên cạnh:

```text
Select
Pen
Rectangle
Circle
Arrow
Text
Eraser
Undo
Redo
Clear
```

Ngoài ra có:

```text
[AI Assistant]
```

button.

AI phải nằm trong context của Whiteboard.

Không tạo một AI chatbot page riêng.

---

# 23. AI WHITEBOARD ASSISTANT

AI là một phần của Whiteboard.

UI:

```text
------------------------------------
| AI Whiteboard Assistant           |
|----------------------------------|
| What would you like to create?   |
|                                  |
| [Create a flowchart for login]   |
|                                  |
|              [Generate]          |
------------------------------------
```

User nhập:

```text
Create a flowchart for user login
```

Flow:

```text
User prompt
↓
Frontend
↓
Backend
↓
Generative AI API
↓
Structured visual content
↓
Frontend
↓
Whiteboard
```

AI có thể tạo:

* diagram
* flowchart
* mind map
* structured notes
* concept structure

AI result cần preview trước khi đưa vào Whiteboard.

Ví dụ:

```text
AI Generated Content

[Preview]

Login
 ↓
Validate Input
 ↓
Check Account
 ↓
Generate Token
 ↓
Dashboard

[Add to Whiteboard]
[Cancel]
```

Không cho AI chỉnh sửa toàn bộ hệ thống.

AI chỉ tập trung vào việc hỗ trợ tạo/organize nội dung trực quan trên Whiteboard.

---

# 24. MEETING SIDE PANEL

Meeting Workspace có thể sử dụng right sidebar.

Tabs:

```text
Chat
Participants
AI
```

Ví dụ:

```text
---------------------------------
| Chat | Participants | AI      |
|--------------------------------
|                               |
| chat content                  |
|                               |
|                               |
---------------------------------
```

Panel có thể collapse để Whiteboard có thêm không gian.

---

# 25. PROFILE

Route:

```text
/profile
```

Hiển thị:

* avatar
* username
* email
* account created date

Cho phép chỉnh sửa:

* username
* avatar

Không cần xây dựng profile quá phức tạp.

---

# 26. SETTINGS

Route:

```text
/settings
```

Các setting cơ bản:

### Account

* username
* email

### Appearance

* Light / Dark

### Notifications

* Enable notifications

### Meeting

* default microphone
* default camera

Không cần xây dựng quá nhiều setting.

---

# 27. GLOBAL COMPONENTS

Tạo reusable components:

```text
components/
├── layout/
│   ├── Navbar
│   ├── Sidebar
│   └── PageContainer
│
├── room/
│   ├── RoomHeader
│   ├── RoomTabs
│   ├── RoomCard
│   └── MeetingCard
│
├── meeting/
│   ├── MeetingHeader
│   ├── ParticipantGrid
│   ├── ParticipantTile
│   ├── MeetingControls
│   ├── MeetingChat
│   ├── ParticipantPanel
│   └── MeetingSidebar
│
├── chat/
│   ├── ChatMessage
│   ├── ChatInput
│   └── ChatList
│
├── whiteboard/
│   ├── Whiteboard
│   ├── WhiteboardToolbar
│   └── AIAssistant
│
└── common/
    ├── EmptyState
    ├── LoadingState
    ├── ErrorState
    ├── ConfirmDialog
    └── UserAvatar
```

---

# 28. MOCK DATA

Trong giai đoạn UI development, tạo mock data.

Ví dụ:

```typescript
User
Room
RoomMember
Meeting
Message
Whiteboard
```

Mock data phải phản ánh đúng quan hệ:

```text
User
 ↓
Room
 ↓
Meeting
 ↓
Whiteboard
```

Message:

```text
Room
 ├── normal message
 └── meeting message
       └── meetingId
```

Không tạo dữ liệu giả quá nhiều.

Khoảng:

* 3 rooms
* 2–4 meetings mỗi room
* 5–8 members
* 10–20 messages

là đủ để demo UI.

---

# 29. STATE DESIGN

Chuẩn bị frontend để sau này tích hợp backend.

Có thể tạo abstraction:

```text
services/
├── auth.service.ts
├── room.service.ts
├── meeting.service.ts
├── message.service.ts
└── whiteboard.service.ts
```

Realtime:

```text
lib/
├── socket.ts
├── livekit.ts
└── api.ts
```

Không gọi API trực tiếp trong mọi component.

---

# 30. LOADING / ERROR / EMPTY STATES

Mỗi page cần có:

### Loading

Skeleton UI.

### Empty

Ví dụ:

```text
No meetings yet

Start your first meeting to begin learning together.

[Start Meeting]
```

### Error

```text
Something went wrong.

[Try Again]
```

Không để màn hình trắng khi không có data.

---

# 31. RESPONSIVE

Desktop:

```text
Sidebar + Main Content
```

Tablet:

```text
Collapsed Sidebar
```

Mobile:

```text
Bottom navigation / drawer
```

Meeting trên mobile cần ưu tiên:

* video
* audio
* chat
* whiteboard

Tuy nhiên desktop vẫn là platform chính.

---

# 32. DARK MODE

Hỗ trợ Light/Dark mode bằng Tailwind/shadcn.

Dark mode đặc biệt phù hợp với Meeting Workspace.

Whiteboard nên giữ background dễ nhìn và không làm giảm khả năng đọc nội dung.

---

# 33. ACCESSIBILITY

Áp dụng:

* semantic HTML
* keyboard navigation
* aria-label
* focus state
* sufficient contrast
* tooltip cho icon button

Các icon-only button phải có tooltip.

---

# 34. ANIMATION

Chỉ dùng animation nhẹ:

* modal open
* sidebar transition
* toast
* panel collapse
* loading

Không sử dụng animation quá nhiều.

Không làm giao diện giống landing page marketing.

---

# 35. IMPORTANT PRODUCT RULES

Phải tuân thủ các quy tắc sau:

### Rule 1

Room và Meeting là hai cấp khác nhau.

```text
Room
↓
Meeting
```

### Rule 2

Một Room có thể có nhiều Meeting.

### Rule 3

Mỗi Meeting có một Whiteboard riêng.

### Rule 4

Meeting Chat không phải một hệ thống chat độc lập.

Message trong Meeting vẫn thuộc Room Chat.

### Rule 5

Meeting kết thúc không xóa Meeting Chat.

### Rule 6

AI chỉ tập trung vào Whiteboard.

Không tạo AI chatbot độc lập.

### Rule 7

Whiteboard không nằm trực tiếp dưới Room.

Nó nằm trong Meeting.

### Rule 8

Create Room và Join Room sử dụng modal.

### Rule 9

Không thêm những module ngoài phạm vi như:

* payment
* marketplace
* course marketplace
* social network
* complex LMS
* native mobile app
* advanced admin dashboard
* AI training system

---

# 36. VISUAL HIERARCHY

Ưu tiên nội dung theo thứ tự:

```text
Meeting
↓
Whiteboard
↓
Participants
↓
Chat
↓
AI
```

Trong Meeting Workspace:

* Whiteboard chiếm phần lớn màn hình.
* Video participants không được che Whiteboard.
* Chat và AI là side panel.
* Controls nằm ở bottom.
* Header nhỏ gọn.

---

# 37. DEMO FLOW

Frontend phải thể hiện được flow hoàn chỉnh:

```text
Landing
↓
Login
↓
Dashboard
↓
Create Room
↓
Room Overview
↓
Members
↓
Start Meeting
↓
Meeting Workspace
↓
Camera / Microphone
↓
Screen Share
↓
Meeting Chat
↓
Whiteboard
↓
AI Assistant
↓
Generate Diagram
↓
Preview AI Result
↓
Add to Whiteboard
↓
Collaborative Editing
↓
End Meeting
↓
Meeting History
↓
Room Chat
```

Đây là flow quan trọng nhất để demo đồ án.

---

# 38. CODE QUALITY

Code phải:

* TypeScript strict
* reusable
* maintainable
* component-based
* không duplicate code
* không hard-code business logic vào UI
* sử dụng interface/type rõ ràng
* dễ tích hợp NestJS API sau này

Không viết toàn bộ frontend vào một file.

Không tạo các component khổng lồ trên 500–1000 dòng nếu có thể tách nhỏ.

---

# 39. FINAL EXPECTATION

Hãy tạo một frontend prototype hoàn chỉnh, có thể chạy được.

Ưu tiên triển khai theo thứ tự:

1. App layout
2. Authentication pages
3. Dashboard
4. Room
5. Room Chat
6. Meetings
7. Members
8. Meeting Workspace
9. Video/Audio UI
10. Meeting Chat
11. Excalidraw Whiteboard
12. AI Whiteboard Assistant
13. Profile
14. Settings
15. Responsive
16. Dark mode
17. Loading/Error/Empty states

Mục tiêu không chỉ là tạo các màn hình đẹp mà phải thể hiện rõ **kiến trúc và luồng sử dụng thực tế của hệ thống**.

Đặc biệt phải giữ đúng quan hệ:

```text
USER
  ↓
DASHBOARD
  ↓
ROOM
  ├── Overview
  ├── Chat
  ├── Meetings
  └── Members
        ↓
      MEETING
        ├── Video / Audio
        ├── Screen Share
        ├── Meeting Chat → Room Chat
        ├── Whiteboard
        └── AI Assistant
```

Hãy ưu tiên tính khả thi đối với một đồ án tốt nghiệp 2 sinh viên, không mở rộng phạm vi vượt quá yêu cầu.
