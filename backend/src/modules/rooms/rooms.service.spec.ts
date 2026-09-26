import { describe, it, expect, vi } from 'vitest';
import { InternalServerErrorException, Logger } from '@nestjs/common';
import { Types } from 'mongoose';
import { RoomsService, generateJoinCode } from './rooms.service.js';
import { RoomRole, RoomStatus } from '../../shared/enums.js';

// Query Mongoose giả: lean/sort/populate/select nối chuỗi, exec() trả result
function query(result: unknown) {
  const chain: any = {
    lean: vi.fn(() => chain),
    sort: vi.fn(() => chain),
    populate: vi.fn(() => chain),
    select: vi.fn(() => chain),
    exec: vi.fn().mockResolvedValue(result),
  };
  return chain;
}

// vi.fn trả về query giả; nhận mọi tham số để test đọc lại bằng mock.calls
const q = (result: unknown) => vi.fn((..._args: any[]) => query(result));

const userId = new Types.ObjectId().toString();
const roomId = new Types.ObjectId().toString();

function fakeRoom(overrides: Record<string, unknown> = {}) {
  return {
    _id: new Types.ObjectId(roomId),
    name: 'Nhóm Toán',
    description: '',
    joinCode: 'ABCDEFGH',
    ownerId: new Types.ObjectId(userId),
    status: RoomStatus.ACTIVE,
    memberCount: 1,
    createdAt: new Date('2026-09-26T00:00:00Z'),
    ...overrides,
  };
}

function build() {
  const roomModel = {
    create: vi.fn(),
    findOne: q(null),
    findById: q(null),
    findOneAndUpdate: q(null),
    updateOne: q({ modifiedCount: 1 }),
    deleteOne: q({ deletedCount: 1 }),
  };
  const memberModel = {
    create: vi.fn().mockResolvedValue({}),
    findOne: q(null),
    find: q([]),
    aggregate: q([]),
    deleteOne: q({ deletedCount: 1 }),
  };
  // Mặc định: là thành viên thường, và có quyền HOST khi hỏi assertRoomPermission
  const access = {
    assertRoomAccess: vi.fn().mockResolvedValue({ role: RoomRole.MEMBER }),
    assertRoomPermission: vi.fn().mockResolvedValue({ role: RoomRole.HOST }),
  };
  const redis = {
    incr: vi.fn().mockResolvedValue(1),
    expire: vi.fn().mockResolvedValue(true),
  };
  const service = new RoomsService(roomModel as any, memberModel as any, access as any, redis as any);
  return { service, roomModel, memberModel, access, redis };
}

// Lỗi trùng unique index của Mongo
const duplicateKeyError = () => Object.assign(new Error('E11000 duplicate key'), { code: 11000 });

describe('generateJoinCode', () => {
  it('8 ký tự base32 A–Z, 2–7', () => {
    expect(generateJoinCode()).toMatch(/^[A-Z2-7]{8}$/);
  });
});

describe('createRoom', () => {
  it('tạo room memberCount 1, người tạo thành HOST, response trả id', async () => {
    const { service, roomModel, memberModel } = build();
    const room = fakeRoom();
    roomModel.create.mockResolvedValue(room);

    const res = await service.createRoom(userId, { name: 'Nhóm Toán' });

    expect(roomModel.create).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Nhóm Toán', ownerId: userId, memberCount: 1 }),
    );
    expect(memberModel.create).toHaveBeenCalledWith({ roomId: room._id, userId, role: RoomRole.HOST });
    expect(res).toMatchObject({ id: roomId, ownerId: userId, myRole: RoomRole.HOST, memberCount: 1 });
    expect(res).not.toHaveProperty('_id');
  });

  it('joinCode trùng → sinh mã khác rồi thử lại', async () => {
    const { service, roomModel } = build();
    roomModel.create.mockRejectedValueOnce(duplicateKeyError()).mockResolvedValueOnce(fakeRoom());

    await service.createRoom(userId, { name: 'Nhóm Toán' });

    expect(roomModel.create).toHaveBeenCalledTimes(2);
    expect(roomModel.create.mock.calls[1][0].joinCode).toMatch(/^[A-Z2-7]{8}$/);
  });

  it('trùng mã 5 lần liên tiếp → 500', async () => {
    const { service, roomModel } = build();
    roomModel.create.mockRejectedValue(duplicateKeyError());

    await expect(service.createRoom(userId, { name: 'X' })).rejects.toBeInstanceOf(InternalServerErrorException);
    expect(roomModel.create).toHaveBeenCalledTimes(5);
  });

  it('tạo member HOST lỗi → xoá room vừa tạo và ném lại lỗi', async () => {
    const { service, roomModel, memberModel } = build();
    const room = fakeRoom();
    roomModel.create.mockResolvedValue(room);
    memberModel.create.mockRejectedValue(new Error('mongo down'));

    await expect(service.createRoom(userId, { name: 'X' })).rejects.toThrow('mongo down');
    expect(roomModel.deleteOne).toHaveBeenCalledWith({ _id: room._id });
  });
});

describe('generateJoinCode — độ ngẫu nhiên', () => {
  it('dùng crypto, không dùng Math.random (đoán được)', () => {
    const spy = vi.spyOn(Math, 'random');
    generateJoinCode();
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('2000 mã: đủ cả 32 ký tự (không lệch 1 ở randomInt), không ký tự lạ, không trùng', () => {
    const codes = Array.from({ length: 2000 }, generateJoinCode);
    const chars = new Set(codes.join(''));
    expect([...chars].sort().join('')).toBe('234567ABCDEFGHIJKLMNOPQRSTUVWXYZ');
    expect(new Set(codes).size).toBe(codes.length);
  });
});

describe('createRoom — case lạ', () => {
  it('dto lọt field lạ (ownerId, joinCode, memberCount, status) → service bỏ qua', async () => {
    const { service, roomModel, memberModel } = build();
    roomModel.create.mockResolvedValue(fakeRoom());
    const dto = {
      name: 'Nhóm Toán',
      ownerId: new Types.ObjectId().toString(),
      joinCode: 'AAAAAAAA',
      memberCount: 999,
      status: RoomStatus.DISSOLVED,
    } as any;

    await service.createRoom(userId, dto);

    const saved = roomModel.create.mock.calls[0][0];
    expect(Object.keys(saved).sort()).toEqual(['description', 'joinCode', 'memberCount', 'name', 'ownerId']);
    expect(saved).toMatchObject({ ownerId: userId, memberCount: 1 });
    expect(saved.joinCode).not.toBe('AAAAAAAA');
    expect(memberModel.create).toHaveBeenCalledWith(expect.objectContaining({ userId, role: RoomRole.HOST }));
  });

  it('response chỉ có đúng 9 field, không lộ __v / deletedAt / meetingCount / updatedAt', async () => {
    const { service, roomModel } = build();
    roomModel.create.mockResolvedValue(
      fakeRoom({ __v: 0, deletedAt: null, dissolvedAt: null, meetingCount: 0, updatedAt: new Date() }),
    );

    const res = await service.createRoom(userId, { name: 'Nhóm Toán' });

    expect(Object.keys(res).sort()).toEqual([
      'createdAt', 'description', 'id', 'joinCode', 'memberCount', 'myRole', 'name', 'ownerId', 'status',
    ]);
    expect(typeof res.id).toBe('string');
    expect(typeof res.ownerId).toBe('string');
  });

  it('description null (IsOptional cho qua) → lưu chuỗi rỗng', async () => {
    const { service, roomModel } = build();
    roomModel.create.mockResolvedValue(fakeRoom());

    await service.createRoom(userId, { name: 'X', description: null } as any);

    expect(roomModel.create.mock.calls[0][0].description).toBe('');
  });

  it('lỗi Mongo khác duplicate key → không thử lại, không tạo member', async () => {
    const { service, roomModel, memberModel } = build();
    roomModel.create.mockRejectedValue(new Error('mongo down'));

    await expect(service.createRoom(userId, { name: 'X' })).rejects.toThrow('mongo down');
    expect(roomModel.create).toHaveBeenCalledTimes(1);
    expect(memberModel.create).not.toHaveBeenCalled();
  });

  it('mỗi lần thử lại dùng một mã mới', async () => {
    const { service, roomModel } = build();
    roomModel.create.mockRejectedValue(duplicateKeyError());

    await service.createRoom(userId, { name: 'X' }).catch(() => undefined);

    const codes = roomModel.create.mock.calls.map((c: any[]) => c[0].joinCode);
    expect(new Set(codes).size).toBe(5);
  });

  it('tạo member lỗi duplicate key → rollback, không hiểu nhầm là trùng joinCode', async () => {
    const { service, roomModel, memberModel } = build();
    roomModel.create.mockResolvedValue(fakeRoom());
    memberModel.create.mockRejectedValue(duplicateKeyError());

    await expect(service.createRoom(userId, { name: 'X' })).rejects.toMatchObject({ code: 11000 });
    expect(roomModel.create).toHaveBeenCalledTimes(1);
    expect(roomModel.deleteOne).toHaveBeenCalledTimes(1);
  });

  it('rollback xoá room cũng lỗi → vẫn ném lỗi gốc, ghi log roomId mồ côi', async () => {
    const { service, roomModel, memberModel } = build();
    roomModel.create.mockResolvedValue(fakeRoom());
    memberModel.create.mockRejectedValue(new Error('mongo down'));
    roomModel.deleteOne.mockReturnValue({ exec: vi.fn().mockRejectedValue(new Error('delete failed')) });
    const log = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

    await expect(service.createRoom(userId, { name: 'X' })).rejects.toThrow('mongo down');
    expect(log).toHaveBeenCalledWith(expect.stringContaining(roomId));
    log.mockRestore();
  });
});
