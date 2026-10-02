import type { DashboardStats } from "../types";
import { meetings, rooms } from "@/data/mockData";

export const dashboardService = {
  async getStats(): Promise<DashboardStats> {
    return {
      roomsCount: rooms.length,
      meetingsCount: 12,
      studyHours: 8.5,
    };
  },

  async getRecentRooms() {
    return rooms;
  },

  async getUpcomingMeetings() {
    return meetings.slice(0, 2);
  },
};

export default dashboardService;
