import { describe, expect, it, vi } from 'vitest';
import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { gunzipSync } from 'node:zlib';
import { WhiteboardService } from './whiteboard.service.js';
import { WB_APPLY_SCRIPT } from './whiteboard.lua.js';
import { MeetingStatus, RoomRole } from '../../shared/enums.js';

// Query Mongoose giả: lean/select nối chuỗi, exec() trả result
function query(result: unknown) {
  const chain: any = {
    lean: vi.fn(() => chain),
    select: vi.fn(() => chain),
    exec: vi.fn().mockResolvedValue(result),
  };
  return chain;
}
const q = (result: unknown) => vi.fn((..._args: any[]) => query(result));

const userId = new Types.ObjectId().toString();
const roomId = new Types.ObjectId().toString();
const meetingId = new Types.ObjectId().toString();
const json = (value: unknown) => JSON.stringify(value);
const duplicateKeyError = () => Object.assign(new Error('E11000 duplicate key'), { code: 11000 });

// Redis client giả: multi().hGetAll().get().exec() → [hash, seq]
function fakeRedisClient(hash: Record<string, string>, seq: string | null) {
  const multi: any = {
    hGetAll: vi.fn(() => multi),
    get: vi.fn(() => multi),
    exec: vi.fn().mockResolvedValue([hash, seq]),
  };
  return {
    multi: vi.fn(() => multi),
    eval: vi.fn(),
    set: vi.fn().mockResolvedValue('OK'),
    del: vi.fn().mockResolvedValue(3),
  };
}

function build(hash: Record<string, string> = {}, seq: string | null = null) {
  const whiteboardModel = { updateOne: q({ acknowledged: true }) };
  const meetingModel = {
    findById: q({ _id: new Types.ObjectId(meetingId), roomId: new Types.ObjectId(roomId), status: MeetingStatus.ACTIVE }),
  };
  const access = { assertRoomAccess: vi.fn().mockResolvedValue({ role: RoomRole.MEMBER }) };
  const client = fakeRedisClient(hash, seq);
  const redis = { getClient: () => client };
  const service = new WhiteboardService(whiteboardModel as any, meetingModel as any, access as any, redis as any);
  return { service, whiteboardModel, meetingModel, access, client };
}

describe('assertCanJoin', () => {
  it('thành viên + meeting ACTIVE → trả roomId, kiểm quyền theo roomId của meeting', async () => {
    const { service, access } = build();
    await expect(service.assertCanJoin(userId, meetingId)).resolves.toEqual({ roomId });
    expect(access.assertRoomAccess).toHaveBeenCalledWith(userId, roomId);
  });

  it('meeting không tồn tại → 404', async () => {
    const { service, meetingModel } = build();
    meetingModel.findById.mockReturnValue(query(null));
    await expect(service.assertCanJoin(userId, meetingId)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('không phải thành viên → ném lỗi của assertRoomAccess', async () => {
    const { service, access } = build();
    access.assertRoomAccess.mockRejectedValue(new ForbiddenException());
    await expect(service.assertCanJoin(userId, meetingId)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('meeting đã kết thúc → 409', async () => {
    const { service, meetingModel } = build();
    meetingModel.findById.mockReturnValue(query({ roomId: new Types.ObjectId(roomId), status: MeetingStatus.ENDED }));
    await expect(service.assertCanJoin(userId, meetingId)).rejects.toBeInstanceOf(ConflictException);
  });
});

describe('getSnapshot', () => {
  it('đọc Hash + seq cùng một MULTI, trả cả tombstone', async () => {
    const { service, client } = build({ a: json({ id: 'a', isDeleted: false }), b: json({ id: 'b', isDeleted: true }) }, '7');
    const snapshot = await service.getSnapshot(meetingId);
    expect(client.multi).toHaveBeenCalledTimes(1);
    expect(snapshot.seq).toBe(7);
    expect(snapshot.elements).toEqual(expect.arrayContaining([{ id: 'a', isDeleted: false }, { id: 'b', isDeleted: true }]));
  });

  it('elements trả theo fractional index (z-order), không theo thứ tự Hash', async () => {
    const { service } = build(
      { c: json({ id: 'c', index: 'a2' }), a: json({ id: 'a', index: 'a0' }), b: json({ id: 'b', index: 'a1' }) },
      '4',
    );
    const snapshot = await service.getSnapshot(meetingId);
    expect((snapshot.elements as Array<{ id: string }>).map((e) => e.id)).toEqual(['a', 'b', 'c']);
  });

  it('board trống → seq null, elements rỗng', async () => {
    const { service } = build();
    await expect(service.getSnapshot(meetingId)).resolves.toEqual({ seq: null, elements: [] });
  });
});

describe('applyOps', () => {
  const a = { id: 'a', type: 'rectangle', version: 2, versionNonce: 9, isDeleted: false };
  const b = { id: 'b', type: 'text', version: 1, versionNonce: 3, isDeleted: true };

  it('gọi script với đúng key + ARGV, trả element thắng theo chỉ số', async () => {
    const { service, client } = build();
    client.eval.mockResolvedValue(['OK', 5, 1]);
    await expect(service.applyOps(meetingId, [a, b])).resolves.toEqual({ seq: 5, winners: [b] });
    expect(client.eval).toHaveBeenCalledWith(WB_APPLY_SCRIPT, {
      keys: [`wb:${meetingId}`, `wb:seq:${meetingId}`, `wb:alive:${meetingId}`, `wb:closed:${meetingId}`],
      arguments: ['5000', '20000', '86400', 'a', '2', '9', '0', json(a), 'b', '1', '3', '1', json(b)],
    });
  });

  it('NOOP → null', async () => {
    const { service, client } = build();
    client.eval.mockResolvedValue(['NOOP']);
    await expect(service.applyOps(meetingId, [a])).resolves.toBeNull();
  });

  it('CLOSED → 409', async () => {
    const { service, client } = build();
    client.eval.mockResolvedValue(['CLOSED']);
    await expect(service.applyOps(meetingId, [a])).rejects.toBeInstanceOf(ConflictException);
  });

  it('LIMIT → 400', async () => {
    const { service, client } = build();
    client.eval.mockResolvedValue(['LIMIT']);
    await expect(service.applyOps(meetingId, [a])).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('persist', () => {
  it('ghi gzip element CHƯA xoá với guard lastSeq + upsert, roomId lấy từ meeting', async () => {
    const { service, whiteboardModel } = build(
      { a: json({ id: 'a', isDeleted: false }), b: json({ id: 'b', isDeleted: true }) },
      '7',
    );
    await service.persist(meetingId);

    expect(whiteboardModel.updateOne).toHaveBeenCalledWith(
      { meetingId, lastSeq: { $lt: 7 } },
      {
        $set: {
          elementsGzip: expect.any(Buffer),
          elementCount: 1,
          rawSizeBytes: expect.any(Number),
          lastSeq: 7,
          lastPersistedAt: expect.any(Date),
        },
        $setOnInsert: { roomId: expect.anything() },
      },
      { upsert: true },
    );
    const update = whiteboardModel.updateOne.mock.calls[0][1] as any;
    // So chuỗi — toEqual giữa 2 instance ObjectId không ổn định
    expect(String(update.$setOnInsert.roomId)).toBe(roomId);
    expect(JSON.parse(gunzipSync(update.$set.elementsGzip).toString())).toEqual([{ id: 'a', isDeleted: false }]);
  });

  it('mảng ghi Mongo theo fractional index, không theo thứ tự Hash', async () => {
    const { service, whiteboardModel } = build(
      { c: json({ id: 'c', index: 'a2' }), a: json({ id: 'a', index: 'a0' }), b: json({ id: 'b', index: 'a1' }) },
      '4',
    );
    await service.persist(meetingId);
    const update = whiteboardModel.updateOne.mock.calls[0][1] as any;
    const ids = JSON.parse(gunzipSync(update.$set.elementsGzip).toString()).map((e: { id: string }) => e.id);
    expect(ids).toEqual(['a', 'b', 'c']);
  });

  it('Hash rỗng → không ghi (endMeeting chạy lại không đè board rỗng)', async () => {
    const { service, whiteboardModel } = build({}, null);
    await service.persist(meetingId);
    expect(whiteboardModel.updateOne).not.toHaveBeenCalled();
  });

  it('mọi element đã xoá → vẫn ghi [] (board bị clear là trạng thái thật)', async () => {
    const { service, whiteboardModel } = build({ a: json({ id: 'a', isDeleted: true }) }, '3');
    await service.persist(meetingId);
    const update = whiteboardModel.updateOne.mock.calls[0][1] as any;
    expect(update.$set.elementCount).toBe(0);
    expect(JSON.parse(gunzipSync(update.$set.elementsGzip).toString())).toEqual([]);
  });

  it('E11000 (đua insert đầu tiên) → thử lại 1 lần, cùng filter / update, KHÔNG upsert', async () => {
    const { service, whiteboardModel } = build({ a: json({ id: 'a', isDeleted: false }) }, '3');
    whiteboardModel.updateOne
      .mockReturnValueOnce({ exec: vi.fn().mockRejectedValue(duplicateKeyError()) })
      .mockReturnValueOnce({ exec: vi.fn().mockResolvedValue({ acknowledged: true }) });
    await expect(service.persist(meetingId)).resolves.toBeUndefined();
    expect(whiteboardModel.updateOne).toHaveBeenCalledTimes(2);
    const [first, second] = whiteboardModel.updateOne.mock.calls as any[];
    expect(second[0]).toEqual(first[0]);
    expect(second[1]).toEqual(first[1]);
    expect(first[2]).toEqual({ upsert: true });
    expect(second[2]).toBeUndefined();
  });

  it('lỗi Mongo khác → ném', async () => {
    const { service, whiteboardModel } = build({ a: json({ id: 'a', isDeleted: false }) }, '3');
    whiteboardModel.updateOne.mockReturnValue({ exec: vi.fn().mockRejectedValue(new Error('mongo down')) });
    await expect(service.persist(meetingId)).rejects.toThrow('mongo down');
  });
});

describe('tryPersistInBackground', () => {
  it('giành được khoá 15 s → persist chạy nền', async () => {
    const { service, client } = build();
    const persist = vi.spyOn(service, 'persist').mockResolvedValue();
    service.tryPersistInBackground(meetingId);
    await vi.waitFor(() => expect(persist).toHaveBeenCalledWith(meetingId));
    expect(client.set).toHaveBeenCalledWith(`wb:persist-lock:${meetingId}`, '1', { NX: true, PX: 15000 });
  });

  it('không giành được khoá → không persist', async () => {
    const { service, client } = build();
    client.set.mockResolvedValue(null);
    const persist = vi.spyOn(service, 'persist').mockResolvedValue();
    service.tryPersistInBackground(meetingId);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(persist).not.toHaveBeenCalled();
  });

  it('persist nền lỗi → không ném ra ngoài (chỉ log)', async () => {
    const { service } = build();
    vi.spyOn(service, 'persist').mockRejectedValue(new Error('mongo down'));
    expect(() => service.tryPersistInBackground(meetingId)).not.toThrow();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
});

describe('finalizeBoard', () => {
  it('SET wb:closed → persist → xoá 3 key Redis (closed giữ lại)', async () => {
    const { service, client } = build();
    const persist = vi.spyOn(service, 'persist').mockResolvedValue();
    await service.finalizeBoard(meetingId);
    expect(client.set).toHaveBeenCalledWith(`wb:closed:${meetingId}`, '1', { EX: 86400 });
    expect(client.set.mock.invocationCallOrder[0]).toBeLessThan(persist.mock.invocationCallOrder[0]);
    expect(client.del).toHaveBeenCalledWith([`wb:${meetingId}`, `wb:seq:${meetingId}`, `wb:alive:${meetingId}`]);
    expect(persist.mock.invocationCallOrder[0]).toBeLessThan(client.del.mock.invocationCallOrder[0]);
  });

  it('persist lỗi → giữ key (TTL 24 h), không ném', async () => {
    const { service, client } = build();
    vi.spyOn(service, 'persist').mockRejectedValue(new Error('mongo down'));
    await expect(service.finalizeBoard(meetingId)).resolves.toBeUndefined();
    expect(client.del).not.toHaveBeenCalled();
  });
});
