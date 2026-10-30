import { Injectable } from '@nestjs/common';
import type { Namespace, Socket } from 'socket.io';

export type RoomAccessRevocationReason = 'KICKED' | 'LEFT' | 'DISSOLVED';

@Injectable()
export class RealtimePublisher {
  private namespace?: Namespace;

  setNamespace(namespace: Namespace) {
    this.namespace = namespace;
  }

  publishChatMessage(input: {
    seq: number;
    actorId: string;
    roomId: string;
    meetingId: string | null;
    message: unknown;
  }) {
    this.requireNamespace()
      .to(`room:${input.roomId}`)
      .emit('chat:new', {
        v: 1,
        seq: input.seq,
        ts: new Date().toISOString(),
        actorId: input.actorId,
        roomId: input.roomId,
        meetingId: input.meetingId,
        data: { message: input.message },
      });
  }

  sendError(
    socket: Socket,
    payload: { statusCode: number; error: string; message: string | string[] },
  ) {
    socket.emit('error', payload);
  }

  async revokeUser(
    roomId: string,
    userId: string,
    actorId: string,
    reason: 'KICKED' | 'LEFT',
  ) {
    const namespace = this.requireNamespace();
    const userRoom = `user:${userId}`;
    namespace.to(userRoom).emit('room:access_revoked', {
      v: 1,
      seq: null,
      ts: new Date().toISOString(),
      actorId,
      roomId,
      meetingId: null,
      data: { reason },
    });
    await namespace.in(userRoom).socketsLeave(`room:${roomId}`);
  }

  async revokeRoom(roomId: string, actorId: string) {
    const namespace = this.requireNamespace();
    const roomChannel = `room:${roomId}`;
    namespace.to(roomChannel).emit('room:access_revoked', {
      v: 1,
      seq: null,
      ts: new Date().toISOString(),
      actorId,
      roomId,
      meetingId: null,
      data: { reason: 'DISSOLVED' satisfies RoomAccessRevocationReason },
    });
    await namespace.in(roomChannel).socketsLeave(roomChannel);
  }

  private requireNamespace(): Namespace {
    if (!this.namespace)
      throw new Error('Socket.IO namespace chưa được khởi tạo');
    return this.namespace;
  }
}
