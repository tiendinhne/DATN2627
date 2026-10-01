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

// Loại nội dung AI sinh ra (đề cương §4.2)
export enum AiRequestKind {
  DIAGRAM = 'DIAGRAM',
  MINDMAP = 'MINDMAP',
  FLOWCHART = 'FLOWCHART',
}

// Kết quả một lần gọi AI — dùng để thống kê trong báo cáo (đề cương §5.9)
export enum AiRequestStatus {
  SUCCESS = 'SUCCESS',
  PROVIDER_ERROR = 'PROVIDER_ERROR',
  INVALID_OUTPUT = 'INVALID_OUTPUT', // output AI không qua validate
  TIMEOUT = 'TIMEOUT',
  RATE_LIMITED = 'RATE_LIMITED',
}
