export const EVENT_SCHEMA_VERSION = 1;

export interface EventEnvelope<T = unknown> {
  v: number;
  seq: number | null;
  ts: string;
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
