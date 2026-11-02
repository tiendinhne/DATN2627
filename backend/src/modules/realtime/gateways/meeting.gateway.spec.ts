import { describe, expect, it, vi } from 'vitest';
import { MeetingGateway } from './meeting.gateway.js';
import { RealtimePublisher } from '../realtime-publisher.service.js';

const userId = '507f1f77bcf86cd799439011';
const roomId = '507f191e810c19729de860ea';

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
  const publisher = new RealtimePublisher();
  const gateway = new MeetingGateway(
    jwt as any,
    users as any,
    roomAccess as any,
    chat as any,
    publisher,
  );
  const emit = vi.fn();
  publisher.setNamespace({ to: vi.fn().mockReturnValue({ emit }) } as any);
  const socket = {
    data: { userId, displayName: 'Student' },
    join: vi.fn(),
    leave: vi.fn(),
    emit: vi.fn(),
  };
  return { gateway, jwt, users, roomAccess, chat, socket, emit };
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
