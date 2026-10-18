import * as backendRoomApi from "@/services/room.service";
import type { RoomMember as BackendRoomMember, Room as BackendRoom } from "@/types/backend";
import type { Room, RoomMember } from "../types";

function getToken(): string {
  if (typeof window !== "undefined") {
    return localStorage.getItem("accessToken") || "";
  }
  return "";
}

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

export const roomService = {
  async getRoom(id: string, token?: string): Promise<BackendRoom> {
    const authToken = token || getToken();
    return backendRoomApi.getRoom(authToken, id);
  },

  async getMembers(roomId: string, token?: string): Promise<RoomMember[]> {
    const authToken = token || getToken();
    const members = await backendRoomApi.listMembers(authToken, roomId);
    return members.map(mapBackendMember);
  },

  async updateRoom(roomId: string, data: { name: string; description: string }, token?: string): Promise<BackendRoom> {
    const authToken = token || getToken();
    return backendRoomApi.updateRoom(authToken, roomId, data);
  },

  async inviteMember(roomId: string, email: string, token?: string): Promise<{ success: boolean; member: BackendRoomMember }> {
    const authToken = token || getToken();
    const member = await backendRoomApi.addMember(authToken, roomId, email);
    return { success: true, member };
  },

  async removeMember(roomId: string, userId: string, token?: string): Promise<{ success: boolean }> {
    const authToken = token || getToken();
    await backendRoomApi.kickMember(authToken, roomId, userId);
    return { success: true };
  },

  async leaveRoom(roomId: string, token?: string): Promise<{ success: boolean }> {
    const authToken = token || getToken();
    await backendRoomApi.leaveRoom(authToken, roomId);
    return { success: true };
  },

  async deleteRoom(roomId: string, token?: string): Promise<{ success: boolean }> {
    const authToken = token || getToken();
    await backendRoomApi.dissolveRoom(authToken, roomId);
    return { success: true };
  },
};

export default roomService;
