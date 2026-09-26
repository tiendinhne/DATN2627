import { RoomRole } from './enums.js';

// Các hành động bị giới hạn theo role (docs/rule/role.md).
// Hành động mà mọi thành viên đều làm được (chat, vẽ, AI, upload, media) KHÔNG nằm ở đây —
// chỉ cần là thành viên, kiểm bằng RoomAccessService.assertRoomAccess.
export enum RoomAction {
  UPDATE_ROOM = 'UPDATE_ROOM',
  DISSOLVE_ROOM = 'DISSOLVE_ROOM',
  KICK_MEMBER = 'KICK_MEMBER',
  IMPORT_MEMBERS = 'IMPORT_MEMBERS',
  EXPORT_MEMBERS = 'EXPORT_MEMBERS',
  MANAGE_MEETING = 'MANAGE_MEETING', // tạo / kết thúc meeting — module meeting dùng
}

// Bảng tra: hành động → những role được phép (§15 — dữ liệu, không phải if-else)
export const ROOM_PERMISSIONS: Record<RoomAction, readonly RoomRole[]> = {
  [RoomAction.UPDATE_ROOM]: [RoomRole.HOST],
  [RoomAction.DISSOLVE_ROOM]: [RoomRole.HOST],
  [RoomAction.KICK_MEMBER]: [RoomRole.HOST],
  [RoomAction.IMPORT_MEMBERS]: [RoomRole.HOST],
  [RoomAction.EXPORT_MEMBERS]: [RoomRole.HOST],
  [RoomAction.MANAGE_MEETING]: [RoomRole.HOST],
};

export function can(role: RoomRole, action: RoomAction): boolean {
  return ROOM_PERMISSIONS[action].includes(role);
}
