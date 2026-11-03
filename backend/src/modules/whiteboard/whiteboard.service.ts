import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { promisify } from 'node:util';
import { gzip } from 'node:zlib';
import { Whiteboard } from './schemas/whiteboard.schema.js';
import type { WhiteboardDocument } from './schemas/whiteboard.schema.js';
import { Meeting } from '../meetings/schemas/meeting.schema.js';
import type { MeetingDocument } from '../meetings/schemas/meeting.schema.js';
import { RoomAccessService } from '../room-members/room-access.service.js';
import { RedisService } from '../../common/services/redis.service.js';
import { MeetingStatus } from '../../shared/enums.js';
import { WB_MAX_ALIVE_ELEMENTS, WB_MAX_TOTAL_ELEMENTS } from '../../shared/whiteboard.js';
import { WB_APPLY_SCRIPT } from './whiteboard.lua.js';
import type { WbElement } from './element.validator.js';

// gzip chạy ở thread pool — không chặn event loop (board lớn vài MB), giữ độ trễ realtime
const gzipAsync = promisify(gzip);

// TTL key Redis của board (DB_DESIGN Phần E) — làm mới mỗi op
const BOARD_TTL_SECONDS = 24 * 60 * 60;
// Khoá giới hạn tần suất ghi Mongo: tối đa 1 lần / 15 s / board (spec §5)
const PERSIST_LOCK_MS = 15_000;

// Tên key Redis của 1 board
function boardKeys(meetingId: string) {
  return {
    hash: `wb:${meetingId}`,
    seq: `wb:seq:${meetingId}`,
    alive: `wb:alive:${meetingId}`,
    lock: `wb:persist-lock:${meetingId}`,
    closed: `wb:closed:${meetingId}`,
  };
}

// Lỗi trùng unique index của Mongo
function isDuplicateKey(err: unknown): boolean {
  return (err as { code?: number })?.code === 11000;
}

// Thứ tự lớp (z-order) của Excalidraw: theo fractional index, hoà thì theo id (giống orderByFractionalIndex)
function byFractionalIndex(a: { index?: string | null; id: string }, b: { index?: string | null; id: string }) {
  const ai = a.index ?? '';
  const bi = b.index ?? '';
  if (ai !== bi) return ai < bi ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

@Injectable()
export class WhiteboardService {
  private readonly logger = new Logger(WhiteboardService.name);

  constructor(
    @InjectModel(Whiteboard.name) private whiteboardModel: Model<WhiteboardDocument>,
    @InjectModel(Meeting.name) private meetingModel: Model<MeetingDocument>,
    private access: RoomAccessService,
    private redis: RedisService,
  ) {}

  // meeting:join — thành viên phòng + meeting ACTIVE (spec §3.1). Trả roomId để gateway gắn envelope
  async assertCanJoin(userId: string, meetingId: string): Promise<{ roomId: string }> {
    const meeting = await this.meetingModel.findById(meetingId).select('roomId status').lean().exec();
    if (!meeting) throw new NotFoundException('Buổi học không tồn tại');
    await this.access.assertRoomAccess(userId, String(meeting.roomId));
    if (meeting.status !== MeetingStatus.ACTIVE) throw new ConflictException('Buổi học đã kết thúc');
    return { roomId: String(meeting.roomId) };
  }

  // Snapshot gửi người vừa join / reconnect: toàn bộ Hash, GỒM tombstone (để người reconnect xoá được element đã bị xoá)
  async getSnapshot(meetingId: string): Promise<{ seq: number | null; elements: unknown[] }> {
    const { hash, seq } = await this.readBoard(meetingId);
    return {
      seq: seq === null ? null : Number(seq),
      // HGETALL không có thứ tự; restoreElements của client coi thứ tự mảng là z-order → sắp theo index
      elements: Object.values(hash)
        .map((value) => JSON.parse(value))
        .sort(byFractionalIndex),
    };
  }

  // Chạy Lua wb-apply: trả seq + element thắng; null nếu không element nào thắng; vượt giới hạn → 400
  async applyOps(meetingId: string, elements: WbElement[]): Promise<{ seq: number; winners: WbElement[] } | null> {
    const keys = boardKeys(meetingId);
    const args = [String(WB_MAX_ALIVE_ELEMENTS), String(WB_MAX_TOTAL_ELEMENTS), String(BOARD_TTL_SECONDS)];
    for (const element of elements) {
      args.push(
        element.id,
        String(element.version),
        String(element.versionNonce),
        element.isDeleted ? '1' : '0',
        JSON.stringify(element),
      );
    }
    const reply = (await this.redis.getClient().eval(WB_APPLY_SCRIPT, {
      keys: [keys.hash, keys.seq, keys.alive, keys.closed],
      arguments: args,
    })) as Array<string | number>;

    if (reply[0] === 'CLOSED') throw new ConflictException('Buổi học đã kết thúc');
    if (reply[0] === 'LIMIT') throw new BadRequestException('Bảng vẽ đã đạt giới hạn 5.000 đối tượng');
    if (reply[0] === 'NOOP') return null;
    return { seq: Number(reply[1]), winners: reply.slice(2).map((index) => elements[Number(index)]) };
  }

  // Sau op có element thắng: instance nào giành được khoá 15 s thì ghi Mongo ở nền (không timer RAM — ràng buộc #5)
  tryPersistInBackground(meetingId: string): void {
    void this.redis
      .getClient()
      .set(boardKeys(meetingId).lock, '1', { NX: true, PX: PERSIST_LOCK_MS })
      .then((locked) => (locked ? this.persist(meetingId) : undefined))
      .catch((err) => this.logger.error(`Lưu whiteboard nền lỗi, meeting ${meetingId}: ${err}`));
  }

  // Ghi board từ Redis xuống Mongo (spec §5). Guard lastSeq chống ghi đè ngược (ADR-015)
  async persist(meetingId: string): Promise<void> {
    const { hash, seq } = await this.readBoard(meetingId);
    const values = Object.values(hash);
    // Redis trống → không ghi, tránh endMeeting chạy lại lần 2 ghi board rỗng đè Mongo
    if (seq === null || values.length === 0) return;

    // Mongo chỉ giữ element còn hiển thị — tombstone chỉ cần cho đồng bộ live (spec §1 câu 12)
    const elements = values.map((value) => JSON.parse(value)).filter((element) => element.isDeleted !== true)
      .sort(byFractionalIndex);
    const raw = JSON.stringify(elements);
    const meeting = await this.meetingModel.findById(meetingId).select('roomId').lean().exec();
    if (!meeting) return;

    const filter = { meetingId, lastSeq: { $lt: Number(seq) } };
    const update = {
      $set: {
        elementsGzip: await gzipAsync(raw),
        elementCount: elements.length,
        rawSizeBytes: Buffer.byteLength(raw),
        lastSeq: Number(seq),
        lastPersistedAt: new Date(),
      },
      $setOnInsert: { roomId: meeting.roomId },
    };
    try {
      await this.whiteboardModel.updateOne(filter, update, { upsert: true }).exec();
    } catch (err) {
      if (!isDuplicateKey(err)) throw err;
      // E11000: (a) Mongo đã có lastSeq >= seq, hoặc (b) 2 upsert đầu tiên cùng insert và mình thua nhưng seq mới hơn.
      // Thử lại 1 lần KHÔNG upsert: chỉ khớp khi bản Mongo cũ hơn, ngược lại sửa 0 dòng — cả hai đều đúng
      await this.whiteboardModel.updateOne(filter, update).exec();
    }
  }

  // Gọi từ endMeeting: lưu bản cuối rồi xoá key Redis. KHÔNG BAO GIỜ ném — lỗi thì giữ key (TTL 24 h) để không mất board
  async finalizeBoard(meetingId: string): Promise<void> {
    try {
      const keys = boardKeys(meetingId);
      // Đặt cờ đóng TRƯỚC khi đọc bản cuối. Redis chạy tuần tự → mọi op sau lệnh SET này bị Lua từ chối,
      // op trước nó đã nằm trong bản đọc cuối — đúng trên mọi instance (socketsLeave qua adapter là bất đồng bộ)
      await this.redis.getClient().set(keys.closed, '1', { EX: BOARD_TTL_SECONDS });
      await this.persist(meetingId);
      await this.redis.getClient().del([keys.hash, keys.seq, keys.alive]);
    } catch (err) {
      this.logger.error(`Không lưu được bản cuối whiteboard, meeting ${meetingId}: ${err}`);
    }
  }

  // Đọc Hash + seq trong cùng 1 MULTI — state và seq luôn khớp nhau (spec §5 bước 1)
  private async readBoard(meetingId: string): Promise<{ hash: Record<string, string>; seq: string | null }> {
    const keys = boardKeys(meetingId);
    const [hash, seq] = (await this.redis.getClient().multi().hGetAll(keys.hash).get(keys.seq).exec()) as unknown as [
      Record<string, string>,
      string | null,
    ];
    return { hash, seq };
  }
}
