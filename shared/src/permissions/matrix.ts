import { MeetingMode, RoomRole } from '../enums.js';

export enum Action {
  DISSOLVE_ROOM = 'DISSOLVE_ROOM',
  MANAGE_MEMBER = 'MANAGE_MEMBER',
  CHANGE_ROLE = 'CHANGE_ROLE',
  IMPORT_MEMBERS = 'IMPORT_MEMBERS',
  EXPORT_DATA = 'EXPORT_DATA',
  CREATE_MEETING = 'CREATE_MEETING',
  END_MEETING = 'END_MEETING',
  PUBLISH_MEDIA = 'PUBLISH_MEDIA',
  SCREEN_SHARE = 'SCREEN_SHARE',
  SEND_CHAT = 'SEND_CHAT',
  DRAW_WHITEBOARD = 'DRAW_WHITEBOARD',
  DELETE_OTHERS_ELEMENT = 'DELETE_OTHERS_ELEMENT',
  CLEAR_BOARD = 'CLEAR_BOARD',
  GENERATE_AI = 'GENERATE_AI',
  UPLOAD_FILE = 'UPLOAD_FILE',
}

const H = RoomRole.HOST;
const C = RoomRole.CO_HOST;
const M = RoomRole.MEMBER;
const V = RoomRole.VIEWER;

export const PERMISSION_MATRIX: Record<Action, Record<MeetingMode, RoomRole[]>> = {
  [Action.DISSOLVE_ROOM]:         { DISCUSSION: [H],          LECTURE: [H] },
  [Action.MANAGE_MEMBER]:         { DISCUSSION: [H, C],       LECTURE: [H, C] },
  [Action.CHANGE_ROLE]:           { DISCUSSION: [H],          LECTURE: [H] },
  [Action.IMPORT_MEMBERS]:        { DISCUSSION: [H, C],       LECTURE: [H, C] },
  [Action.EXPORT_DATA]:           { DISCUSSION: [H, C],       LECTURE: [H, C] },

  [Action.CREATE_MEETING]:        { DISCUSSION: [H, C],       LECTURE: [H, C] },
  [Action.END_MEETING]:           { DISCUSSION: [H, C],       LECTURE: [H, C] },
  [Action.PUBLISH_MEDIA]:         { DISCUSSION: [H, C, M],    LECTURE: [H, C] },
  [Action.SCREEN_SHARE]:          { DISCUSSION: [H, C, M],    LECTURE: [H, C] },

  [Action.SEND_CHAT]:             { DISCUSSION: [H, C, M, V], LECTURE: [H, C, M, V] },
  [Action.DRAW_WHITEBOARD]:       { DISCUSSION: [H, C, M],    LECTURE: [H, C] },
  [Action.DELETE_OTHERS_ELEMENT]: { DISCUSSION: [H, C],       LECTURE: [H, C] },
  [Action.CLEAR_BOARD]:           { DISCUSSION: [H, C],       LECTURE: [H, C] },
  [Action.GENERATE_AI]:           { DISCUSSION: [H, C, M],    LECTURE: [H, C] },
  [Action.UPLOAD_FILE]:           { DISCUSSION: [H, C, M],    LECTURE: [H, C] },
};
