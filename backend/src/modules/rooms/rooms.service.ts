import {
  HttpException,
  HttpStatus,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { randomInt } from 'node:crypto';
import { Room } from './schemas/room.schema.js';
import type { RoomDocument } from './schemas/room.schema.js';
import { RoomMember } from '../room-members/schemas/room-member.schema.js';
import type { RoomMemberDocument } from '../room-members/schemas/room-member.schema.js';
import { RoomAccessService } from '../room-members/room-access.service.js';
import { RedisService } from '../../common/services/redis.service.js';
import { RoomRole, RoomStatus } from '../../shared/enums.js';
import { CreateRoomDto } from './dto/create-room.dto.js';

// Mã tham gia: 8 ký tự base32, ngẫu nhiên, không tuần tự (§16)
const JOIN_CODE_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const JOIN_CODE_LENGTH = 8;
const JOIN_CODE_MAX_TRIES = 5;

// Chống dò mã: mỗi user tối đa 10 lần nhập mã / 60 giây, đếm trong Redis (§16)
const JOIN_RATE_LIMIT = 10;
const RATE_WINDOW_SECONDS = 60;

export function generateJoinCode(): string {
  let code = '';
  for (let i = 0; i < JOIN_CODE_LENGTH; i++) {
    code += JOIN_CODE_ALPHABET[randomInt(JOIN_CODE_ALPHABET.length)];
  }
  return code;
}

// Lỗi trùng unique index của Mongo
function isDuplicateKey(err: unknown): boolean {
  return (err as { code?: number })?.code === 11000;
}

// Room đọc từ Mongo (document hoặc object lean)
type RoomLike = {
  _id: unknown;
  ownerId: unknown;
  name: string;
  description?: string;
  joinCode: string;
  status: RoomStatus;
  memberCount?: number;
  createdAt?: Date;
};

export type RoomResponse = ReturnType<typeof toRoomResponse>;

// Map document → response trả cho client: id thay cho _id (ràng buộc 2)
export function toRoomResponse(room: RoomLike, myRole: RoomRole) {
  return {
    id: String(room._id),
    name: room.name,
    description: room.description ?? '',
    joinCode: room.joinCode,
    ownerId: String(room.ownerId),
    status: room.status,
    memberCount: room.memberCount ?? 0,
    createdAt: room.createdAt,
    myRole,
  };
}

@Injectable()
export class RoomsService {
  private readonly logger = new Logger(RoomsService.name);

  constructor(
    @InjectModel(Room.name) private roomModel: Model<RoomDocument>,
    @InjectModel(RoomMember.name) private memberModel: Model<RoomMemberDocument>,
    private access: RoomAccessService,
    private redis: RedisService,
  ) {}

  // POST /rooms — người tạo thành HOST
  async createRoom(userId: string, dto: CreateRoomDto) {
    const room = await this.insertRoomWithUniqueCode(userId, dto);
    try {
      await this.memberModel.create({ roomId: room._id, userId, role: RoomRole.HOST });
    } catch (err) {
      // Không có transaction (Mongo standalone) → tự xoá room để không bỏ lại room không có HOST.
      // Xoá cũng lỗi thì chỉ ghi log roomId mồ côi, vẫn ném lỗi gốc để không mất nguyên nhân.
      await this.roomModel
        .deleteOne({ _id: room._id })
        .exec()
        .catch((delErr) => this.logger.error(`Không xoá được room mồ côi ${String(room._id)}: ${delErr}`));
      throw err;
    }
    return toRoomResponse(room, RoomRole.HOST);
  }

  // POST /rooms/join — idempotent: đã là thành viên thì trả phòng luôn
  async joinRoom(userId: string, code: string) {
    await this.checkRateLimit(
      `ratelimit:join:${userId}`,
      JOIN_RATE_LIMIT,
      'Bạn nhập mã quá nhiều lần, vui lòng đợi 1 phút',
    );

    // Sai mã và phòng đã giải tán trả cùng một lỗi → không lộ phòng nào từng tồn tại
    const room = await this.roomModel
      .findOne({ joinCode: code, status: RoomStatus.ACTIVE, deletedAt: null })
      .lean()
      .exec();
    if (!room) {
      throw new NotFoundException('Mã phòng không đúng hoặc phòng không còn hoạt động');
    }

    try {
      await this.memberModel.create({ roomId: room._id, userId, role: RoomRole.MEMBER });
    } catch (err) {
      if (!isDuplicateKey(err)) throw err;
      // Unique {roomId, userId} báo trùng → đã là thành viên, không tăng memberCount
      const member = await this.memberModel.findOne({ roomId: room._id, userId }).lean().exec();
      return toRoomResponse(room, member?.role ?? RoomRole.MEMBER);
    }

    await this.roomModel.updateOne({ _id: room._id }, { $inc: { memberCount: 1 } }).exec();
    return toRoomResponse({ ...room, memberCount: (room.memberCount ?? 0) + 1 }, RoomRole.MEMBER);
  }

  // Sinh mã và insert; trùng mã (unique index) thì sinh lại, tối đa JOIN_CODE_MAX_TRIES lần
  private async insertRoomWithUniqueCode(userId: string, dto: CreateRoomDto) {
    for (let i = 0; i < JOIN_CODE_MAX_TRIES; i++) {
      try {
        return await this.roomModel.create({
          name: dto.name,
          description: dto.description ?? '',
          ownerId: userId,
          joinCode: generateJoinCode(),
          memberCount: 1,
        });
      } catch (err) {
        if (!isDuplicateKey(err)) throw err;
      }
    }
    throw new InternalServerErrorException('Không sinh được mã phòng, vui lòng thử lại');
  }

  // Đếm số lần gọi trong cửa sổ 60s bằng Redis — đúng cả khi request rơi vào instance khác
  private async checkRateLimit(key: string, limit: number, message: string) {
    const count = await this.redis.incr(key);
    if (count === 1) {
      await this.redis.expire(key, RATE_WINDOW_SECONDS);
    }
    if (count > limit) {
      throw new HttpException(message, HttpStatus.TOO_MANY_REQUESTS);
    }
  }
}
