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
