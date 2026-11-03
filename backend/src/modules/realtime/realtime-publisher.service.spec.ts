import { describe, expect, it, vi } from 'vitest';
import { RealtimePublisher } from './realtime-publisher.service.js';

describe('RealtimePublisher', () => {
  it('emits a chat message through the shared room envelope', () => {
    const emit = vi.fn();
    const publisher = new RealtimePublisher();
    publisher.setNamespace({ to: vi.fn().mockReturnValue({ emit }) } as any);

    publisher.publishChatMessage({
      seq: 4,
      actorId: 'user-id',
      roomId: 'room-id',
      meetingId: null,
      message: { id: 'message-id' },
    });

    expect(emit).toHaveBeenCalledWith(
      'chat:new',
      expect.objectContaining({
        v: 1,
        seq: 4,
        actorId: 'user-id',
        roomId: 'room-id',
        meetingId: null,
        data: { message: { id: 'message-id' } },
      }),
    );
  });

  it('notifies a removed user and removes their sockets from the room across instances', async () => {
    const emit = vi.fn();
    const socketsLeave = vi.fn().mockResolvedValue(undefined);
    const namespace = {
      to: vi.fn().mockReturnValue({ emit }),
      in: vi.fn().mockReturnValue({ socketsLeave }),
    };
    const publisher = new RealtimePublisher();
    publisher.setNamespace(namespace as any);

    await publisher.revokeUser('room-id', 'user-id', 'host-id', 'KICKED');

    expect(namespace.to).toHaveBeenCalledWith('user:user-id');
    expect(emit).toHaveBeenCalledWith(
      'room:access_revoked',
      expect.objectContaining({
        roomId: 'room-id',
        actorId: 'host-id',
        data: { reason: 'KICKED' },
      }),
    );
    expect(namespace.in).toHaveBeenCalledWith('user:user-id');
    expect(socketsLeave).toHaveBeenCalledWith('room:room-id');
  });

  it('removes all sockets from a dissolved room', async () => {
    const emit = vi.fn();
    const socketsLeave = vi.fn().mockResolvedValue(undefined);
    const namespace = {
      to: vi.fn().mockReturnValue({ emit }),
      in: vi.fn().mockReturnValue({ socketsLeave }),
    };
    const publisher = new RealtimePublisher();
    publisher.setNamespace(namespace as any);

    await publisher.revokeRoom('room-id', 'host-id');

    expect(namespace.to).toHaveBeenCalledWith('room:room-id');
    expect(emit).toHaveBeenCalledWith(
      'room:access_revoked',
      expect.objectContaining({ data: { reason: 'DISSOLVED' } }),
    );
    expect(socketsLeave).toHaveBeenCalledWith('room:room-id');
  });
});

describe('RealtimePublisher whiteboard', () => {
  const input = { actorId: 'user-id', roomId: 'room-id', meetingId: 'meeting-id' };

  it('sendSnapshot gửi riêng socket vừa join, envelope chuẩn', () => {
    const publisher = new RealtimePublisher();
    const socket = { emit: vi.fn() };
    publisher.sendSnapshot(socket as any, { ...input, seq: 7, elements: [{ id: 'a' }] });
    expect(socket.emit).toHaveBeenCalledWith(
      'meeting:snapshot',
      expect.objectContaining({ v: 1, seq: 7, ...input, data: { elements: [{ id: 'a' }] } }),
    );
  });

  it('publishWbOps phát tới kênh meeting, trừ socket người gửi', () => {
    const emit = vi.fn();
    const except = vi.fn().mockReturnValue({ emit });
    const to = vi.fn().mockReturnValue({ except });
    const publisher = new RealtimePublisher();
    publisher.setNamespace({ to } as any);

    publisher.publishWbOps('socket-1', { ...input, seq: 9, elements: [{ id: 'b' }] });

    expect(to).toHaveBeenCalledWith('meeting:meeting-id');
    expect(except).toHaveBeenCalledWith('socket-1');
    expect(emit).toHaveBeenCalledWith(
      'wb:ops',
      expect.objectContaining({ v: 1, seq: 9, ...input, data: { elements: [{ id: 'b' }] } }),
    );
  });

  it('publishWbPointer dùng volatile, seq null, kèm tên hiển thị', () => {
    const emit = vi.fn();
    const except = vi.fn().mockReturnValue({ emit });
    const to = vi.fn().mockReturnValue({ except });
    const publisher = new RealtimePublisher();
    publisher.setNamespace({ volatile: { to } } as any);

    publisher.publishWbPointer('socket-1', { ...input, displayName: 'An', x: 1, y: 2 });

    expect(to).toHaveBeenCalledWith('meeting:meeting-id');
    expect(except).toHaveBeenCalledWith('socket-1');
    expect(emit).toHaveBeenCalledWith(
      'wb:pointer',
      expect.objectContaining({ seq: null, data: { userId: 'user-id', displayName: 'An', x: 1, y: 2 } }),
    );
  });

  it('leaveMeeting ép mọi socket của user rời kênh meeting (mọi instance)', async () => {
    const socketsLeave = vi.fn().mockResolvedValue(undefined);
    const namespace = { in: vi.fn().mockReturnValue({ socketsLeave }) };
    const publisher = new RealtimePublisher();
    publisher.setNamespace(namespace as any);

    await publisher.leaveMeeting('user-id', 'meeting-id');

    expect(namespace.in).toHaveBeenCalledWith('user:user-id');
    expect(socketsLeave).toHaveBeenCalledWith('meeting:meeting-id');
  });

  it('closeMeetingChannel ép mọi socket rời kênh meeting', async () => {
    const socketsLeave = vi.fn().mockResolvedValue(undefined);
    const namespace = { in: vi.fn().mockReturnValue({ socketsLeave }) };
    const publisher = new RealtimePublisher();
    publisher.setNamespace(namespace as any);

    await publisher.closeMeetingChannel('meeting-id');

    expect(namespace.in).toHaveBeenCalledWith('meeting:meeting-id');
    expect(socketsLeave).toHaveBeenCalledWith('meeting:meeting-id');
  });
});
