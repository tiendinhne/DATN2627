import type { Meeting, Participant } from "@/types";

export type { Meeting, Participant };

export interface MeetingSession {
  id: string;
  roomId: string;
  roomName: string;
  title: string;
  status: "connected" | "connecting" | "disconnected";
  duration: string;
  participants: Participant[];
}

export interface WebRTCConnectionState {
  isConnected: boolean;
  isAudioMuted: boolean;
  isVideoEnabled: boolean;
  isScreenSharing: boolean;
}
