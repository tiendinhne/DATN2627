import { describe, it, expect, vi } from 'vitest';
import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
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

describe('joinRoom', () => {
  it('mã sai hoặc phòng đã giải tán → 404 (query chỉ tìm room ACTIVE)', async () => {
    const { service, roomModel } = build();

    await expect(service.joinRoom(userId, 'ABCDEFGH')).rejects.toBeInstanceOf(NotFoundException);
    expect(roomModel.findOne).toHaveBeenCalledWith({
      joinCode: 'ABCDEFGH',
      status: RoomStatus.ACTIVE,
      deletedAt: null,
    });
  });

  it('thành viên mới → thêm MEMBER, tăng memberCount', async () => {
    const { service, roomModel, memberModel } = build();
    const room = fakeRoom();
    roomModel.findOne.mockReturnValue(query(room));

    const res = await service.joinRoom(userId, 'ABCDEFGH');

    expect(memberModel.create).toHaveBeenCalledWith({ roomId: room._id, userId, role: RoomRole.MEMBER });
    expect(roomModel.updateOne).toHaveBeenCalledWith({ _id: room._id }, { $inc: { memberCount: 1 } });
    expect(res).toMatchObject({ id: roomId, myRole: RoomRole.MEMBER, memberCount: 2 });
  });

  it('đã là thành viên → trả room với role hiện có, không tăng memberCount', async () => {
    const { service, roomModel, memberModel } = build();
    roomModel.findOne.mockReturnValue(query(fakeRoom()));
    memberModel.create.mockRejectedValue(duplicateKeyError());
    memberModel.findOne.mockReturnValue(query({ role: RoomRole.HOST }));

    const res = await service.joinRoom(userId, 'ABCDEFGH');

    expect(res.myRole).toBe(RoomRole.HOST);
    expect(roomModel.updateOne).not.toHaveBeenCalled();
  });

  it('lần thử đầu trong cửa sổ → đặt hạn 60s cho key rate limit', async () => {
    const { service, roomModel, redis } = build();
    roomModel.findOne.mockReturnValue(query(fakeRoom()));

    await service.joinRoom(userId, 'ABCDEFGH');

    expect(redis.incr).toHaveBeenCalledWith(`ratelimit:join:${userId}`);
    expect(redis.expire).toHaveBeenCalledWith(`ratelimit:join:${userId}`, 60);
  });

  it('quá 10 lần/phút → 429, không query room', async () => {
    const { service, roomModel, redis } = build();
    redis.incr.mockResolvedValue(11);

    const err = await service.joinRoom(userId, 'ABCDEFGH').catch((e) => e);

    expect(err).toBeInstanceOf(HttpException);
    expect(err.getStatus()).toBe(429);
    expect(roomModel.findOne).not.toHaveBeenCalled();
  });
});

describe('listMyRooms', () => {
  it('lọc theo userId dạng ObjectId, lấy dư 1 bản ghi để biết còn trang sau', async () => {
    const { service, memberModel } = build();
    const rows = [1, 2, 3].map(() => ({
      role: RoomRole.MEMBER,
      room: fakeRoom({ _id: new Types.ObjectId() }),
    }));
    memberModel.aggregate.mockReturnValue(query(rows));

    const res = await service.listMyRooms(userId, 2, 2);

    const pipeline = memberModel.aggregate.mock.calls[0][0];
    expect(pipeline[0]).toEqual({ $match: { userId: new Types.ObjectId(userId) } });
    expect(pipeline).toContainEqual({ $match: { 'room.status': RoomStatus.ACTIVE, 'room.deletedAt': null } });
    expect(pipeline).toContainEqual({ $skip: 2 });
    expect(pipeline).toContainEqual({ $limit: 3 });
    expect(res).toMatchObject({ page: 2, limit: 2, hasMore: true });
    expect(res.items).toHaveLength(2);
    expect(res.items[0].myRole).toBe(RoomRole.MEMBER);
  });

  it('trang cuối → hasMore false', async () => {
    const { service, memberModel } = build();
    memberModel.aggregate.mockReturnValue(query([{ role: RoomRole.HOST, room: fakeRoom() }]));

    const res = await service.listMyRooms(userId, 1, 20);

    expect(res.hasMore).toBe(false);
    expect(res.items[0]).toMatchObject({ id: roomId, myRole: RoomRole.HOST });
  });
});

describe('getRoom', () => {
  it('trả room kèm role của người gọi', async () => {
    const { service, roomModel, access } = build();
    roomModel.findById.mockReturnValue(query(fakeRoom()));

    const res = await service.getRoom(userId, roomId);

    expect(access.assertRoomAccess).toHaveBeenCalledWith(userId, roomId);
    expect(res).toMatchObject({ id: roomId, myRole: RoomRole.MEMBER, joinCode: 'ABCDEFGH' });
  });
});

describe('updateRoom', () => {
  it('không có quyền → 403, không ghi DB', async () => {
    const { service, roomModel, access } = build();
    access.assertRoomPermission.mockRejectedValue(new ForbiddenException());

    await expect(service.updateRoom(userId, roomId, { name: 'Mới' })).rejects.toBeInstanceOf(ForbiddenException);
    expect(roomModel.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('body không có field nào → 400', async () => {
    const { service } = build();
    await expect(service.updateRoom(userId, roomId, {})).rejects.toBeInstanceOf(BadRequestException);
  });

  it('chỉ $set field được gửi, trả room đã sửa', async () => {
    const { service, roomModel } = build();
    roomModel.findOneAndUpdate.mockReturnValue(query(fakeRoom({ name: 'Mới' })));

    const res = await service.updateRoom(userId, roomId, { name: 'Mới', description: undefined });

    expect(roomModel.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: roomId, status: RoomStatus.ACTIVE },
      { $set: { name: 'Mới' } },
      { returnDocument: 'after' },
    );
    expect(res).toMatchObject({ name: 'Mới', myRole: RoomRole.HOST });
  });
});

describe('listMembers', () => {
  it('HOST đứng đầu, map userId/displayName, bỏ bản ghi có user đã bị xoá', async () => {
    const { service, memberModel } = build();
    const joinedAt = new Date('2026-09-26T00:00:00Z');
    const hostUser = { _id: new Types.ObjectId(userId), displayName: 'Chủ phòng', avatarUrl: null };
    const find = query([
      { userId: hostUser, role: RoomRole.HOST, joinedAt },
      { userId: null, role: RoomRole.MEMBER, joinedAt },
    ]);
    memberModel.find.mockReturnValue(find);

    const res = await service.listMembers(userId, roomId);

    expect(memberModel.find).toHaveBeenCalledWith({ roomId });
    expect(find.sort).toHaveBeenCalledWith({ role: 1, joinedAt: 1 });
    expect(find.populate).toHaveBeenCalledWith('userId', 'displayName avatarUrl');
    expect(res).toEqual([
      { userId, displayName: 'Chủ phòng', avatarUrl: null, role: RoomRole.HOST, joinedAt },
    ]);
  });
});

describe('kickMember', () => {
  const targetId = new Types.ObjectId().toString();

  it('userId sai định dạng → 400, không kiểm quyền', async () => {
    const { service, access } = build();
    await expect(service.kickMember(userId, roomId, 'abc')).rejects.toBeInstanceOf(BadRequestException);
    expect(access.assertRoomPermission).not.toHaveBeenCalled();
  });

  it('MEMBER gọi → 403, không xoá', async () => {
    const { service, access, memberModel } = build();
    access.assertRoomPermission.mockRejectedValue(new ForbiddenException());

    await expect(service.kickMember(userId, roomId, targetId)).rejects.toBeInstanceOf(ForbiddenException);
    expect(memberModel.deleteOne).not.toHaveBeenCalled();
  });

  it('tự kick chính mình (HOST) → 400', async () => {
    const { service, memberModel } = build();
    await expect(service.kickMember(userId, roomId, userId)).rejects.toBeInstanceOf(BadRequestException);
    expect(memberModel.deleteOne).not.toHaveBeenCalled();
  });

  // ObjectId.isValid nhận hex viết hoa, Mongoose ép về cùng ObjectId → phải chặn như tự kick
  it('tự kick bằng id viết hoa → 400, không xoá', async () => {
    const { service, memberModel } = build();
    await expect(service.kickMember(userId, roomId, userId.toUpperCase())).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(memberModel.deleteOne).not.toHaveBeenCalled();
  });

  it('người không có trong phòng → 404, không giảm memberCount', async () => {
    const { service, memberModel, roomModel } = build();
    memberModel.deleteOne.mockReturnValue(query({ deletedCount: 0 }));

    await expect(service.kickMember(userId, roomId, targetId)).rejects.toBeInstanceOf(NotFoundException);
    expect(roomModel.updateOne).not.toHaveBeenCalled();
  });

  it('kick thành công → xoá bản ghi, giảm memberCount 1', async () => {
    const { service, memberModel, roomModel, access } = build();

    await service.kickMember(userId, roomId, targetId);

    expect(access.assertRoomPermission).toHaveBeenCalledWith(userId, roomId, 'KICK_MEMBER');
    expect(memberModel.deleteOne).toHaveBeenCalledWith({ roomId, userId: targetId });
    expect(roomModel.updateOne).toHaveBeenCalledWith({ _id: roomId }, { $inc: { memberCount: -1 } });
  });
});

describe('leaveRoom', () => {
  it('HOST → 400, không xoá', async () => {
    const { service, access, memberModel } = build();
    access.assertRoomAccess.mockResolvedValue({ role: RoomRole.HOST });

    await expect(service.leaveRoom(userId, roomId)).rejects.toBeInstanceOf(BadRequestException);
    expect(memberModel.deleteOne).not.toHaveBeenCalled();
  });

  it('MEMBER → xoá bản ghi của mình, giảm memberCount 1', async () => {
    const { service, memberModel, roomModel } = build();

    await service.leaveRoom(userId, roomId);

    expect(memberModel.deleteOne).toHaveBeenCalledWith({ roomId, userId });
    expect(roomModel.updateOne).toHaveBeenCalledWith({ _id: roomId }, { $inc: { memberCount: -1 } });
  });
});
