export interface ChatMessage {
  id?: string;
  name: string;
  initials: string;
  time: string;
  text: string;
  color?: string;
  meeting?: string;
  isOwn?: boolean;
}

export interface SendMessageDto {
  roomId?: string;
  meetingId?: string;
  text: string;
}
