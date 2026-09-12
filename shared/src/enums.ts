export enum RoomStatus {
  ACTIVE = 'ACTIVE',
  DISSOLVED = 'DISSOLVED',
}

export enum RoomRole {
  HOST = 'HOST',
  CO_HOST = 'CO_HOST',
  MEMBER = 'MEMBER',
  VIEWER = 'VIEWER',
}

export enum MeetingStatus {
  ACTIVE = 'ACTIVE',
  ENDED = 'ENDED',
}

/**
 * DISCUSSION: dùng role gốc trong RoomMember.
 * LECTURE   : chỉ HOST/CO_HOST được publish media và vẽ, còn lại bị hạ xuống VIEWER.
 */
export enum MeetingMode {
  DISCUSSION = 'DISCUSSION',
  LECTURE = 'LECTURE',
}

export enum EndReason {
  HOST_ENDED = 'HOST_ENDED',
  AUTO_EMPTY = 'AUTO_EMPTY',
  ROOM_DISSOLVED = 'ROOM_DISSOLVED',
}

export enum MessageType {
  TEXT = 'TEXT',
  FILE = 'FILE',
  SYSTEM = 'SYSTEM',
}

export enum FilePurpose {
  CHAT_ATTACHMENT = 'CHAT_ATTACHMENT',
  AVATAR = 'AVATAR',
  WHITEBOARD_IMAGE = 'WHITEBOARD_IMAGE',
}
