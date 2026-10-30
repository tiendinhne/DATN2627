export interface ChatMessage {
  id: string;
  senderId: string;
  name: string;
  initials: string;
  time: string;
  text: string;
  color: string;
  meeting?: string;
  file?: ChatFileMetadata | null;
  isOwn: boolean;
  createdAt: string;
}

export interface ChatFileMetadata {
  id: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
}

export interface SendMessageDto {
  roomId: string;
  clientMsgId?: string;
  content?: string;
  fileId?: string;
  meetingId?: string;
}

export interface BackendChatMessage {
  id: string;
  roomId: string;
  meetingId: string | null;
  meetingTitle?: string;
  senderId: string;
  senderName: string;
  type: string;
  content: string;
  fileId: string | null;
  file: ChatFileMetadata | null;
  createdAt: string;
}
