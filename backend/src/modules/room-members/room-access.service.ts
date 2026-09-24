import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Room } from '../rooms/schemas/room.schema.js';
import type { RoomDocument } from '../rooms/schemas/room.schema.js';
import { RoomMember } from './schemas/room-member.schema.js';
import type { RoomMemberDocument } from './schemas/room-member.schema.js';
import { Meeting } from '../meetings/schemas/meeting.schema.js';
import type { MeetingDocument } from '../meetings/schemas/meeting.schema.js';
import { RedisService } from '../../common/services/redis.service.js';
import { MeetingStatus, RoomStatus } from '../../shared/enums.js';

// Kiểm tra quyền dùng chung cho room:subscribe, chat:send, REST lịch sử chat.
// Luôn đọc Mongo/Redis, không cache — để user vừa bị kick ở instance khác cũng bị chặn ngay.
@Injectable()
export class RoomAccessService {
  constructor(
    @InjectModel(Room.name) private roomModel: Model<RoomDocument>,
    @InjectModel(RoomMember.name) private memberModel: Model<RoomMemberDocument>,
    @InjectModel(Meeting.name) private meetingModel: Model<MeetingDocument>,
    private redis: RedisService,
  ) {}

  // User phải là thành viên (không bị ban) của một room còn hoạt động
  async assertRoomAccess(userId: string, roomId: string) {
    if (!Types.ObjectId.isValid(roomId)) {
      throw new BadRequestException('roomId không hợp lệ');
    }

    // Room đã giải tán hoặc đã xoá coi như không tồn tại
    const room = await this.roomModel
      .findOne({ _id: roomId, status: RoomStatus.ACTIVE, deletedAt: null })
      .lean()
      .exec();
    if (!room) {
      throw new NotFoundException('Room không tồn tại');
    }

    const member = await this.memberModel
      .findOne({ roomId, userId, isBanned: false })
      .lean()
      .exec();
    if (!member) {
      throw new ForbiddenException('Bạn không phải thành viên room này');
    }

    return member;
  }

  // Chỉ cho gắn tag meeting khi meeting đang diễn ra, thuộc đúng room, và user đang ở trong meeting
  async assertMeetingTag(userId: string, roomId: string, meetingId: string) {
    if (!Types.ObjectId.isValid(meetingId)) {
      throw new BadRequestException('meetingId không hợp lệ');
    }

    const meeting = await this.meetingModel
      .findOne({ _id: meetingId, roomId, status: MeetingStatus.ACTIVE })
      .lean()
      .exec();
    if (!meeting) {
      throw new ForbiddenException('Meeting không hợp lệ');
    }

    // presence:{meetingId} là Set userId đang online trong meeting (DB_DESIGN phần E)
    const online = await this.redis.sismember(`presence:${meetingId}`, userId);
    if (!online) {
      throw new ForbiddenException('Bạn không ở trong meeting này');
    }
  }
}
