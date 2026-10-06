import { describe, it, expect, vi } from 'vitest';
import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Types } from 'mongoose';
import { MeetingsService } from './meetings.service.js';
import { EndReason, MeetingStatus, RoomRole, RoomStatus } from '../../shared/enums.js';

// Query Mongoose giả: lean/sort/skip/limit/select nối chuỗi, exec() trả result
function query(result: unknown) {
  const chain: any = {
    lean: vi.fn(() => chain),
    sort: vi.fn(() => chain),
    skip: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    select: vi.fn(() => chain),
    exec: vi.fn().mockResolvedValue(result),
  };
  return chain;
}

// Query giả mà exec() lỗi — giả Mongo sập / lỗi trùng
function failingQuery(err: Error) {
  const chain: any = query(null);
  chain.exec = vi.fn().mockRejectedValue(err);
  return chain;
}

// vi.fn trả về query giả; nhận mọi tham số để test đọc lại bằng mock.calls
const q = (result: unknown) => vi.fn((..._args: any[]) => query(result));

const userId = new Types.ObjectId().toString();
const roomId = new Types.ObjectId().toString();
const meetingId = new Types.ObjectId().toString();

function fakeMeeting(overrides: Record<string, unknown> = {}) {
  return {
    _id: new Types.ObjectId(meetingId),
    roomId: new Types.ObjectId(roomId),
    title: 'Buổi học 05/10 14:00',
    status: MeetingStatus.ACTIVE,
    createdBy: new Types.ObjectId(userId),
    startedAt: new Date('2026-10-05T07:00:00Z'),
    endedAt: null,
    endedBy: null,
    endReason: null,
    peakParticipants: 0,
    totalParticipants: 0,
    messageCount: 0,
    durationSeconds: 0,
    ...overrides,
  };
}

function build() {
  const meetingModel = {
    create: vi.fn(),
    findOne: q(null),
    findById: q(null),
    find: q([]),
    updateOne: q({ modifiedCount: 1 }),
  };
  const participantModel = {
    find: q([]),
    updateOne: q({ modifiedCount: 1 }),
    updateMany: q({ modifiedCount: 0 }),
    exists: q(null),
  };
  // Mặc định phòng còn ACTIVE → hệ thống tự kết thúc với AUTO_EMPTY
  const roomModel = {
    findById: q({ status: RoomStatus.ACTIVE }),
    updateOne: q({ modifiedCount: 1 }),
  };
  // Mặc định: là thành viên thường, và có quyền HOST khi hỏi assertRoomPermission
  const access = {
    assertRoomAccess: vi.fn().mockResolvedValue({ role: RoomRole.MEMBER }),
    assertRoomPermission: vi.fn().mockResolvedValue({ role: RoomRole.HOST }),
  };
  const redis = {
    sadd: vi.fn().mockResolvedValue(1),
    srem: vi.fn().mockResolvedValue(1),
    scard: vi.fn().mockResolvedValue(1),
    expire: vi.fn().mockResolvedValue(true),
    del: vi.fn().mockResolvedValue(1),
  };
  // MediaPort giả — không cần LiveKit thật. Mặc định room LiveKit còn tồn tại
  const media = {
    createRoom: vi.fn().mockResolvedValue(undefined),
    roomExists: vi.fn().mockResolvedValue(true),
    closeRoom: vi.fn().mockResolvedValue(undefined),
    removeParticipant: vi.fn().mockResolvedValue(undefined),
    createJoinToken: vi.fn().mockResolvedValue({ token: 'lk-token', url: 'ws://localhost:7880' }),
    parseWebhook: vi.fn(),
  };
  const service = new MeetingsService(
    meetingModel as any,
    participantModel as any,
    roomModel as any,
    access as any,
    redis as any,
    media as any,
  );
  return { service, meetingModel, participantModel, roomModel, access, redis, media };
}

// Lỗi trùng unique index của Mongo
const duplicateKeyError = () => Object.assign(new Error('E11000 duplicate key'), { code: 11000 });

describe('startMeeting', () => {
  const dto = { title: 'Buổi học 05/10 14:00' };

  it('không phải HOST → 403, không gọi LiveKit', async () => {
    const { service, access, media } = build();
    access.assertRoomPermission.mockRejectedValue(new ForbiddenException());

    await expect(service.startMeeting(userId, roomId, dto)).rejects.toBeInstanceOf(ForbiddenException);
    expect(media.createRoom).not.toHaveBeenCalled();
  });

  it('đang có meeting ACTIVE và room LiveKit còn → 409, không tạo mới', async () => {
    const { service, meetingModel, media } = build();
    meetingModel.findOne.mockReturnValue(query(fakeMeeting()));

    await expect(service.startMeeting(userId, roomId, dto)).rejects.toBeInstanceOf(ConflictException);
    expect(media.roomExists).toHaveBeenCalledWith(meetingId);
    expect(media.createRoom).not.toHaveBeenCalled();
    expect(meetingModel.create).not.toHaveBeenCalled();
  });

  it('meeting ACTIVE nhưng room LiveKit đã đóng (mất room_finished) → chốt AUTO_EMPTY rồi tạo mới', async () => {
    const { service, meetingModel, media } = build();
    const old = fakeMeeting();
    meetingModel.findOne.mockReturnValue(query(old));
    meetingModel.findById.mockReturnValue(query(old));
    media.roomExists.mockResolvedValue(false);
    meetingModel.create.mockResolvedValue(fakeMeeting({ _id: new Types.ObjectId() }));

    await service.startMeeting(userId, roomId, dto);

    expect(meetingModel.updateOne).toHaveBeenCalledWith(
      { _id: meetingId, status: MeetingStatus.ACTIVE },
      { $set: expect.objectContaining({ status: MeetingStatus.ENDED, endReason: EndReason.AUTO_EMPTY }) },
    );
    expect(meetingModel.create).toHaveBeenCalled();
  });

  it('không hỏi được LiveKit → 502, không chốt meeting cũ, không tạo mới', async () => {
    const { service, meetingModel, media } = build();
    meetingModel.findOne.mockReturnValue(query(fakeMeeting()));
    media.roomExists.mockRejectedValue(new Error('fetch failed'));

    await expect(service.startMeeting(userId, roomId, dto)).rejects.toBeInstanceOf(BadGatewayException);
    expect(meetingModel.updateOne).not.toHaveBeenCalled();
    expect(media.createRoom).not.toHaveBeenCalled();
    expect(meetingModel.create).not.toHaveBeenCalled();
  });

  it('tạo room LiveKit TRƯỚC rồi mới ghi Mongo, cùng một id', async () => {
    const { service, meetingModel, media } = build();
    meetingModel.create.mockResolvedValue(fakeMeeting());

    await service.startMeeting(userId, roomId, dto);

    const roomName = media.createRoom.mock.calls[0][0];
    expect(String(meetingModel.create.mock.calls[0][0]._id)).toBe(roomName);
    expect(meetingModel.create).toHaveBeenCalledWith(
      expect.objectContaining({ roomId, title: dto.title, createdBy: userId }),
    );
    expect(media.createRoom.mock.invocationCallOrder[0]).toBeLessThan(meetingModel.create.mock.invocationCallOrder[0]);
  });

  it('createRoom lỗi → 502, Mongo chưa ghi gì', async () => {
    const { service, meetingModel, media } = build();
    media.createRoom.mockRejectedValue(new Error('fetch failed'));

    await expect(service.startMeeting(userId, roomId, dto)).rejects.toBeInstanceOf(BadGatewayException);
    expect(meetingModel.create).not.toHaveBeenCalled();
  });

  it('Mongo báo trùng (bấm 2 lần) → đóng room LiveKit vừa tạo, 409', async () => {
    const { service, meetingModel, roomModel, media } = build();
    meetingModel.create.mockRejectedValue(duplicateKeyError());

    await expect(service.startMeeting(userId, roomId, dto)).rejects.toBeInstanceOf(ConflictException);
    expect(media.closeRoom).toHaveBeenCalledWith(media.createRoom.mock.calls[0][0]);
    expect(roomModel.updateOne).not.toHaveBeenCalled();
  });

  it('thành công → kiểm quyền MANAGE_MEETING, $inc meetingCount, response có id không có _id', async () => {
    const { service, meetingModel, roomModel, access } = build();
    const created = fakeMeeting();
    meetingModel.create.mockResolvedValue(created);

    const res = await service.startMeeting(userId, roomId, dto);

    expect(access.assertRoomPermission).toHaveBeenCalledWith(userId, roomId, 'MANAGE_MEETING');
    expect(roomModel.updateOne).toHaveBeenCalledWith({ _id: roomId }, { $inc: { meetingCount: 1 } });
    expect(res).toMatchObject({ id: meetingId, roomId, title: created.title, status: MeetingStatus.ACTIVE });
    expect(res).not.toHaveProperty('_id');
  });
});

describe('listMeetings', () => {
  it('không phải thành viên → 403', async () => {
    const { service, access } = build();
    access.assertRoomAccess.mockRejectedValue(new ForbiddenException());

    await expect(service.listMeetings(userId, roomId, 1, 20)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('mới nhất trước, lấy dư 1 bản ghi để biết còn trang sau', async () => {
    const { service, meetingModel } = build();
    const rows = [fakeMeeting(), fakeMeeting({ _id: new Types.ObjectId() }), fakeMeeting({ _id: new Types.ObjectId() })];
    const chain = query(rows);
    meetingModel.find.mockReturnValue(chain);

    const res = await service.listMeetings(userId, roomId, 2, 2);

    expect(meetingModel.find).toHaveBeenCalledWith({ roomId });
    expect(chain.sort).toHaveBeenCalledWith({ startedAt: -1 });
    expect(chain.skip).toHaveBeenCalledWith(2);
    expect(chain.limit).toHaveBeenCalledWith(3);
    expect(res.items).toHaveLength(2);
    expect(res).toMatchObject({ page: 2, limit: 2, hasMore: true });
  });
});

describe('endMeeting', () => {
  const startedAt = new Date('2026-10-05T07:00:00Z');
  const endedAt = new Date('2026-10-05T07:30:00Z');

  it('ACTIVE → ENDED bằng update có điều kiện, rồi tính lại thống kê từ dữ liệu', async () => {
    const { service, meetingModel, participantModel, redis } = build();
    meetingModel.findById
      .mockReturnValueOnce(query(fakeMeeting({ startedAt })))
      .mockReturnValueOnce(query(fakeMeeting({ startedAt, status: MeetingStatus.ENDED, endedAt })));
    const pId = new Types.ObjectId();
    participantModel.find.mockReturnValue(
      query([
        {
          _id: pId,
          sessions: [
            { sid: 'PA_1', joinedAt: new Date('2026-10-05T07:00:00Z'), leftAt: new Date('2026-10-05T07:10:00Z') },
            { sid: 'PA_2', joinedAt: new Date('2026-10-05T07:20:00Z'), leftAt: null },
          ],
        },
      ]),
    );

    await service.endMeeting(meetingId, EndReason.HOST_ENDED, endedAt, userId);

    expect(meetingModel.updateOne).toHaveBeenCalledWith(
      { _id: meetingId, status: MeetingStatus.ACTIVE },
      { $set: { status: MeetingStatus.ENDED, endedAt, endedBy: userId, endReason: EndReason.HOST_ENDED } },
    );
    // Session còn mở đóng bằng endedAt — atomic, không đè leftAt thật
    expect(participantModel.updateMany).toHaveBeenCalledWith(
      { meetingId },
      { $set: { 'sessions.$[s].leftAt': endedAt } },
      { arrayFilters: [{ 's.leftAt': null }] },
    );
    // 10 phút + 10 phút (session 2 tính tới endedAt)
    expect(participantModel.updateOne).toHaveBeenCalledWith({ _id: pId }, { $set: { totalDurationSeconds: 1200 } });
    expect(meetingModel.updateOne).toHaveBeenCalledWith(
      { _id: meetingId },
      { $set: { totalParticipants: 1, durationSeconds: 1800 } },
    );
    expect(redis.del).toHaveBeenCalledWith(`presence:${meetingId}`);
  });

  it('endedAt sớm hơn startedAt → lấy startedAt', async () => {
    const { service, meetingModel } = build();
    meetingModel.findById.mockReturnValue(query(fakeMeeting({ startedAt })));

    await service.endMeeting(meetingId, EndReason.AUTO_EMPTY, new Date('2026-10-05T06:58:00Z'));

    expect(meetingModel.updateOne).toHaveBeenCalledWith(
      { _id: meetingId, status: MeetingStatus.ACTIVE },
      { $set: expect.objectContaining({ endedAt: startedAt, endedBy: null }) },
    );
  });

  it('meeting đã ENDED → update có điều kiện không ghi đè, nhưng finalize vẫn chạy lại', async () => {
    const { service, meetingModel, redis } = build();
    meetingModel.findById.mockReturnValue(query(fakeMeeting({ startedAt, status: MeetingStatus.ENDED, endedAt })));

    await service.endMeeting(meetingId, EndReason.AUTO_EMPTY, new Date('2026-10-05T08:00:00Z'));

    expect(meetingModel.updateOne).toHaveBeenCalledWith(
      { _id: meetingId, status: MeetingStatus.ACTIVE },
      expect.anything(),
    );
    expect(meetingModel.updateOne).toHaveBeenCalledWith(
      { _id: meetingId },
      { $set: { totalParticipants: 0, durationSeconds: 1800 } },
    );
    expect(redis.del).toHaveBeenCalledWith(`presence:${meetingId}`);
  });

  it('session vào sau lúc kết thúc (chạy song song với HOST kết thúc) → thời lượng 0, không âm', async () => {
    const { service, meetingModel, participantModel } = build();
    meetingModel.findById.mockReturnValue(query(fakeMeeting({ startedAt, status: MeetingStatus.ENDED, endedAt })));
    const pId = new Types.ObjectId();
    participantModel.find.mockReturnValue(
      query([{ _id: pId, sessions: [{ sid: 'PA_9', joinedAt: new Date('2026-10-05T07:30:05Z'), leftAt: null }] }]),
    );

    await service.endMeeting(meetingId, EndReason.HOST_ENDED, endedAt);

    expect(participantModel.updateOne).toHaveBeenCalledWith({ _id: pId }, { $set: { totalDurationSeconds: 0 } });
  });

  it('không có meeting → không ghi gì', async () => {
    const { service, meetingModel, redis } = build();

    await service.endMeeting(meetingId, EndReason.HOST_ENDED, endedAt);

    expect(meetingModel.updateOne).not.toHaveBeenCalled();
    expect(redis.del).not.toHaveBeenCalled();
  });
});

describe('joinMeeting', () => {
  it('meetingId sai định dạng → 400', async () => {
    const { service } = build();
    await expect(service.joinMeeting(userId, 'An', 'abc')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('không có meeting → 404', async () => {
    const { service } = build();
    await expect(service.joinMeeting(userId, 'An', meetingId)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('không phải thành viên phòng của meeting → 403, không cấp token', async () => {
    const { service, meetingModel, access, media } = build();
    meetingModel.findById.mockReturnValue(query(fakeMeeting()));
    access.assertRoomAccess.mockRejectedValue(new ForbiddenException());

    await expect(service.joinMeeting(userId, 'An', meetingId)).rejects.toBeInstanceOf(ForbiddenException);
    expect(access.assertRoomAccess).toHaveBeenCalledWith(userId, roomId);
    expect(media.createJoinToken).not.toHaveBeenCalled();
  });

  it('meeting đã ENDED → 409, không hỏi LiveKit', async () => {
    const { service, meetingModel, media } = build();
    meetingModel.findById.mockReturnValue(query(fakeMeeting({ status: MeetingStatus.ENDED })));

    await expect(service.joinMeeting(userId, 'An', meetingId)).rejects.toBeInstanceOf(ConflictException);
    expect(media.roomExists).not.toHaveBeenCalled();
    expect(media.createJoinToken).not.toHaveBeenCalled();
  });

  it('room LiveKit không còn (mất room_finished) → chốt meeting rồi 409', async () => {
    const { service, meetingModel, media } = build();
    meetingModel.findById.mockReturnValue(query(fakeMeeting()));
    media.roomExists.mockResolvedValue(false);

    await expect(service.joinMeeting(userId, 'An', meetingId)).rejects.toBeInstanceOf(ConflictException);
    expect(meetingModel.updateOne).toHaveBeenCalledWith(
      { _id: meetingId, status: MeetingStatus.ACTIVE },
      { $set: expect.objectContaining({ endReason: EndReason.AUTO_EMPTY }) },
    );
    expect(media.createJoinToken).not.toHaveBeenCalled();
  });

  it('không hỏi được LiveKit → 502, không chốt meeting', async () => {
    const { service, meetingModel, media } = build();
    meetingModel.findById.mockReturnValue(query(fakeMeeting()));
    media.roomExists.mockRejectedValue(new Error('fetch failed'));

    await expect(service.joinMeeting(userId, 'An', meetingId)).rejects.toBeInstanceOf(BadGatewayException);
    expect(meetingModel.updateOne).not.toHaveBeenCalled();
  });

  it('thành công → token đúng room / identity / tên, trả myRole + meeting', async () => {
    const { service, meetingModel, media } = build();
    meetingModel.findById.mockReturnValue(query(fakeMeeting()));

    const res = await service.joinMeeting(userId, 'An', meetingId);

    expect(media.createJoinToken).toHaveBeenCalledWith({ roomName: meetingId, userId, displayName: 'An' });
    expect(res).toMatchObject({
      token: 'lk-token',
      livekitUrl: 'ws://localhost:7880',
      myRole: RoomRole.MEMBER,
      meeting: { id: meetingId, status: MeetingStatus.ACTIVE },
    });
  });
});

describe('endByHost', () => {
  it('không phải HOST → 403, không chốt, không đóng room', async () => {
    const { service, meetingModel, access, media } = build();
    meetingModel.findById.mockReturnValue(query(fakeMeeting()));
    access.assertRoomPermission.mockRejectedValue(new ForbiddenException());

    await expect(service.endByHost(userId, meetingId)).rejects.toBeInstanceOf(ForbiddenException);
    expect(meetingModel.updateOne).not.toHaveBeenCalled();
    expect(media.closeRoom).not.toHaveBeenCalled();
  });

  it('HOST → chốt HOST_ENDED kèm endedBy, rồi mới đóng room LiveKit', async () => {
    const { service, meetingModel, access, media } = build();
    meetingModel.findById.mockReturnValue(query(fakeMeeting()));

    await service.endByHost(userId, meetingId);

    expect(access.assertRoomPermission).toHaveBeenCalledWith(userId, roomId, 'MANAGE_MEETING');
    expect(meetingModel.updateOne).toHaveBeenCalledWith(
      { _id: meetingId, status: MeetingStatus.ACTIVE },
      { $set: expect.objectContaining({ endReason: EndReason.HOST_ENDED, endedBy: userId }) },
    );
    expect(media.closeRoom).toHaveBeenCalledWith(meetingId);
    expect(meetingModel.updateOne.mock.invocationCallOrder[0]).toBeLessThan(media.closeRoom.mock.invocationCallOrder[0]);
  });

  it('meeting đã ENDED → vẫn đóng room, không lỗi (idempotent — lối thoát khi meeting kẹt)', async () => {
    const { service, meetingModel, media } = build();
    meetingModel.findById.mockReturnValue(
      query(fakeMeeting({ status: MeetingStatus.ENDED, endedAt: new Date('2026-10-05T07:30:00Z') })),
    );

    await expect(service.endByHost(userId, meetingId)).resolves.toBeUndefined();
    expect(media.closeRoom).toHaveBeenCalledWith(meetingId);
  });

  it('closeRoom lỗi → 502 để HOST bấm lại', async () => {
    const { service, meetingModel, media } = build();
    meetingModel.findById.mockReturnValue(query(fakeMeeting()));
    media.closeRoom.mockRejectedValue(new Error('fetch failed'));

    await expect(service.endByHost(userId, meetingId)).rejects.toBeInstanceOf(BadGatewayException);
  });
});

describe('handleMediaEvent', () => {
  const sid = 'PA_abc';
  const joinedAt = new Date('2026-10-05T07:05:00Z');
  const leftAt = new Date('2026-10-05T07:15:00Z');
  const joined = (overrides: Record<string, unknown> = {}) => ({
    type: 'participant_joined' as const,
    eventId: 'EV_1',
    roomName: meetingId,
    userId,
    displayName: 'An',
    sid,
    at: joinedAt,
    ...overrides,
  });
  const left = (overrides: Record<string, unknown> = {}) => ({
    type: 'participant_left' as const,
    eventId: 'EV_2',
    roomName: meetingId,
    userId,
    sid,
    at: leftAt,
    ...overrides,
  });

  it('event không quan tâm / room không phải meeting (room lk khi thử) / không có meeting → không làm gì', async () => {
    const { service, meetingModel, participantModel } = build();

    await service.handleMediaEvent({ type: 'ignored', eventId: 'EV_0', event: 'track_published' });
    await service.handleMediaEvent(joined({ roomName: 'spike-room' }));
    expect(meetingModel.findById).not.toHaveBeenCalled();

    await service.handleMediaEvent(joined());
    expect(participantModel.updateOne).not.toHaveBeenCalled();
  });

  it('identity không phải userId (bot lk load-test) → bỏ qua', async () => {
    const { service, meetingModel, participantModel, access } = build();
    meetingModel.findById.mockReturnValue(query(fakeMeeting()));

    await service.handleMediaEvent(joined({ userId: 'pub_0' }));

    expect(access.assertRoomAccess).not.toHaveBeenCalled();
    expect(participantModel.updateOne).not.toHaveBeenCalled();
  });

  it('joined: thành viên vào → upsert participant, thêm session theo sid, SADD presence, $max peak', async () => {
    const { service, meetingModel, participantModel, access, redis } = build();
    meetingModel.findById.mockReturnValue(query(fakeMeeting()));
    redis.scard.mockResolvedValue(2);

    await service.handleMediaEvent(joined());

    expect(access.assertRoomAccess).toHaveBeenCalledWith(userId, roomId);
    expect(participantModel.updateOne).toHaveBeenNthCalledWith(
      1,
      { meetingId, userId },
      { $setOnInsert: { displayName: 'An', roleAtJoin: RoomRole.MEMBER, sessions: [], totalDurationSeconds: 0 } },
      { upsert: true },
    );
    // Gửi lại cùng sid → filter $ne không khớp → không thêm lần 2
    expect(participantModel.updateOne).toHaveBeenNthCalledWith(
      2,
      { meetingId, userId, 'sessions.sid': { $ne: sid } },
      { $push: { sessions: { sid, joinedAt, leftAt: null } } },
    );
    expect(redis.sadd).toHaveBeenCalledWith(`presence:${meetingId}`, userId);
    expect(redis.expire).toHaveBeenCalledWith(`presence:${meetingId}`, 86400);
    expect(meetingModel.updateOne).toHaveBeenCalledWith({ _id: meetingId }, { $max: { peakParticipants: 2 } });
  });

  it('joined: không còn là thành viên (bị kick, vào lại bằng token cũ) → removeParticipant, không ghi gì', async () => {
    const { service, meetingModel, participantModel, access, redis, media } = build();
    meetingModel.findById.mockReturnValue(query(fakeMeeting()));
    access.assertRoomAccess.mockRejectedValue(new ForbiddenException());

    await service.handleMediaEvent(joined());

    expect(media.removeParticipant).toHaveBeenCalledWith(meetingId, userId);
    expect(participantModel.updateOne).not.toHaveBeenCalled();
    expect(redis.sadd).not.toHaveBeenCalled();
  });

  it('joined: meeting đã ENDED (room LiveKit chưa kịp đóng) → removeParticipant', async () => {
    const { service, meetingModel, participantModel, access, media } = build();
    meetingModel.findById.mockReturnValue(query(fakeMeeting({ status: MeetingStatus.ENDED })));

    await service.handleMediaEvent(joined());

    expect(media.removeParticipant).toHaveBeenCalledWith(meetingId, userId);
    expect(access.assertRoomAccess).not.toHaveBeenCalled();
    expect(participantModel.updateOne).not.toHaveBeenCalled();
  });

  it('joined: Mongo lỗi khi kiểm thành viên → ném lỗi (500, LiveKit gửi lại), KHÔNG đá người ra', async () => {
    const { service, meetingModel, access, media } = build();
    meetingModel.findById.mockReturnValue(query(fakeMeeting()));
    access.assertRoomAccess.mockRejectedValue(new Error('mongo down'));

    await expect(service.handleMediaEvent(joined())).rejects.toThrow('mongo down');
    expect(media.removeParticipant).not.toHaveBeenCalled();
  });

  it('joined: upsert báo trùng (2 tab cùng lúc) → vẫn thêm session', async () => {
    const { service, meetingModel, participantModel } = build();
    meetingModel.findById.mockReturnValue(query(fakeMeeting()));
    participantModel.updateOne.mockReturnValueOnce(failingQuery(duplicateKeyError()));

    await service.handleMediaEvent(joined());

    expect(participantModel.updateOne).toHaveBeenCalledTimes(2);
  });

  it('left: đóng đúng session theo sid; hết session mở → SREM presence', async () => {
    const { service, meetingModel, participantModel, redis } = build();
    meetingModel.findById.mockReturnValue(query(fakeMeeting()));

    await service.handleMediaEvent(left());

    expect(participantModel.updateOne).toHaveBeenCalledWith(
      { meetingId, userId },
      { $set: { 'sessions.$[s].leftAt': leftAt } },
      { arrayFilters: [{ 's.sid': sid, 's.leftAt': null }] },
    );
    expect(participantModel.exists).toHaveBeenCalledWith({
      meetingId,
      userId,
      sessions: { $elemMatch: { leftAt: null } },
    });
    expect(redis.srem).toHaveBeenCalledWith(`presence:${meetingId}`, userId);
  });

  it('left: còn session mở (tab mới vào trước khi tab cũ báo rời) → không SREM', async () => {
    const { service, meetingModel, participantModel, redis } = build();
    meetingModel.findById.mockReturnValue(query(fakeMeeting()));
    participantModel.exists.mockReturnValue(query({ _id: new Types.ObjectId() }));

    await service.handleMediaEvent(left());

    expect(redis.srem).not.toHaveBeenCalled();
  });

  it('room_finished, phòng còn ACTIVE → AUTO_EMPTY với endedAt adapter tính sẵn', async () => {
    const { service, meetingModel } = build();
    meetingModel.findById.mockReturnValue(query(fakeMeeting()));
    const endedAt = new Date('2026-10-05T07:40:00Z');

    await service.handleMediaEvent({ type: 'room_finished', eventId: 'EV_3', roomName: meetingId, endedAt });

    expect(meetingModel.updateOne).toHaveBeenCalledWith(
      { _id: meetingId, status: MeetingStatus.ACTIVE },
      { $set: { status: MeetingStatus.ENDED, endedAt, endedBy: null, endReason: EndReason.AUTO_EMPTY } },
    );
  });

  it('room_finished, phòng đã giải tán → ROOM_DISSOLVED', async () => {
    const { service, meetingModel, roomModel } = build();
    meetingModel.findById.mockReturnValue(query(fakeMeeting()));
    roomModel.findById.mockReturnValue(query({ status: RoomStatus.DISSOLVED }));

    await service.handleMediaEvent({
      type: 'room_finished',
      eventId: 'EV_4',
      roomName: meetingId,
      endedAt: new Date('2026-10-05T07:40:00Z'),
    });

    expect(meetingModel.updateOne).toHaveBeenCalledWith(
      { _id: meetingId, status: MeetingStatus.ACTIVE },
      { $set: expect.objectContaining({ endReason: EndReason.ROOM_DISSOLVED }) },
    );
  });

  it('Mongo lỗi khi đọc meeting → lỗi bay lên (500)', async () => {
    const { service, meetingModel } = build();
    meetingModel.findById.mockReturnValue(failingQuery(new Error('mongo down')));

    await expect(service.handleMediaEvent(left())).rejects.toThrow('mongo down');
  });
});
