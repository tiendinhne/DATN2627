import { meetings, participants } from "@/data/mockData";
import type { Meeting, Participant } from "../types";

export const meetingService = {
  async getMeeting(id: string): Promise<Meeting | undefined> {
    return meetings.find((m) => m.id === id) || meetings[0];
  },

  async getParticipants(meetingId: string): Promise<Participant[]> {
    return participants;
  },

  async endMeeting(meetingId: string): Promise<{ success: boolean; message: string }> {
    return {
      success: true,
      message: "Cuộc họp đã kết thúc. Bảng vẽ đã được lưu.",
    };
  },
};

export default meetingService;
