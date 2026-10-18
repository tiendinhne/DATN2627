import type { Meeting, Participant, Room } from "../types";

export const rooms: Room[] = [
  {
    id: "software-engineering",
    name: "Software Engineering",
    description: "Đồ án tốt nghiệp · Nhóm 05",
    color: "#5b6df7",
    members: 8,
    lastActivity: "12 phút trước",
    activeMeeting: "Họp tiến độ tuần 5",
    tag: "SE",
  },
  {
    id: "web-development",
    name: "Web Development",
    description: "Lập trình web nâng cao",
    color: "#f08c46",
    members: 12,
    lastActivity: "Hôm qua",
    tag: "WD",
  },
  {
    id: "data-structures",
    name: "Data Structures",
    description: "Cấu trúc dữ liệu và giải thuật",
    color: "#38a982",
    members: 6,
    lastActivity: "2 ngày trước",
    tag: "DS",
  },
];

export const meetings: Meeting[] = [
  {
    id: "sprint-review-05",
    title: "Họp tiến độ tuần 5",
    room: "Software Engineering",
    date: "Hôm nay",
    time: "14:00",
    duration: "45 phút",
    participants: 8,
    status: "Live",
  },
  {
    id: "architecture-review",
    title: "Review kiến trúc hệ thống",
    room: "Software Engineering",
    date: "18 Tháng 6",
    time: "09:30",
    duration: "1 giờ",
    participants: 6,
    status: "Upcoming",
  },
  {
    id: "api-workshop",
    title: "REST API Workshop",
    room: "Web Development",
    date: "15 Tháng 6",
    time: "19:30",
    duration: "52 phút",
    participants: 10,
    status: "Completed",
  },
];

export const participants: Participant[] = [
  { id: "1", name: "Bạn", initials: "AN", color: "#5869e8", speaking: true },
  { id: "2", name: "Minh Anh", initials: "MA", color: "#e17b56" },
  { id: "3", name: "Quang Huy", initials: "QH", color: "#319b78", muted: true },
  { id: "4", name: "Thu Hà", initials: "TH", color: "#a15cc5" },
];
