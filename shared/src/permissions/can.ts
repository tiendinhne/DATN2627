import { MeetingMode, RoomRole } from '../enums.js';
import { Action, PERMISSION_MATRIX } from './matrix.js';

export function can(role: RoomRole, mode: MeetingMode, action: Action): boolean {
  return PERMISSION_MATRIX[action][mode].includes(role);
}

export function toLiveKitGrant(role: RoomRole, mode: MeetingMode) {
  return {
    canPublish: can(role, mode, Action.PUBLISH_MEDIA),
    canSubscribe: true,
    canPublishData: true,
  };
}
