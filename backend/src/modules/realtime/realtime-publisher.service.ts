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

  // Whiteboard: snapshot gửi riêng socket vừa meeting:join (spec whiteboard §3.2)
  sendSnapshot(
    socket: Socket,
    input: { seq: number | null; actorId: string; roomId: string; meetingId: string; elements: unknown[] },
  ) {
    socket.emit('meeting:snapshot', {
      v: 1,
      seq: input.seq,
      ts: new Date().toISOString(),
      actorId: input.actorId,
      roomId: input.roomId,
      meetingId: input.meetingId,
      data: { elements: input.elements },
    });
  }

  // Whiteboard: element thắng tới mọi người trong meeting trừ người gửi — qua Redis adapter tới mọi instance
  publishWbOps(
    senderSocketId: string,
    input: { seq: number; actorId: string; roomId: string; meetingId: string; elements: unknown[] },
  ) {
    this.requireNamespace()
      .to(`meeting:${input.meetingId}`)
      .except(senderSocketId)
      .emit('wb:ops', {
        v: 1,
        seq: input.seq,
        ts: new Date().toISOString(),
        actorId: input.actorId,
        roomId: input.roomId,
        meetingId: input.meetingId,
        data: { elements: input.elements },
      });
  }

  // Whiteboard: con trỏ — volatile (gói cũ bỏ, không xếp hàng), không seq, không lưu
  publishWbPointer(
    senderSocketId: string,
    input: { actorId: string; displayName: string; roomId: string; meetingId: string; x: number; y: number },
  ) {
    this.requireNamespace()
      .volatile.to(`meeting:${input.meetingId}`)
      .except(senderSocketId)
      .emit('wb:pointer', {
        v: 1,
        seq: null,
        ts: new Date().toISOString(),
        actorId: input.actorId,
        roomId: input.roomId,
        meetingId: input.meetingId,
        data: { userId: input.actorId, displayName: input.displayName, x: input.x, y: input.y },
      });
  }

  // Kick / rời phòng: ép socket của user rời kênh whiteboard của meeting đang diễn ra (spec §3.3)
  async leaveMeeting(userId: string, meetingId: string) {
    await this.requireNamespace().in(`user:${userId}`).socketsLeave(`meeting:${meetingId}`);
  }

  // Meeting kết thúc: ép mọi socket rời kênh. Qua redis-adapter lệnh này chỉ publish, socket rời SAU đó —
  // KHÔNG đồng bộ; chặn cứng op muộn là key wb:closed (409 từ Lua), không phải việc rời kênh (spec §3.3, §13.1)
  async closeMeetingChannel(meetingId: string) {
    const channel = `meeting:${meetingId}`;
    await this.requireNamespace().in(channel).socketsLeave(channel);
  }

  private requireNamespace(): Namespace {
    if (!this.namespace)
      throw new Error('Socket.IO namespace chưa được khởi tạo');
    return this.namespace;
  }
}
