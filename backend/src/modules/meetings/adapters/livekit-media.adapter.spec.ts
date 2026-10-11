import { describe, it, expect } from 'vitest';
import { computeEndedAt, isNotFound, livekitEnvSchema, toMediaEvent } from './livekit-media.adapter.js';

// Object tự dựng — test KHÔNG đọc process.env (spec §3.2: npm test chạy được trên máy không có biến LiveKit)
const validEnv = {
  LIVEKIT_URL: 'http://livekit:7880',
  LIVEKIT_PUBLIC_URL: 'ws://localhost:7880',
  LIVEKIT_API_KEY: 'devkey',
  LIVEKIT_API_SECRET: 'x'.repeat(32),
  LIVEKIT_TOKEN_TTL_HOURS: '6',
  MEETING_AUTO_END_AFTER_MIN: '3',
};

describe('livekitEnvSchema', () => {
  it('đủ biến → hợp lệ, số được ép kiểu', () => {
    const r = livekitEnvSchema.safeParse(validEnv);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.LIVEKIT_TOKEN_TTL_HOURS).toBe(6);
      expect(r.data.MEETING_AUTO_END_AFTER_MIN).toBe(3);
    }
  });

  it('thiếu LIVEKIT_PUBLIC_URL → lỗi', () => {
    const { LIVEKIT_PUBLIC_URL: _omit, ...env } = validEnv;
    expect(livekitEnvSchema.safeParse(env).success).toBe(false);
  });

  it('secret ngắn hơn 32 ký tự → lỗi', () => {
    expect(livekitEnvSchema.safeParse({ ...validEnv, LIVEKIT_API_SECRET: 'ngan' }).success).toBe(false);
  });

  it('TTL 0 giờ → lỗi', () => {
    expect(livekitEnvSchema.safeParse({ ...validEnv, LIVEKIT_TOKEN_TTL_HOURS: '0' }).success).toBe(false);
  });
});

describe('computeEndedAt', () => {
  const createdAt = new Date('2026-10-05T08:00:00Z');

  it('room trống đủ thời gian (IDLE_TIMEOUT = 2) → lúc người cuối rời = createdAt − timeout', () => {
    expect(computeEndedAt(2, createdAt, 180)).toEqual(new Date('2026-10-05T07:57:00Z'));
  });

  it('room bị xoá bằng API (API_DELETE = 1) → giữ createdAt', () => {
    expect(computeEndedAt(1, createdAt, 180)).toEqual(createdAt);
  });

  it('không có roomEndReason (bản LiveKit cũ) → giữ createdAt', () => {
    expect(computeEndedAt(undefined, createdAt, 180)).toEqual(createdAt);
  });
});

describe('isNotFound', () => {
  it('lỗi "không tìm thấy" của LiveKit → true', () => {
    expect(isNotFound({ code: 'not_found' })).toBe(true);
    expect(isNotFound({ status: 404 })).toBe(true);
  });

  it('lỗi khác (timeout, mạng, 5xx) → false', () => {
    expect(isNotFound(new Error('fetch failed'))).toBe(false);
    expect(isNotFound({ status: 500 })).toBe(false);
    expect(isNotFound(undefined)).toBe(false);
  });
});

describe('toMediaEvent', () => {
  const base = { id: 'EV_1', createdAt: 1759651200n, room: { name: '6700000000000000000000aa' } };

  it('participant_joined → đủ userId, tên, sid, thời điểm từ createdAt (bigint, giây)', () => {
    const e = toMediaEvent(
      { ...base, event: 'participant_joined', participant: { identity: '6700000000000000000000bb', name: 'An', sid: 'PA_1' } },
      180,
    );
    expect(e).toEqual({
      type: 'participant_joined',
      eventId: 'EV_1',
      roomName: '6700000000000000000000aa',
      userId: '6700000000000000000000bb',
      displayName: 'An',
      sid: 'PA_1',
      at: new Date(1759651200 * 1000),
    });
  });

  it('participant_connection_aborted → xử lý như participant_left', () => {
    const e = toMediaEvent(
      { ...base, event: 'participant_connection_aborted', participant: { identity: 'u', sid: 'PA_2' } },
      180,
    );
    expect(e).toMatchObject({ type: 'participant_left', userId: 'u', sid: 'PA_2' });
  });

  it('room_finished vì trống → endedAt lùi lại timeout', () => {
    const e = toMediaEvent({ ...base, event: 'room_finished', roomEndReason: 2 }, 180);
    expect(e).toEqual({
      type: 'room_finished',
      eventId: 'EV_1',
      roomName: '6700000000000000000000aa',
      endedAt: new Date((1759651200 - 180) * 1000),
    });
  });

  it('event không quan tâm → ignored', () => {
    expect(toMediaEvent({ ...base, event: 'track_published' }, 180)).toEqual({
      type: 'ignored',
      eventId: 'EV_1',
      event: 'track_published',
    });
  });
});
