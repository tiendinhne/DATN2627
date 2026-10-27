import type { RoomMember as BackendRoomMember, Room as BackendRoom } from "@/types/backend";
import type { Room, RoomMember } from "../types";

// Chỉ còn hàm đổi dữ liệu backend sang dạng giao diện.
// Gọi API dùng @/services/room.service với token lấy từ useAuth() (ADR-023: token chỉ ở memory).

const MEMBER_COLORS = ["#6372e8", "#df7d58", "#349775", "#9b65bd", "#4b90bd"];

export function mapBackendMember(m: BackendRoomMember, index = 0): RoomMember {
  const name = m.displayName || "Thành viên";
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "TV";

  return {
    userId: m.userId,
    name,
    email: `${m.userId.slice(-6)}@member`,
    initials,
    role: m.role === "HOST" ? "Chủ phòng" : "Thành viên",
    online: true,
    color: MEMBER_COLORS[index % MEMBER_COLORS.length],
    joinedDate: m.joinedAt ? new Date(m.joinedAt).toLocaleDateString("vi-VN") : "02/06/2026",
  };
}

export function mapBackendRoom(r: BackendRoom): Room {
  return {
    id: r.id,
    name: r.name,
    description: r.description || "Không có mô tả",
    color: "#6372e8",
    members: r.memberCount || 1,
    lastActivity: "Vừa xong",
    tag: r.myRole === "HOST" ? "HOST" : "MEMBER",
  };
}
