import { describe, it, expect, vi } from 'vitest';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { RoomAccessService } from './room-access.service.js';
import { MeetingStatus, RoomStatus } from '../../shared/enums.js';

// Giả lập chuỗi Mongoose: model.findOne(filter).lean().exec() → result
function mockModel(result: unknown) {
  const exec = vi.fn().mockResolvedValue(result);
  const findOne = vi.fn().mockReturnValue({ lean: () => ({ exec }) });
  return { findOne };
}

function mockRedis(isMember: boolean) {
  return { sismember: vi.fn().mockResolvedValue(isMember) };
}

const userId = new Types.ObjectId().toString();
const roomId = new Types.ObjectId().toString();
const meetingId = new Types.ObjectId().toString();

function build(opts: { room?: unknown; member?: unknown; meeting?: unknown; online?: boolean }) {
  const roomModel = mockModel(opts.room ?? null);
  const memberModel = mockModel(opts.member ?? null);
  const meetingModel = mockModel(opts.meeting ?? null);
  const redis = mockRedis(opts.online ?? false);
  const service = new RoomAccessService(
    roomModel as any,
    memberModel as any,
    meetingModel as any,
    redis as any,
  );
  return { service, roomModel, memberModel, meetingModel, redis };
}

describe('assertRoomAccess', () => {
  it('roomId sai định dạng → 400, không query DB', async () => {
    const { service, roomModel } = build({});
    await expect(service.assertRoomAccess(userId, 'abc')).rejects.toBeInstanceOf(BadRequestException);
    expect(roomModel.findOne).not.toHaveBeenCalled();
  });

  it('room không tồn tại / DISSOLVED / đã xoá → 404 (lọc ngay trong query)', async () => {
    const { service, roomModel } = build({ room: null });
    await expect(service.assertRoomAccess(userId, roomId)).rejects.toBeInstanceOf(NotFoundException);
    expect(roomModel.findOne).toHaveBeenCalledWith({
      _id: roomId,
      status: RoomStatus.ACTIVE,
      deletedAt: null,
    });
  });

  it('không phải thành viên hoặc bị ban → 403 (lọc ngay trong query)', async () => {
    const { service, memberModel } = build({ room: { _id: roomId }, member: null });
    await expect(service.assertRoomAccess(userId, roomId)).rejects.toBeInstanceOf(ForbiddenException);
    expect(memberModel.findOne).toHaveBeenCalledWith({ roomId, userId, isBanned: false });
  });

  it('hợp lệ → trả về membership', async () => {
    const member = { roomId, userId, role: 'MEMBER' };
    const { service } = build({ room: { _id: roomId }, member });
    await expect(service.assertRoomAccess(userId, roomId)).resolves.toEqual(member);
  });
});

describe('assertMeetingTag', () => {
  it('roomId sai định dạng → 400', async () => {
    const { service, meetingModel } = build({});
    await expect(service.assertMeetingTag(userId, 'abc', meetingId)).rejects.toBeInstanceOf(BadRequestException);
    expect(meetingModel.findOne).not.toHaveBeenCalled();
  });

  it('meetingId sai định dạng → 400', async () => {
    const { service, meetingModel } = build({});
    await expect(service.assertMeetingTag(userId, roomId, 'xyz')).rejects.toBeInstanceOf(BadRequestException);
    expect(meetingModel.findOne).not.toHaveBeenCalled();
  });

  it('meeting không tồn tại / ENDED / thuộc room khác → 403 (lọc ngay trong query)', async () => {
    const { service, meetingModel, redis } = build({ meeting: null });
    await expect(service.assertMeetingTag(userId, roomId, meetingId)).rejects.toBeInstanceOf(ForbiddenException);
    expect(meetingModel.findOne).toHaveBeenCalledWith({
      _id: meetingId,
      roomId,
      status: MeetingStatus.ACTIVE,
    });
    expect(redis.sismember).not.toHaveBeenCalled();
  });

  it('user không có trong presence của meeting → 403', async () => {
    const { service, redis } = build({ meeting: { _id: meetingId }, online: false });
    await expect(service.assertMeetingTag(userId, roomId, meetingId)).rejects.toBeInstanceOf(ForbiddenException);
    expect(redis.sismember).toHaveBeenCalledWith(`presence:${meetingId}`, userId);
  });

  it('hợp lệ → không ném lỗi', async () => {
    const { service } = build({ meeting: { _id: meetingId }, online: true });
    await expect(service.assertMeetingTag(userId, roomId, meetingId)).resolves.toBeUndefined();
  });
});
