import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AccessToken, RoomServiceClient, WebhookReceiver } from 'livekit-server-sdk';
import { z } from 'zod';
import type { MediaEvent, MediaPort } from '../ports/media.port.js';

// Biến môi trường LiveKit (spec §3.2). Kiểm trong constructor = lúc app khởi động, KHÔNG lúc import file
export const livekitEnvSchema = z.object({
  LIVEKIT_URL: z.string().url(), // gọi API LiveKit (nội bộ)
  LIVEKIT_PUBLIC_URL: z.string().url(), // trả cho trình duyệt
  LIVEKIT_API_KEY: z.string().min(1),
  LIVEKIT_API_SECRET: z.string().min(32),
  LIVEKIT_TOKEN_TTL_HOURS: z.coerce.number().int().min(1).max(24),
  MEETING_AUTO_END_AFTER_MIN: z.coerce.number().int().min(1).max(60),
});

// Mọi thành viên cùng quyền media (role.md). canPublishData: false → app data đi Socket.IO, không qua LiveKit (P2)
const MEMBER_GRANT = { roomJoin: true, canPublish: true, canSubscribe: true, canPublishData: false };

// RoomEndReason.ROOM_END_IDLE_TIMEOUT trong livekit_models.proto — room trống đủ emptyTimeout / departureTimeout
const ROOM_END_IDLE_TIMEOUT = 2;

// Timeout mỗi request tới LiveKit API, đơn vị GIÂY (đo ở Task 1) — roomExists không treo lâu khi LiveKit chết
const REQUEST_TIMEOUT_SEC = 5;

// Lúc meeting thật sự hết người khi LiveKit báo room_finished (spec §7.2)
export function computeEndedAt(reason: number | undefined, createdAt: Date, timeoutSec: number): Date {
  if (reason === ROOM_END_IDLE_TIMEOUT) {
    return new Date(createdAt.getTime() - timeoutSec * 1000);
  }
  return createdAt;
}

// Lỗi "không tìm thấy" của LiveKit API (room / người không tồn tại).
// Đo ở Task 1: ServerError { code: 'not_found', status: 404 }; LiveKit chết → TypeError không có code / status
export function isNotFound(err: unknown): boolean {
  const e = err as { code?: unknown; status?: unknown } | undefined;
  return e?.code === 'not_found' || e?.status === 404;
}

// Phần webhook LiveKit mà adapter đọc. createdAt là số giây (protobuf int64 → bigint ở SDK)
export type LkWebhookEvent = {
  id?: string;
  event?: string;
  createdAt?: number | bigint;
  room?: { name?: string };
  participant?: { identity?: string; name?: string; sid?: string };
  roomEndReason?: number;
};

// Chuyển webhook LiveKit → MediaEvent trung lập (service không biết kiểu của LiveKit)
export function toMediaEvent(e: LkWebhookEvent, timeoutSec: number): MediaEvent {
  const eventId = e.id ?? '';
  const roomName = e.room?.name ?? '';
  const at = new Date(Number(e.createdAt ?? 0) * 1000);
  const p = e.participant;

  switch (e.event) {
    case 'participant_joined':
      return {
        type: 'participant_joined',
        eventId,
        roomName,
        userId: p?.identity ?? '',
        displayName: p?.name ?? '',
        sid: p?.sid ?? '',
        at,
      };
    // LiveKit gửi left HOẶC connection_aborted cho một kết nối, không gửi cả hai (spec §6.3)
    case 'participant_left':
    case 'participant_connection_aborted':
      return { type: 'participant_left', eventId, roomName, userId: p?.identity ?? '', sid: p?.sid ?? '', at };
    case 'room_finished':
      return { type: 'room_finished', eventId, roomName, endedAt: computeEndedAt(e.roomEndReason, at, timeoutSec) };
    default:
      return { type: 'ignored', eventId, event: e.event ?? '' };
  }
}

@Injectable()
export class LivekitMediaAdapter implements MediaPort {
  private readonly env: z.infer<typeof livekitEnvSchema>;
  private readonly rooms: RoomServiceClient;
  private readonly webhooks: WebhookReceiver;
  private readonly timeoutSec: number;

  constructor() {
    const parsed = livekitEnvSchema.safeParse(process.env);
    if (!parsed.success) {
      // Fail-fast (PROJECT_CONTEXT §14): thiếu / sai biến → app không khởi động
      const detail = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
      throw new Error(`Biến môi trường LiveKit không hợp lệ — ${detail}`);
    }
    this.env = parsed.data;
    this.rooms = new RoomServiceClient(this.env.LIVEKIT_URL, this.env.LIVEKIT_API_KEY, this.env.LIVEKIT_API_SECRET, {
      requestTimeout: REQUEST_TIMEOUT_SEC,
    });
    this.webhooks = new WebhookReceiver(this.env.LIVEKIT_API_KEY, this.env.LIVEKIT_API_SECRET);
    this.timeoutSec = this.env.MEETING_AUTO_END_AFTER_MIN * 60;
  }

  async createRoom(roomName: string) {
    // Trống đủ timeout → LiveKit tự đóng room, gửi room_finished (ADR-022)
    await this.rooms.createRoom({ name: roomName, emptyTimeout: this.timeoutSec, departureTimeout: this.timeoutSec });
  }

  async roomExists(roomName: string) {
    // Lỗi KHÔNG đổi thành false — ném ra để service trả 502, không chốt nhầm meeting đang chạy (spec §4.2)
    const rooms = await this.rooms.listRooms([roomName]);
    return rooms.length > 0;
  }

  async closeRoom(roomName: string) {
    try {
      await this.rooms.deleteRoom(roomName);
    } catch (err) {
      if (!isNotFound(err)) throw err;
    }
  }

  async removeParticipant(roomName: string, userId: string) {
    try {
      await this.rooms.removeParticipant(roomName, userId);
    } catch (err) {
      if (!isNotFound(err)) throw err;
    }
  }

  async createJoinToken({ roomName, userId, displayName }: { roomName: string; userId: string; displayName: string }) {
    // identity = userId → mở tab thứ 2 thì LiveKit đá tab cũ (DUPLICATE_IDENTITY) — hành vi mong muốn
    const at = new AccessToken(this.env.LIVEKIT_API_KEY, this.env.LIVEKIT_API_SECRET, {
      identity: userId,
      name: displayName,
      ttl: `${this.env.LIVEKIT_TOKEN_TTL_HOURS}h`,
    });
    at.addGrant({ ...MEMBER_GRANT, room: roomName });
    return { token: await at.toJwt(), url: this.env.LIVEKIT_PUBLIC_URL };
  }

  async parseWebhook(rawBody: string, authHeader: string | undefined): Promise<MediaEvent> {
    let event;
    try {
      // Verify chữ ký: header Authorization là JWT chứa sha256 của raw body
      event = await this.webhooks.receive(rawBody, authHeader);
    } catch {
      throw new UnauthorizedException('Chữ ký webhook không hợp lệ');
    }
    return toMediaEvent(event, this.timeoutSec);
  }
}
