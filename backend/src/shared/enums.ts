export enum RoomStatus {
  ACTIVE = 'ACTIVE',
  DISSOLVED = 'DISSOLVED',
}

export enum RoomRole {
  HOST = 'HOST',
  MEMBER = 'MEMBER',
}

export enum MeetingStatus {
  ACTIVE = 'ACTIVE',
  ENDED = 'ENDED',
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
