// Port "media": năng lực SFU mà nghiệp vụ meeting cần (ràng buộc 9 — tên theo năng lực, không theo vendor).
// MeetingsService chỉ biết interface này; LivekitMediaAdapter cài đặt nó; test dùng bản giả.
export const MEDIA_PORT = Symbol('MEDIA_PORT');

export interface MediaPort {
  // emptyTimeout = departureTimeout = MEETING_AUTO_END_AFTER_MIN × 60 (adapter tự đọc env)
  createRoom(roomName: string): Promise<void>;
  // true / false CHỈ khi hỏi được LiveKit. Không hỏi được (timeout, lỗi mạng, 5xx, 401) → NÉM LỖI, không bao giờ trả false
  roomExists(roomName: string): Promise<boolean>;
  // Không báo lỗi nếu room đã đóng / không tồn tại; lỗi khác → ném
  closeRoom(roomName: string): Promise<void>;
  // Không báo lỗi nếu người đó không còn trong room; lỗi khác → ném
  removeParticipant(roomName: string, userId: string): Promise<void>;
  // url = LIVEKIT_PUBLIC_URL — service không bao giờ đọc env LIVEKIT_*
  createJoinToken(input: { roomName: string; userId: string; displayName: string }): Promise<{ token: string; url: string }>;
  // Sai / thiếu chữ ký → ném UnauthorizedException (401)
  parseWebhook(rawBody: string, authHeader: string | undefined): Promise<MediaEvent>;
}

// Event webhook đã chuẩn hoá — không lộ kiểu của LiveKit ra ngoài adapter (spec §4.2)
export type MediaEvent =
  | { type: 'participant_joined'; eventId: string; roomName: string; userId: string; displayName: string; sid: string; at: Date }
  // gồm cả participant_connection_aborted (spec §6.3)
  | { type: 'participant_left'; eventId: string; roomName: string; userId: string; sid: string; at: Date }
  // endedAt adapter tính sẵn từ roomEndReason (spec §7.2)
  | { type: 'room_finished'; eventId: string; roomName: string; endedAt: Date }
  | { type: 'ignored'; eventId: string; event: string };
