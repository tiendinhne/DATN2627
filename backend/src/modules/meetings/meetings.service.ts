import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  HttpException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Meeting } from './schemas/meeting.schema.js';
import type { MeetingDocument } from './schemas/meeting.schema.js';
import { MeetingParticipant } from './schemas/meeting-participant.schema.js';
import type { MeetingParticipantDocument } from './schemas/meeting-participant.schema.js';
import { Room } from '../rooms/schemas/room.schema.js';
import type { RoomDocument } from '../rooms/schemas/room.schema.js';
import { RoomAccessService } from '../room-members/room-access.service.js';
import { RedisService } from '../../common/services/redis.service.js';
import { MEDIA_PORT } from './ports/media.port.js';
import type { MediaEvent, MediaPort } from './ports/media.port.js';
import { EndReason, MeetingStatus, RoomStatus } from '../../shared/enums.js';
import { RoomAction } from '../../shared/permissions.js';
import { StartMeetingDto } from './dto/start-meeting.dto.js';

// Lỗi trùng unique index của Mongo
function isDuplicateKey(err: unknown): boolean {
  return (err as { code?: number })?.code === 11000;
}

// Số giây giữa 2 mốc, không âm (session vào sau lúc kết thúc → 0)
function secondsBetween(from: Date, to: Date): number {
  return Math.max(0, Math.floor((new Date(to).getTime() - new Date(from).getTime()) / 1000));
}

// Tên room / identity do backend tạo luôn là String(ObjectId) — 24 ký tự hex.
// Chặt hơn ObjectId.isValid (nhận cả chuỗi 12 ký tự bất kỳ như "bench-room-1")
const OBJECT_ID_HEX = /^[a-f\d]{24}$/i;

// TTL key presence:{meetingId} (DB_DESIGN Phần E) — làm mới mỗi lần có người vào
const PRESENCE_TTL_SECONDS = 24 * 60 * 60;

type JoinedEvent = Extract<MediaEvent, { type: 'participant_joined' }>;
type LeftEvent = Extract<MediaEvent, { type: 'participant_left' }>;

// Meeting đọc từ Mongo (document hoặc object lean)
type MeetingLike = {
  _id: unknown;
  roomId: unknown;
  title: string;
  status: MeetingStatus;
  createdBy: unknown;
  startedAt?: Date;
  endedAt?: Date | null;
  endReason?: EndReason | null;
  peakParticipants?: number;
  totalParticipants?: number;
  messageCount?: number;
  durationSeconds?: number;
};

export type MeetingResponse = ReturnType<typeof toMeetingResponse>;

// Map document → response: id thay cho _id (ràng buộc 2)
export function toMeetingResponse(m: MeetingLike) {
  return {
    id: String(m._id),
    roomId: String(m.roomId),
    title: m.title,
    status: m.status,
    createdBy: String(m.createdBy),
    startedAt: m.startedAt,
    endedAt: m.endedAt ?? null,
    endReason: m.endReason ?? null,
    peakParticipants: m.peakParticipants ?? 0,
    totalParticipants: m.totalParticipants ?? 0,
    messageCount: m.messageCount ?? 0,
    durationSeconds: m.durationSeconds ?? 0,
  };
}

@Injectable()
export class MeetingsService {
  private readonly logger = new Logger(MeetingsService.name);

  constructor(
    @InjectModel(Meeting.name) private meetingModel: Model<MeetingDocument>,
    @InjectModel(MeetingParticipant.name) private participantModel: Model<MeetingParticipantDocument>,
    @InjectModel(Room.name) private roomModel: Model<RoomDocument>,
    private access: RoomAccessService,
    private redis: RedisService,
    @Inject(MEDIA_PORT) private media: MediaPort,
  ) {}

  // POST /rooms/:roomId/meetings — chỉ HOST (spec §5.2)
  async startMeeting(userId: string, roomId: string, dto: StartMeetingDto) {
    await this.access.assertRoomPermission(userId, roomId, RoomAction.MANAGE_MEETING);

    // Đã có meeting ACTIVE: room LiveKit còn → 409; room đã đóng (mất room_finished) → tự hồi phục (spec §9.1).
    // Không hỏi được LiveKit → viaMedia ném 502, không chốt gì
    const active = await this.meetingModel.findOne({ roomId, status: MeetingStatus.ACTIVE }).lean().exec();
    if (active) {
      const activeId = String(active._id);
      if (await this.viaMedia(() => this.media.roomExists(activeId))) {
        throw new ConflictException('Phòng đang có buổi học diễn ra');
      }
      await this.endMeeting(activeId, await this.systemEndReason(roomId), new Date());
    }

    // LiveKit TRƯỚC, Mongo sau → không bao giờ có meeting ACTIVE mà chưa có room LiveKit (spec §5.2)
    const meetingId = new Types.ObjectId();
    await this.viaMedia(() => this.media.createRoom(String(meetingId)));

    let meeting;
    try {
      meeting = await this.meetingModel.create({ _id: meetingId, roomId, title: dto.title, createdBy: userId });
    } catch (err) {
      // Room LiveKit vừa tạo bị thừa → đóng. Đóng cũng lỗi thì room trống tự đóng sau emptyTimeout
      await this.media
        .closeRoom(String(meetingId))
        .catch((closeErr) => this.logger.warn(`Không đóng được room LiveKit thừa ${String(meetingId)}: ${closeErr}`));
      // Unique partial index "1 meeting ACTIVE / room" báo trùng (bấm 2 lần / 2 request cùng lúc)
      if (isDuplicateKey(err)) throw new ConflictException('Phòng đang có buổi học diễn ra');
      throw err;
    }

    await this.roomModel.updateOne({ _id: roomId }, { $inc: { meetingCount: 1 } }).exec();
    return toMeetingResponse(meeting);
  }

  // GET /rooms/:roomId/meetings — lịch sử, mới nhất trước. Chỉ thành viên
  async listMeetings(userId: string, roomId: string, page: number, limit: number) {
    await this.access.assertRoomAccess(userId, roomId);
    const rows = await this.meetingModel
      .find({ roomId })
      .sort({ startedAt: -1 })
      .skip((page - 1) * limit)
      // Lấy dư 1 bản ghi để biết còn trang sau, khỏi phải đếm tổng
      .limit(limit + 1)
      .lean()
      .exec();
    return {
      items: rows.slice(0, limit).map(toMeetingResponse),
      page,
      limit,
      hasMore: rows.length > limit,
    };
  }

  // POST /meetings/:meetingId/join — thành viên, meeting ACTIVE. Token cấp lại mỗi lần vào (webrtc.md §2)
  async joinMeeting(userId: string, displayName: string, meetingId: string) {
    const meeting = await this.findMeeting(meetingId);
    const member = await this.access.assertRoomAccess(userId, String(meeting.roomId));

    if (meeting.status !== MeetingStatus.ACTIVE) {
      throw new ConflictException('Buổi học đã kết thúc');
    }
    // Mongo còn ACTIVE mà LiveKit trả lời "không có room" → tự hồi phục (spec §9.1).
    // Không hỏi được LiveKit → 502, không chốt gì (đằng nào cũng không vào được call)
    if (!(await this.viaMedia(() => this.media.roomExists(meetingId)))) {
      await this.endMeeting(meetingId, await this.systemEndReason(meeting.roomId), new Date());
      throw new ConflictException('Buổi học đã kết thúc');
    }

    const { token, url } = await this.viaMedia(() =>
      this.media.createJoinToken({ roomName: meetingId, userId, displayName }),
    );
    return { token, livekitUrl: url, myRole: member.role, meeting: toMeetingResponse(meeting) };
  }

  // POST /meetings/:meetingId/end — chỉ HOST. Idempotent: đã kết thúc vẫn đóng room, bấm lại được (spec §5.2)
  async endByHost(userId: string, meetingId: string) {
    const meeting = await this.findMeeting(meetingId);
    await this.access.assertRoomPermission(userId, String(meeting.roomId), RoomAction.MANAGE_MEETING);

    await this.endMeeting(meetingId, EndReason.HOST_ENDED, new Date(), userId);
    // Đóng room LiveKit → mọi người bị ngắt với ROOM_DELETED. Lỗi → 502 để HOST bấm lại
    await this.viaMedia(() => this.media.closeRoom(meetingId));
  }

  // Webhook LiveKit (spec §6). Điều kiện biết trước → return (controller trả 200, LiveKit không gửi lại).
  // Lỗi bất ngờ (Mongo, Redis, LiveKit API) → ném ra → 500 → LiveKit gửi lại; mọi bước idempotent nên an toàn
  async handleMediaEvent(event: MediaEvent) {
    if (event.type === 'ignored') return;
    // Room không do backend tạo (lk room create khi thử / benchmark)
    if (!OBJECT_ID_HEX.test(event.roomName)) return;

    const meeting = await this.meetingModel.findById(event.roomName).lean().exec();
    if (!meeting) return;

    if (event.type === 'room_finished') {
      await this.endMeeting(event.roomName, await this.systemEndReason(meeting.roomId), event.endedAt);
      return;
    }
    // Identity không phải userId (bot lk load-test) hoặc thiếu sid → không ghi
    if (!OBJECT_ID_HEX.test(event.userId) || !event.sid) return;

    if (event.type === 'participant_joined') {
      await this.onParticipantJoined(meeting, event);
    } else {
      await this.onParticipantLeft(event.roomName, event);
    }
  }

  // Gọi từ RoomsService khi kick / rời phòng (spec §8). KHÔNG BAO GIỜ ném lỗi —
  // thao tác chính (xoá thành viên) đã xong; lỗi ở đây chỉ ghi log
  async removeFromActiveMeeting(roomId: string, userId: string) {
    let meetingId = '?';
    try {
      const active = await this.meetingModel.findOne({ roomId, status: MeetingStatus.ACTIVE }).lean().exec();
      if (!active) return;
      meetingId = String(active._id);
      await this.media.removeParticipant(meetingId, userId);
    } catch (err) {
      // Người đó còn trong call tới khi tự thoát; vào lại bị webhook chặn; HOST có thể kết thúc buổi học
      this.logger.error(`Không đưa được user ${userId} ra khỏi meeting ${meetingId} của room ${roomId}: ${err}`);
    }
  }

  // Gọi từ RoomsService khi giải tán phòng (spec §8). KHÔNG BAO GIỜ ném lỗi.
  // 2 bước độc lập: bước chốt lỗi vẫn đóng room → room_finished tới sau vẫn chốt ROOM_DISSOLVED
  async endActiveMeetingOfRoom(roomId: string) {
    let meetingId: string;
    try {
      const active = await this.meetingModel.findOne({ roomId, status: MeetingStatus.ACTIVE }).lean().exec();
      if (!active) return;
      meetingId = String(active._id);
    } catch (err) {
      // Không biết meetingId → không đóng được room; room trống dần → room_finished → ROOM_DISSOLVED
      this.logger.error(`Không tìm được meeting ACTIVE của room ${roomId} khi giải tán: ${err}`);
      return;
    }

    try {
      await this.endMeeting(meetingId, EndReason.ROOM_DISSOLVED, new Date());
    } catch (err) {
      this.logger.error(`Không chốt được meeting ${meetingId} của room ${roomId} khi giải tán: ${err}`);
    }

    try {
      await this.media.closeRoom(meetingId);
    } catch (err) {
      this.logger.error(`Không đóng được room LiveKit ${meetingId} của room ${roomId} khi giải tán: ${err}`);
    }
  }

  // Kết thúc meeting — dùng chung cho HOST kết thúc, giải tán phòng, room_finished, tự hồi phục (spec §7.1).
  // Chạy lại bao nhiêu lần cũng ra cùng kết quả
  async endMeeting(meetingId: string, reason: EndReason, endedAt: Date, endedBy: string | null = null) {
    const meeting = await this.meetingModel.findById(meetingId).lean().exec();
    if (!meeting) return;

    // Không cho endedAt sớm hơn lúc bắt đầu (vd room_finished của meeting chưa ai vào)
    const startedAt = meeting.startedAt ?? endedAt;
    const at = endedAt.getTime() < new Date(startedAt).getTime() ? startedAt : endedAt;

    // Điều kiện status ACTIVE: meeting đã kết thúc thì KHÔNG ghi đè endedAt / endReason
    await this.meetingModel
      .updateOne(
        { _id: meetingId, status: MeetingStatus.ACTIVE },
        { $set: { status: MeetingStatus.ENDED, endedAt: at, endedBy, endReason: reason } },
      )
      .exec();

    // Vẫn chạy kể cả khi update không khớp → sửa được lần finalize trước bị dở
    await this.finalize(meetingId);
  }

  // Tính lại thống kê từ dữ liệu — idempotent (spec §7.1)
  private async finalize(meetingId: string) {
    const meeting = await this.meetingModel.findById(meetingId).lean().exec();
    if (!meeting?.endedAt) return;
    const endedAt = meeting.endedAt;

    // Đóng session còn mở (mất participant_left / người còn trong call lúc kết thúc). Atomic, không đè leftAt thật
    await this.participantModel
      .updateMany({ meetingId }, { $set: { 'sessions.$[s].leftAt': endedAt } }, { arrayFilters: [{ 's.leftAt': null }] })
      .exec();

    // Tổng thời gian từng người — mỗi meeting chỉ vài chục document
    const participants = await this.participantModel.find({ meetingId }).lean().exec();
    for (const p of participants) {
      const total = (p.sessions ?? []).reduce((sum, s) => sum + secondsBetween(s.joinedAt, s.leftAt ?? endedAt), 0);
      await this.participantModel.updateOne({ _id: p._id }, { $set: { totalDurationSeconds: total } }).exec();
    }

    // Unique {meetingId, userId} → số document = số người khác nhau đã vào
    await this.meetingModel
      .updateOne(
        { _id: meetingId },
        {
          $set: {
            totalParticipants: participants.length,
            durationSeconds: secondsBetween(meeting.startedAt ?? endedAt, endedAt),
          },
        },
      )
      .exec();

    await this.redis.del(`presence:${meetingId}`);
  }

  private async onParticipantJoined(meeting: { _id: unknown; roomId: unknown; status: MeetingStatus }, e: JoinedEvent) {
    const meetingId = String(meeting._id);

    // Meeting đã kết thúc nhưng room LiveKit chưa kịp đóng → không cho ở lại
    if (meeting.status !== MeetingStatus.ACTIVE) {
      await this.media.removeParticipant(meetingId, e.userId);
      return;
    }

    // Không còn là thành viên (bị kick / tự rời / phòng giải tán) mà vào lại bằng token cũ → đưa ra ngay.
    // LiveKit tự host không thu hồi token khi removeParticipant (spec §1 câu 2)
    let member;
    try {
      member = await this.access.assertRoomAccess(e.userId, String(meeting.roomId));
    } catch (err) {
      // Lỗi Mongo (không phải 4xx) → ném → 500 → LiveKit gửi lại; không đá nhầm người đang hợp lệ
      if (!(err instanceof HttpException)) throw err;
      await this.media.removeParticipant(meetingId, e.userId);
      return;
    }

    // 1 document / user / meeting. 2 event cùng user chạy song song (2 tab) → upsert báo trùng thì bỏ qua
    await this.participantModel
      .updateOne(
        { meetingId, userId: e.userId },
        {
          $setOnInsert: {
            displayName: e.displayName.slice(0, 60) || 'Thành viên',
            roleAtJoin: member.role,
            sessions: [],
            totalDurationSeconds: 0,
          },
        },
        { upsert: true },
      )
      .exec()
      .catch((err) => {
        if (!isDuplicateKey(err)) throw err;
      });

    // Thêm session theo sid — LiveKit gửi lại cùng sid thì không thêm lần 2
    await this.participantModel
      .updateOne(
        { meetingId, userId: e.userId, 'sessions.sid': { $ne: e.sid } },
        { $push: { sessions: { sid: e.sid, joinedAt: e.at, leftAt: null } } },
      )
      .exec();

    // Presence ở Redis; đỉnh số người ghi Mongo bằng $max — atomic, event trùng không làm sai (spec §10)
    const key = `presence:${meetingId}`;
    await this.redis.sadd(key, e.userId);
    await this.redis.expire(key, PRESENCE_TTL_SECONDS);
    const online = await this.redis.scard(key);
    await this.meetingModel.updateOne({ _id: meetingId }, { $max: { peakParticipants: online } }).exec();
  }

  // participant_left và participant_connection_aborted xử lý y hệt nhau (spec §6.3)
  private async onParticipantLeft(meetingId: string, e: LeftEvent) {
    // Đóng đúng session theo sid. Gửi lại / aborted chưa từng có session → không khớp → không làm gì
    await this.participantModel
      .updateOne(
        { meetingId, userId: e.userId },
        { $set: { 'sessions.$[s].leftAt': e.at } },
        { arrayFilters: [{ 's.sid': e.sid, 's.leftAt': null }] },
      )
      .exec();

    // Còn session mở (tab mới vào trước khi tab cũ báo rời) → vẫn đang ở trong meeting
    const stillIn = await this.participantModel
      .exists({ meetingId, userId: e.userId, sessions: { $elemMatch: { leftAt: null } } })
      .exec();
    if (!stillIn) {
      await this.redis.srem(`presence:${meetingId}`, e.userId);
    }
  }

  // Meeting theo id: sai định dạng → 400, không có → 404
  private async findMeeting(meetingId: string) {
    if (!Types.ObjectId.isValid(meetingId)) {
      throw new BadRequestException('meetingId không hợp lệ');
    }
    const meeting = await this.meetingModel.findById(meetingId).lean().exec();
    if (!meeting) {
      throw new NotFoundException('Buổi học không tồn tại');
    }
    return meeting;
  }

  // Lý do khi hệ thống tự kết thúc (room_finished / tự hồi phục): phòng đã giải tán → ROOM_DISSOLVED, còn lại AUTO_EMPTY
  private async systemEndReason(roomId: unknown): Promise<EndReason> {
    const room = await this.roomModel.findById(roomId).select('status').lean().exec();
    return room?.status === RoomStatus.DISSOLVED ? EndReason.ROOM_DISSOLVED : EndReason.AUTO_EMPTY;
  }

  // Gọi LiveKit; lỗi (timeout, mạng, 5xx) → 502, không đổi trạng thái gì (spec §4.2)
  private async viaMedia<T>(call: () => Promise<T>): Promise<T> {
    try {
      return await call();
    } catch (err) {
      this.logger.error(`Gọi media server lỗi: ${err}`);
      throw new BadGatewayException('Không kết nối được máy chủ media');
    }
  }
}
