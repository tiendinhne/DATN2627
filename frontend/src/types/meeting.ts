// Kiểu dữ liệu khớp response của backend (docs/api/endpoint.md — Meetings)
import type { RoomRole } from './room';

export type MeetingStatus = 'ACTIVE' | 'ENDED';
export type EndReason = 'HOST_ENDED' | 'AUTO_EMPTY' | 'ROOM_DISSOLVED';

export interface Meeting {
  id: string;
  roomId: string;
  title: string;
  status: MeetingStatus;
  createdBy: string;
  startedAt: string;
  endedAt: string | null;
  endReason: EndReason | null;
  peakParticipants: number;
  totalParticipants: number;
  messageCount: number;
  durationSeconds: number;
}

export interface MeetingListResponse {
  items: Meeting[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface JoinMeetingResponse {
  token: string;
  livekitUrl: string;
  myRole: RoomRole;
  meeting: Meeting;
}
