import { rooms } from "@/data/mockData";
import type { Room, RoomMember } from "../types";

export const initialMembers: RoomMember[] = [
  { name: "An Nguyễn", email: "an.nguyen@example.com", initials: "AN", role: "Chủ phòng", online: true, color: "#6372e8", joinedDate: "02/06/2026" },
  { name: "Minh Anh", email: "minhanh@example.com", initials: "MA", role: "Thành viên", online: true, color: "#df7d58", joinedDate: "02/06/2026" },
  { name: "Quang Huy", email: "quanghuy@example.com", initials: "QH", role: "Thành viên", online: true, color: "#349775", joinedDate: "02/06/2026" },
  { name: "Thu Hà", email: "thuha@example.com", initials: "TH", role: "Thành viên", online: false, color: "#9b65bd", joinedDate: "02/06/2026" },
  { name: "Đức Minh", email: "ducminh@example.com", initials: "ĐM", role: "Thành viên", online: false, color: "#4b90bd", joinedDate: "02/06/2026" },
];

export const roomService = {
  async getRoom(id: string): Promise<Room | undefined> {
    return rooms.find((r) => r.id === id) || rooms[0];
  },

  async getMembers(roomId: string): Promise<RoomMember[]> {
    return initialMembers;
  },

  async updateRoom(roomId: string, data: { name: string; description: string }): Promise<{ success: boolean }> {
    return { success: true };
  },

  async inviteMember(roomId: string, email: string): Promise<{ success: boolean; message: string }> {
    return { success: true, message: "Đã gửi lời mời thành công." };
  },

  async removeMember(roomId: string, memberName: string): Promise<{ success: boolean }> {
    return { success: true };
  },

  async deleteRoom(roomId: string): Promise<{ success: boolean }> {
    return { success: true };
  },
};

export default roomService;
