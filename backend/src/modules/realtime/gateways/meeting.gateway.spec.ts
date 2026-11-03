import { describe, expect, it, vi } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import { MeetingGateway } from './meeting.gateway.js';
import { RealtimePublisher } from '../realtime-publisher.service.js';

const userId = '507f1f77bcf86cd799439011';
const roomId = '507f191e810c19729de860ea';
const meetingId = '507f1f77bcf86cd799439099';

function build() {
  const jwt = { verifyAsync: vi.fn().mockResolvedValue({ sub: userId }) };
  const users = {
    findById: vi
      .fn()
      .mockResolvedValue({ _id: userId, displayName: 'Student' }),
  };
  const roomAccess = {
    assertRoomAccess: vi.fn().mockResolvedValue(undefined),
  };
  const chat = {
    sendMessage: vi.fn().mockResolvedValue({
      created: true,
      message: { id: 'message-id', roomId, content: 'hello' },
    }),
    nextSequence: vi.fn().mockResolvedValue(1),
  };
  const whiteboard = {
    assertCanJoin: vi.fn().mockResolvedValue({ roomId }),
    getSnapshot: vi.fn().mockResolvedValue({ seq: 3, elements: [{ id: 'a' }] }),
    applyOps: vi.fn().mockResolvedValue(null),
    tryPersistInBackground: vi.fn(),
  };
  const publisher = new RealtimePublisher();
  const gateway = new MeetingGateway(
    jwt as any,
    users as any,
    roomAccess as any,
    chat as any,
    publisher,
    whiteboard as any,
  );
  const emit = vi.fn();
  const except = vi.fn().mockReturnValue({ emit });
  const to = vi.fn().mockReturnValue({ emit, except });
  publisher.setNamespace({ to, volatile: { to } } as any);
  // socket.rooms giả: join / leave cập nhật như Socket.IO thật
  const socket = {
    id: 'socket-1',
    rooms: new Set<string>(['socket-1']),
    data: { userId, displayName: 'Student' } as Record<string, any>,
    join: vi.fn(async (channel: string) => {
      socket.rooms.add(channel);
    }),
    leave: vi.fn(async (channel: string) => {
      socket.rooms.delete(channel);
    }),
    emit: vi.fn(),
  };
  return { gateway, jwt, users, roomAccess, chat, whiteboard, socket, emit, except, to };
}

describe('MeetingGateway chat events', () => {
  it('authenticates the JWT in the Socket.IO handshake before connecting', async () => {
    const { gateway, jwt, users } = build();
    let middleware!: (socket: any, next: (error?: Error) => void) => void;
    gateway.afterInit({
      use: (fn: typeof middleware) => (middleware = fn),
    } as any);
    const socket = { handshake: { auth: { token: 'access-token' } }, data: {} };

    await new Promise<void>((resolve, reject) => {
      middleware(socket, (error) => (error ? reject(error) : resolve()));
    });

    expect(jwt.verifyAsync).toHaveBeenCalledWith('access-token');
    expect(users.findById).toHaveBeenCalledWith(userId);
    expect(socket.data).toEqual({ userId, displayName: 'Student' });
  });

  it('only subscribes a socket after room access has been checked', async () => {
    const { gateway, roomAccess, socket } = build();

    await gateway.handleRoomSubscribe(socket as any, { roomId });

    expect(roomAccess.assertRoomAccess).toHaveBeenCalledWith(userId, roomId);
    expect(socket.join).toHaveBeenCalledWith(`room:${roomId}`);
  });

  it('emits persisted messages to the room with the standard envelope', async () => {
    const { gateway, chat, emit, socket } = build();

    await gateway.handleChatSend(socket as any, {
      roomId,
      clientMsgId: '4bf92f30-7f38-4d71-9e7c-8f3b18d4f1b3',
      content: 'hello',
    });

    expect(chat.sendMessage).toHaveBeenCalledWith(
      userId,
      'Student',
      expect.objectContaining({ roomId, content: 'hello' }),
    );
    expect(emit).toHaveBeenCalledWith(
      'chat:new',
      expect.objectContaining({
        v: 1,
        seq: 1,
        actorId: userId,
        roomId,
        data: { message: expect.objectContaining({ id: 'message-id' }) },
      }),
    );
  });

  it('does not send invalid payloads to the chat service', async () => {
    const { gateway, chat, socket } = build();

    await gateway.handleChatSend(socket as any, {
      roomId,
      content: 'missing client message id',
    });

    expect(chat.sendMessage).not.toHaveBeenCalled();
    expect(socket.emit).toHaveBeenCalledWith(
      'error',
      expect.objectContaining({ statusCode: 400 }),
    );
  });
});

// Element hợp lệ tối thiểu
const element = (id: string, overrides: Record<string, unknown> = {}) => ({
  id,
  type: 'rectangle',
  version: 1,
  versionNonce: 7,
  isDeleted: false,
  ...overrides,
});

// Socket đã meeting:join thành công
async function joined() {
  const ctx = build();
  await ctx.gateway.handleMeetingJoin(ctx.socket as any, { meetingId });
  ctx.socket.emit.mockClear();
  return ctx;
}

describe('MeetingGateway whiteboard events', () => {
  it('meeting:join kiểm quyền, vào kênh TRƯỚC rồi mới đọc snapshot, gửi snapshot riêng socket', async () => {
    const { gateway, whiteboard, socket } = build();

    await gateway.handleMeetingJoin(socket as any, { meetingId });

    expect(whiteboard.assertCanJoin).toHaveBeenCalledWith(userId, meetingId);
    expect(socket.join).toHaveBeenCalledWith(`meeting:${meetingId}`);
    expect(socket.join.mock.invocationCallOrder[0]).toBeLessThan(
      whiteboard.getSnapshot.mock.invocationCallOrder[0],
    );
    expect(socket.emit).toHaveBeenCalledWith(
      'meeting:snapshot',
      expect.objectContaining({ v: 1, seq: 3, roomId, meetingId, data: { elements: [{ id: 'a' }] } }),
    );
  });

  it('meeting:join không có quyền → error 403, không vào kênh', async () => {
    const { gateway, whiteboard, socket } = build();
    whiteboard.assertCanJoin.mockRejectedValue(new ForbiddenException('Không phải thành viên'));

    await gateway.handleMeetingJoin(socket as any, { meetingId });

    expect(socket.join).not.toHaveBeenCalled();
    expect(socket.emit).toHaveBeenCalledWith('error', expect.objectContaining({ statusCode: 403 }));
  });

  it('meeting:join meetingId sai định dạng → 400, không kiểm quyền', async () => {
    const { gateway, whiteboard, socket } = build();

    await gateway.handleMeetingJoin(socket as any, { meetingId: 'abc' });

    expect(whiteboard.assertCanJoin).not.toHaveBeenCalled();
    expect(socket.emit).toHaveBeenCalledWith('error', expect.objectContaining({ statusCode: 400 }));
  });

  it('wb:ops khi chưa join → 403, không chạy Lua', async () => {
    const { gateway, whiteboard, socket } = build();

    await gateway.handleWhiteboardOps(socket as any, { meetingId, elements: [element('a')] });

    expect(whiteboard.applyOps).not.toHaveBeenCalled();
    expect(socket.emit).toHaveBeenCalledWith('error', expect.objectContaining({ statusCode: 403 }));
  });

  it('wb:ops có 1 element sai → 400, không chạy Lua', async () => {
    const { gateway, whiteboard, socket } = await joined();

    await gateway.handleWhiteboardOps(socket as any, {
      meetingId,
      elements: [element('a'), element('b', { type: 'embeddable' })],
    });

    expect(whiteboard.applyOps).not.toHaveBeenCalled();
    expect(socket.emit).toHaveBeenCalledWith('error', expect.objectContaining({ statusCode: 400 }));
  });

  it('wb:ops chỉ phát element thắng tới kênh meeting, trừ người gửi, rồi thử lưu nền', async () => {
    const { gateway, whiteboard, socket, to, except, emit } = await joined();
    const a = element('a');
    const b = element('b');
    whiteboard.applyOps.mockResolvedValue({ seq: 9, winners: [b] });

    await gateway.handleWhiteboardOps(socket as any, { meetingId, elements: [a, b] });

    expect(whiteboard.applyOps).toHaveBeenCalledWith(meetingId, [a, b]);
    expect(to).toHaveBeenCalledWith(`meeting:${meetingId}`);
    expect(except).toHaveBeenCalledWith('socket-1');
    expect(emit).toHaveBeenCalledWith(
      'wb:ops',
      expect.objectContaining({ seq: 9, actorId: userId, roomId, meetingId, data: { elements: [b] } }),
    );
    expect(whiteboard.tryPersistInBackground).toHaveBeenCalledWith(meetingId);
  });

  it('wb:ops không element nào thắng → không phát, không lưu', async () => {
    const { gateway, whiteboard, socket, emit } = await joined();
    whiteboard.applyOps.mockResolvedValue(null);

    await gateway.handleWhiteboardOps(socket as any, { meetingId, elements: [element('a')] });

    expect(emit).not.toHaveBeenCalledWith('wb:ops', expect.anything());
    expect(whiteboard.tryPersistInBackground).not.toHaveBeenCalled();
  });

  it('bị ép rời kênh (kick / meeting kết thúc) → wb:ops sau đó bị 403', async () => {
    const { gateway, whiteboard, socket } = await joined();
    socket.rooms.delete(`meeting:${meetingId}`);

    await gateway.handleWhiteboardOps(socket as any, { meetingId, elements: [element('a')] });

    expect(whiteboard.applyOps).not.toHaveBeenCalled();
    expect(socket.emit).toHaveBeenCalledWith('error', expect.objectContaining({ statusCode: 403 }));
  });

  it('wb:pointer phát volatile kèm tên hiển thị, seq null', async () => {
    const { gateway, socket, except, emit } = await joined();

    await gateway.handleWhiteboardPointer(socket as any, { meetingId, x: 10, y: -5.5 });

    expect(except).toHaveBeenCalledWith('socket-1');
    expect(emit).toHaveBeenCalledWith(
      'wb:pointer',
      expect.objectContaining({ seq: null, data: { userId, displayName: 'Student', x: 10, y: -5.5 } }),
    );
  });

  it('wb:pointer toạ độ ngoài ±1e7 → 400', async () => {
    const { gateway, socket } = await joined();

    await gateway.handleWhiteboardPointer(socket as any, { meetingId, x: 1e9, y: 0 });

    expect(socket.emit).toHaveBeenCalledWith('error', expect.objectContaining({ statusCode: 400 }));
  });

  it('meeting:leave rời kênh', async () => {
    const { gateway, socket } = await joined();

    await gateway.handleMeetingLeave(socket as any, { meetingId });

    expect(socket.leave).toHaveBeenCalledWith(`meeting:${meetingId}`);
    expect(socket.rooms.has(`meeting:${meetingId}`)).toBe(false);
  });
});
