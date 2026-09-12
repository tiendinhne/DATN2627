import { MeetingMode, RoomRole } from '../enums';
import { Action, PERMISSION_MATRIX } from './matrix';

/** Hàm thuần. Test được không cần DB, không cần Nest. */
export function can(role: RoomRole, mode: MeetingMode, action: Action): boolean {
  return PERMISSION_MATRIX[action][mode].includes(role);
}

/**
 * Map role sang LiveKit grant. Quyền media được enforce ngay ở SFU,
 * không chỉ ẩn nút ở UI.
 */
export function toLiveKitGrant(role: RoomRole, mode: MeetingMode) {
  return {
    canPublish: can(role, mode, Action.PUBLISH_MEDIA),
    canSubscribe: true,
    canPublishData: true,
  };
}
