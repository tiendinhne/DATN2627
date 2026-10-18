import * as backendMeetingApi from "@/services/meeting.service";
import type { Meeting as BackendMeeting } from "@/types/backend";
import { participants } from "@/data/mockData";
import type { Meeting, Participant } from "../types";

function getToken(): string {
  if (typeof window !== "undefined") {
    return localStorage.getItem("accessToken") || "";
  }
  return "";
}

function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  return minutes >= 60 ? `${Math.floor(minutes / 60)}h ${minutes % 60}p` : `${minutes} phút`;
}

export function defaultMeetingTitle(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `Buổi học ${pad(now.getDate())}/${pad(now.getMonth() + 1)} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

const AVATAR_COLORS = ["#5667e9", "#e0534b", "#10b981", "#8b5cf6", "#f59e0b", "#06b6d4", "#ec4899"];

export function getAvatarColor(name: string): string {
  if (!name) return AVATAR_COLORS[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export function getInitials(name: string): string {
  if (!name) return "U";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return (name.slice(0, 2) || "U").toUpperCase();
}

export function mapBackendMeeting(m: BackendMeeting): Meeting {
  const dateObj = new Date(m.startedAt);
  const now = new Date();
  const isToday =
    dateObj.getDate() === now.getDate() &&
    dateObj.getMonth() === now.getMonth() &&
    dateObj.getFullYear() === now.getFullYear();

  return {
    id: m.id,
    title: m.title,
    room: m.roomId,
    date: isToday ? "Hôm nay" : dateObj.toLocaleDateString("vi-VN"),
    time: dateObj.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }),
    duration: m.durationSeconds ? formatDuration(m.durationSeconds) : (m.status === "ACTIVE" ? "Đang diễn ra" : "0 phút"),
    participants: m.totalParticipants || 1,
    status: m.status === "ACTIVE" ? "Live" : "Completed",
    peakParticipants: m.peakParticipants,
    totalParticipants: m.totalParticipants,
    endReason: m.endReason,
    startedAt: m.startedAt,
    endedAt: m.endedAt,
    durationSeconds: m.durationSeconds,
  };
}

export const meetingService = {
  async listMeetings(roomId: string, token?: string): Promise<BackendMeeting[]> {
    const authToken = token || getToken();
    const res = await backendMeetingApi.listMeetings(authToken, roomId);
    return res.items;
  },

  async startMeeting(roomId: string, title: string, token?: string): Promise<BackendMeeting> {
    const authToken = token || getToken();
    return backendMeetingApi.startMeeting(authToken, roomId, title);
  },

  async joinMeeting(meetingId: string, token?: string) {
    const authToken = token || getToken();
    return backendMeetingApi.joinMeeting(authToken, meetingId);
  },

  async endMeeting(meetingId: string, token?: string): Promise<{ success: boolean; message: string }> {
    const authToken = token || getToken();
    await backendMeetingApi.endMeeting(authToken, meetingId);
    return {
      success: true,
      message: "Cuộc họp đã kết thúc. Bảng vẽ đã được lưu.",
    };
  },

  async getParticipants(meetingId: string): Promise<Participant[]> {
    return participants;
  },
};

export default meetingService;
