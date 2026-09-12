import { EndReason, MessageType, RoomRole } from '../enums';
import type { WbElement } from '../whiteboard/element.types';

/** Socket.IO namespace và cách đặt tên room. */
export const MEETING_NAMESPACE = '/meeting';
export const meetingRoom = (meetingId: string) => `meeting:${meetingId}`;

/**
 * Tên event realtime = CONTRACT với client. Đổi là phải sửa frontend.
 * Khác hoàn toàn domain event nội bộ (meeting.ended), thứ có thể đổi tự do.
 */
export const ClientEvent = {
  MEETING_JOIN: 'meeting:join',
  CHAT_SEND: 'chat:send',
  WB_OPS: 'wb:ops',
  WB_POINTER: 'wb:pointer',
  WB_RESYNC: 'wb:resync',
  AI_GENERATE: 'ai:generate',
} as const;

export const ServerEvent = {
  MEETING_SNAPSHOT: 'meeting:snapshot',
  MEETING_MEMBER_CHANGED: 'meeting:member_changed',
  MEETING_ENDED: 'meeting:ended',
  CHAT_NEW: 'chat:new',
  WB_OPS: 'wb:ops',
  WB_POINTER: 'wb:pointer',
  AI_STATUS: 'ai:status',
  AI_RESULT: 'ai:result',
  SERVER_DRAINING: 'server:draining',
  ERROR: 'error',
} as const;

// ---------- Client -> Server ----------

export interface MeetingJoinPayload {
  meetingId: string;
  /** seq cuối client đã nhận; server quyết định replay diff hay gửi full snapshot */
  lastSeq?: number;
}

export interface ChatSendPayload {
  /** do client sinh, dùng chống gửi trùng khi reconnect (unique index ở DB) */
  clientMsgId: string;
  content: string;
  fileId?: string;
}

export interface WbOpsPayload {
  elements: WbElement[];
}

export interface WbPointerPayload {
  x: number;
  y: number;
}

export interface WbResyncPayload {
  lastSeq: number;
}

export interface AiGeneratePayload {
  requestId: string;
  prompt: string;
  kind: 'flowchart' | 'mindmap' | 'diagram';
}

// ---------- Server -> Client (bọc trong EventEnvelope) ----------

export interface MemberView {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  role: RoomRole;
  isOnline: boolean;
}

export interface MessageView {
  id: string;
  senderId: string;
  senderName: string;
  type: MessageType;
  content: string;
  fileId: string | null;
  createdAt: string;
}

export interface MeetingSnapshotData {
  elements: WbElement[];
  seq: number;
  members: MemberView[];
  recentMessages: MessageView[];
}

export interface MemberChangedData {
  userId: string;
  action: 'joined' | 'left' | 'role_changed' | 'kicked';
  role: RoomRole;
}

export interface MeetingEndedData {
  reason: EndReason;
}

export interface WbOpsData {
  elements: WbElement[];
  byUserId: string;
}

export interface WbPointerData {
  userId: string;
  x: number;
  y: number;
}

export interface AiStatusData {
  requestId: string;
  status: 'pending' | 'failed';
  error?: string;
}

export interface AiResultData {
  requestId: string;
  elements: WbElement[];
}
