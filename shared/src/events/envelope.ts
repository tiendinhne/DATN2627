export const EVENT_SCHEMA_VERSION = 1;

/**
 * Envelope chuẩn cho MỌI realtime event server -> client.
 * Chốt ngay từ đầu vì thêm field sau sẽ phải sửa mọi emit và mọi handler ở cả hai phía.
 */
export interface EventEnvelope<T = unknown> {
  /** version của schema event, để sau này đổi payload mà không phá client cũ */
  v: number;
  /** thứ tự toàn cục trong meeting. null với event ephemeral (cursor, typing). */
  seq: number | null;
  /** ISO-8601 UTC */
  ts: string;
  /** userId gây ra event, null nếu do hệ thống */
  actorId: string | null;
  meetingId: string;
  data: T;
}

export function createEnvelope<T>(params: {
  meetingId: string;
  data: T;
  seq?: number | null;
  actorId?: string | null;
}): EventEnvelope<T> {
  return {
    v: EVENT_SCHEMA_VERSION,
    seq: params.seq ?? null,
    ts: new Date().toISOString(),
    actorId: params.actorId ?? null,
    meetingId: params.meetingId,
    data: params.data,
  };
}
