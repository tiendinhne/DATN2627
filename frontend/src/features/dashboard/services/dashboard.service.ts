import type { DashboardStats } from "../types";
import { listMyRooms } from "@/services/room.service";
import type { Room } from "@/types";

function getToken(): string {
  if (typeof window !== "undefined") {
    return localStorage.getItem("accessToken") || "";
  }
  return "";
}

const ROOM_COLORS = ["#5667e9", "#e0534b", "#10b981", "#8b5cf6", "#f59e0b"];

export const dashboardService = {
  async getRecentRooms(token?: string): Promise<Room[]> {
    try {
      const authToken = token || getToken();
      if (!authToken) return [];
      const res = await listMyRooms(authToken, 1);
      return res.items.map((r, i) => ({
        id: r.id,
        name: r.name,
        description: r.description || "Không gian học tập nhóm",
        color: ROOM_COLORS[i % ROOM_COLORS.length],
        members: r.memberCount || 1,
        lastActivity: new Date(r.createdAt).toLocaleDateString("vi-VN"),
        tag: r.myRole === "HOST" ? "HOST" : "MEMBER",
      }));
    } catch (err) {
      console.error("Failed to fetch recent rooms:", err);
      return [];
    }
  },

  async getStats(token?: string): Promise<DashboardStats> {
    const rooms = await this.getRecentRooms(token);
    return {
      roomsCount: rooms.length,
      meetingsCount: 0,
      studyHours: 0,
    };
  },
};

export default dashboardService;
