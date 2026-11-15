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
  const ai = { generate: vi.fn() };
  const publisher = new RealtimePublisher();
  const gateway = new MeetingGateway(
    jwt as any,
    users as any,
    roomAccess as any,
    chat as any,
    publisher,
    whiteboard as any,
    ai as any,
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
  return { gateway, jwt, users, roomAccess, chat, whiteboard, ai, socket, emit, except, to };
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

  it('meeting:join: getSnapshot lỗi → rời kênh rồi ném lại (không ở trong kênh mà thiếu snapshot)', async () => {
    const { gateway, whiteboard, socket } = build();
    whiteboard.getSnapshot.mockRejectedValue(new Error('redis down'));

    await expect(gateway.handleMeetingJoin(socket as any, { meetingId })).rejects.toThrow('redis down');

    expect(socket.leave).toHaveBeenCalledWith(`meeting:${meetingId}`);
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

  it('wb:pointer phát volatile kèm tên hiển thị, công cụ + nút chuột (laser), seq null', async () => {
    const { gateway, socket, except, emit } = await joined();

    await gateway.handleWhiteboardPointer(socket as any, { meetingId, x: 10, y: -5.5, tool: 'laser', button: 'down' });

    expect(except).toHaveBeenCalledWith('socket-1');
    expect(emit).toHaveBeenCalledWith(
      'wb:pointer',
      expect.objectContaining({
        seq: null,
        data: { userId, displayName: 'Student', x: 10, y: -5.5, tool: 'laser', button: 'down' },
      }),
    );
  });

  it.each<[string, Record<string, unknown>]>([
    ['toạ độ ngoài ±1e7', { x: 1e9 }],
    ['tool lạ', { tool: 'pen' }],
    ['button lạ', { button: 'left' }],
    ['thiếu tool', { tool: undefined }],
  ])('wb:pointer %s → 400', async (_name, patch) => {
    const { gateway, socket } = await joined();

    await gateway.handleWhiteboardPointer(socket as any, { meetingId, x: 0, y: 0, tool: 'pointer', button: 'up', ...patch });

    expect(socket.emit).toHaveBeenCalledWith('error', expect.objectContaining({ statusCode: 400 }));
  });

  it('meeting:leave rời kênh', async () => {
    const { gateway, socket } = await joined();

    await gateway.handleMeetingLeave(socket as any, { meetingId });

    expect(socket.leave).toHaveBeenCalledWith(`meeting:${meetingId}`);
    expect(socket.rooms.has(`meeting:${meetingId}`)).toBe(false);
  });
});

describe('MeetingGateway ai:generate', () => {
  const requestId = '4bf92f30-7f38-4d71-9e7c-8f3b18d4f1b3';
  const payload = { meetingId, requestId, prompt: 'Quy trình đăng nhập', kind: 'FLOWCHART' };
  const diagram = { nodes: [], edges: [] };

  it('chưa vào meeting → 403, không gọi AI', async () => {
    const { gateway, ai, socket } = build();

    await gateway.handleAiGenerate(socket as any, payload);

    expect(ai.generate).not.toHaveBeenCalled();
    expect(socket.emit).toHaveBeenCalledWith('error', expect.objectContaining({ statusCode: 403 }));
  });

  it.each<[string, Record<string, unknown>]>([
    ['kind lạ', { ...payload, kind: 'TABLE' }],
    ['prompt dưới 3 ký tự sau khi cắt khoảng trắng', { ...payload, prompt: '  ab  ' }],
    ['prompt quá 1000 ký tự', { ...payload, prompt: 'a'.repeat(1001) }],
    ['requestId có ký tự lạ', { ...payload, requestId: 'abc def ghi' }],
    ['thừa field', { ...payload, model: 'gemini-pro' }],
  ])('payload sai (%s) → 400, không gọi AI', async (_name, data) => {
    const { gateway, ai, socket } = await joined();

    await gateway.handleAiGenerate(socket as any, data);

    expect(ai.generate).not.toHaveBeenCalled();
    expect(socket.emit).toHaveBeenCalledWith('error', expect.objectContaining({ statusCode: 400 }));
  });

  it('thành công → gọi AI với prompt đã cắt khoảng trắng; ai:result chỉ tới socket gửi, seq null', async () => {
    const { gateway, ai, socket, to } = await joined();
    ai.generate.mockResolvedValue({ ok: true, diagram });

    await gateway.handleAiGenerate(socket as any, { ...payload, prompt: '  Quy trình đăng nhập  ' });

    expect(ai.generate).toHaveBeenCalledWith({
      userId,
      roomId,
      meetingId,
      requestId,
      prompt: 'Quy trình đăng nhập',
      kind: 'FLOWCHART',
    });
    expect(socket.emit).toHaveBeenCalledWith(
      'ai:result',
      expect.objectContaining({ v: 1, seq: null, actorId: userId, roomId, meetingId, data: { requestId, diagram } }),
    );
    expect(to).not.toHaveBeenCalled();
  });

  it('thất bại → ai:status failed kèm code + message, chỉ tới socket gửi', async () => {
    const { gateway, ai, socket, to } = await joined();
    ai.generate.mockResolvedValue({ ok: false, code: 'TIMEOUT', message: 'AI phản hồi quá lâu, hãy thử lại.' });

    await gateway.handleAiGenerate(socket as any, payload);

    expect(socket.emit).toHaveBeenCalledWith(
      'ai:status',
      expect.objectContaining({
        seq: null,
        data: { requestId, status: 'failed', code: 'TIMEOUT', message: 'AI phản hồi quá lâu, hãy thử lại.' },
      }),
    );
    expect(to).not.toHaveBeenCalled();
  });
});
