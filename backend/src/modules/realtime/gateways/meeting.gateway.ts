import {
  WebSocketGateway,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
} from '@nestjs/websockets';
import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { plainToInstance } from 'class-transformer';
import { IsMongoId, validate } from 'class-validator';
import { Namespace, Socket } from 'socket.io';
import { Types } from 'mongoose';
import { ChatService } from '../../chat/chat.service.js';
import { ChatSendDto } from '../../chat/dto/chat-send.dto.js';
import { RoomAccessService } from '../../room-members/room-access.service.js';
import { UsersService } from '../../users/users.service.js';
import { RealtimePublisher } from '../realtime-publisher.service.js';
import { WhiteboardService } from '../../whiteboard/whiteboard.service.js';
import { MeetingIdDto, WbOpsDto, WbPointerDto } from '../../whiteboard/dto/whiteboard-events.dto.js';
import { validateElementsBatch } from '../../whiteboard/element.validator.js';
import type { WbElement } from '../../whiteboard/element.validator.js';
import { AiAssistantService } from '../../ai-assistant/ai-assistant.service.js';
import { AiGenerateDto } from '../../ai-assistant/dto/ai-generate.dto.js';
import { RedisService } from '../../../common/services/redis.service.js';

const ROOM_PRESENCE_TTL_SECONDS = 60;

class RoomIdDto {
  @IsMongoId()
  roomId!: string;
}

@WebSocketGateway({
  cors: {
    origin: (process.env.FRONTEND_URL || 'http://localhost:3000').split(','),
    credentials: true,
  },
  transports: ['websocket'],
  namespace: '/meeting',
})
export class MeetingGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(MeetingGateway.name);

  constructor(
    private readonly jwt: JwtService,
    private readonly users: UsersService,
    private readonly roomAccess: RoomAccessService,
    private readonly redis: RedisService,
    private readonly chat: ChatService,
    private readonly publisher: RealtimePublisher,
    private readonly whiteboard: WhiteboardService,
    private readonly ai: AiAssistantService,
  ) {}

  afterInit(namespace: Namespace) {
    this.publisher.setNamespace(namespace);
    namespace.use((socket, next) => {
      void this.authenticate(socket).then(
        () => next(),
        (error: unknown) =>
          next(
            error instanceof Error
              ? error
              : new Error('Socket authentication failed'),
          ),
      );
    });
  }

  async handleConnection(socket: Socket) {
    await socket.join(`user:${socket.data.userId}`);
    this.logger.log(`Client connected: ${socket.id}`);
  }

  async handleDisconnect(socket: Socket) {
    this.logger.log(`Client disconnected: ${socket.id}`);
    const roomIds: string[] = socket.data.presenceRoomIds ?? [];
    for (const roomId of roomIds) {
      await this.removeRoomPresence(socket, roomId, false);
    }
  }

  private async authenticate(socket: Socket) {
    const token = socket.handshake.auth?.token;
    if (typeof token !== 'string' || !token) {
      throw new UnauthorizedException('Thiếu access token');
    }

    let subject: string;
    try {
      const payload = await this.jwt.verifyAsync<{ sub: string }>(token);
      subject = payload.sub;
    } catch (error) {
      if (isJwtTokenError(error))
        throw new UnauthorizedException('Access token không hợp lệ');
      throw error;
    }

    if (!Types.ObjectId.isValid(subject)) {
      throw new UnauthorizedException('Access token không hợp lệ');
    }
    const user = await this.users.findById(subject);
    if (!user) throw new UnauthorizedException('Tài khoản không tồn tại');
    socket.data.userId = String(user._id);
    socket.data.displayName = user.displayName;
  }

  @SubscribeMessage('room:subscribe')
  async handleRoomSubscribe(socket: Socket, data: unknown) {
    try {
      const dto = await this.validatePayload(RoomIdDto, data);
      await this.roomAccess.assertRoomAccess(socket.data.userId, dto.roomId);
      await socket.join(`room:${dto.roomId}`);
    } catch (error) {
      this.sendExpectedError(socket, error);
    }
  }

  @SubscribeMessage('room:unsubscribe')
  async handleRoomUnsubscribe(socket: Socket, data: unknown) {
    try {
      const dto = await this.validatePayload(RoomIdDto, data);
      await socket.leave(`room:${dto.roomId}`);
    } catch (error) {
      this.sendExpectedError(socket, error);
    }
  }

  @SubscribeMessage('room:presence:subscribe')
  async handleRoomPresenceSubscribe(socket: Socket, data: unknown) {
    try {
      const dto = await this.validatePayload(RoomIdDto, data);
      await this.roomAccess.assertRoomAccess(socket.data.userId, dto.roomId);

      const channel = `room-page:${dto.roomId}`;
      await socket.join(channel);
      socket.data.presenceRoomIds = [
        ...new Set([...(socket.data.presenceRoomIds ?? []), dto.roomId]),
      ];

      const onlineUserIds = await this.getOnlineUserIds(
        dto.roomId,
        socket.data.userId,
      );
      const wasOnline = onlineUserIds.includes(socket.data.userId);
      const addedToSet = await this.refreshRoomPresence(
        dto.roomId,
        socket.data.userId,
      );
      const snapshot = wasOnline
        ? onlineUserIds
        : [...onlineUserIds, socket.data.userId];

      this.publisher.sendRoomPresenceSnapshot(socket, {
        actorId: socket.data.userId,
        roomId: dto.roomId,
        onlineUserIds: snapshot,
      });
      if (!wasOnline && addedToSet) {
        this.publisher.publishRoomPresenceChanged(socket.id, {
          actorId: socket.data.userId,
          roomId: dto.roomId,
          userId: socket.data.userId,
          online: true,
        });
      }
    } catch (error) {
      this.sendExpectedError(socket, error);
    }
  }

  @SubscribeMessage('room:presence:heartbeat')
  async handleRoomPresenceHeartbeat(socket: Socket, data: unknown) {
    try {
      const dto = await this.validatePayload(RoomIdDto, data);
      await this.roomAccess.assertRoomAccess(socket.data.userId, dto.roomId);
      if (
        !socket.rooms.has(`room-page:${dto.roomId}`) ||
        !(socket.data.presenceRoomIds ?? []).includes(dto.roomId)
      ) {
        throw new ForbiddenException('Bạn chưa đăng ký trạng thái phòng');
      }

      const onlineUserIds = await this.getOnlineUserIds(
        dto.roomId,
        socket.data.userId,
      );
      const wasOnline = onlineUserIds.includes(socket.data.userId);
      const addedToSet = await this.refreshRoomPresence(
        dto.roomId,
        socket.data.userId,
      );
      if (!wasOnline && addedToSet) {
        this.publisher.publishRoomPresenceChanged(socket.id, {
          actorId: socket.data.userId,
          roomId: dto.roomId,
          userId: socket.data.userId,
          online: true,
        });
      }
    } catch (error) {
      this.sendExpectedError(socket, error);
    }
  }

  @SubscribeMessage('room:presence:unsubscribe')
  async handleRoomPresenceUnsubscribe(socket: Socket, data: unknown) {
    try {
      const dto = await this.validatePayload(RoomIdDto, data);
      await this.roomAccess.assertRoomAccess(socket.data.userId, dto.roomId);
      if (!(socket.data.presenceRoomIds ?? []).includes(dto.roomId)) {
        throw new ForbiddenException('Bạn chưa đăng ký trạng thái phòng');
      }
      await this.removeRoomPresence(socket, dto.roomId, true);
    } catch (error) {
      this.sendExpectedError(socket, error);
    }
  }

  @SubscribeMessage('chat:send')
  async handleChatSend(socket: Socket, data: unknown) {
    try {
      const dto = await this.validatePayload(ChatSendDto, data);
      const result = await this.chat.sendMessage(
        socket.data.userId,
        socket.data.displayName,
        dto,
      );
      if (!result.created) return;

      const seq = await this.chat.nextSequence(dto.roomId);
      this.publisher.publishChatMessage({
        seq,
        actorId: socket.data.userId,
        roomId: dto.roomId,
        meetingId: dto.meetingId ?? null,
        message: result.message,
      });
    } catch (error) {
      this.sendExpectedError(socket, error);
    }
  }

  // Vào board của meeting: thành viên + meeting ACTIVE → vào kênh TRƯỚC rồi mới đọc snapshot,
  // để op phát ra ở giữa vẫn tới (LWW không phụ thuộc thứ tự) — spec whiteboard §3.1
  @SubscribeMessage('meeting:join')
  async handleMeetingJoin(socket: Socket, data: unknown) {
    try {
      const dto = await this.validatePayload(MeetingIdDto, data);
      const { roomId } = await this.whiteboard.assertCanJoin(socket.data.userId, dto.meetingId);
      await socket.join(`meeting:${dto.meetingId}`);
      // roomId của meeting giữ trên kết nối (không phải state server) để gắn envelope cho wb:*
      socket.data.meetingRoomIds = { ...socket.data.meetingRoomIds, [dto.meetingId]: roomId };
      let snapshot: Awaited<ReturnType<WhiteboardService['getSnapshot']>>;
      try {
        snapshot = await this.whiteboard.getSnapshot(dto.meetingId);
      } catch (snapshotError) {
        // Không để socket nằm trong kênh mà không có snapshot (sẽ nhận op rời rạc trên nền sai)
        await socket.leave(`meeting:${dto.meetingId}`);
        throw snapshotError;
      }
      this.publisher.sendSnapshot(socket, {
        seq: snapshot.seq,
        actorId: socket.data.userId,
        roomId,
        meetingId: dto.meetingId,
        elements: snapshot.elements,
      });
    } catch (error) {
      this.sendExpectedError(socket, error);
    }
  }

  @SubscribeMessage('meeting:leave')
  async handleMeetingLeave(socket: Socket, data: unknown) {
    try {
      const dto = await this.validatePayload(MeetingIdDto, data);
      await socket.leave(`meeting:${dto.meetingId}`);
    } catch (error) {
      this.sendExpectedError(socket, error);
    }
  }

  // Nét vẽ: validate → Lua merge LWW (atomic) → phát element thắng → thử lưu nền. Không query Mongo mỗi op
  @SubscribeMessage('wb:ops')
  async handleWhiteboardOps(socket: Socket, data: unknown) {
    try {
      const dto = await this.validatePayload(WbOpsDto, data);
      const roomId = this.assertInMeeting(socket, dto.meetingId);
      const invalid = validateElementsBatch(dto.elements);
      if (invalid) throw new BadRequestException(invalid);

      const result = await this.whiteboard.applyOps(dto.meetingId, dto.elements as WbElement[]);
      if (!result) return;
      this.publisher.publishWbOps(socket.id, {
        seq: result.seq,
        actorId: socket.data.userId,
        roomId,
        meetingId: dto.meetingId,
        elements: result.winners,
      });
      this.whiteboard.tryPersistInBackground(dto.meetingId);
    } catch (error) {
      this.sendExpectedError(socket, error);
    }
  }

  // Con trỏ: chỉ chuyển tiếp, không Redis, không seq, không lưu
  @SubscribeMessage('wb:pointer')
  async handleWhiteboardPointer(socket: Socket, data: unknown) {
    try {
      const dto = await this.validatePayload(WbPointerDto, data);
      const roomId = this.assertInMeeting(socket, dto.meetingId);
      this.publisher.publishWbPointer(socket.id, {
        actorId: socket.data.userId,
        displayName: socket.data.displayName,
        roomId,
        meetingId: dto.meetingId,
        x: dto.x,
        y: dto.y,
        tool: dto.tool,
        button: dto.button,
      });
    } catch (error) {
      this.sendExpectedError(socket, error);
    }
  }

  // AI sinh sơ đồ (spec AI §3): thành viên đang ở kênh meeting → service → trả RIÊNG socket này.
  // Không broadcast: sơ đồ tới người khác qua wb:ops khi trình duyệt người yêu cầu chèn vào bảng
  @SubscribeMessage('ai:generate')
  async handleAiGenerate(socket: Socket, data: unknown) {
    try {
      const dto = await this.validatePayload(AiGenerateDto, data);
      const roomId = this.assertInMeeting(socket, dto.meetingId);
      const outcome = await this.ai.generate({
        userId: socket.data.userId,
        roomId,
        meetingId: dto.meetingId,
        requestId: dto.requestId,
        prompt: dto.prompt,
        kind: dto.kind,
      });
      const target = { actorId: socket.data.userId, roomId, meetingId: dto.meetingId, requestId: dto.requestId };
      if (outcome.ok) this.publisher.sendAiResult(socket, { ...target, diagram: outcome.diagram });
      else this.publisher.sendAiStatus(socket, { ...target, code: outcome.code, message: outcome.message });
    } catch (error) {
      this.sendExpectedError(socket, error);
    }
  }

  // Socket phải đang ở kênh meeting (đã join, chưa bị kick / meeting chưa kết thúc) — kiểm trong RAM, không query
  private assertInMeeting(socket: Socket, meetingId: string): string {
    const roomId: string | undefined = socket.data.meetingRoomIds?.[meetingId];
    if (!roomId || !socket.rooms.has(`meeting:${meetingId}`)) {
      throw new ForbiddenException('Bạn chưa vào buổi học này');
    }
    return roomId;
  }

  private async validatePayload<T extends object>(
    dtoType: new () => T,
    data: unknown,
  ): Promise<T> {
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      throw new BadRequestException('Payload không hợp lệ');
    }
    const dto = plainToInstance(dtoType, data);
    const errors = await validate(dto, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });
    if (errors.length) {
      const messages = errors.flatMap((error) =>
        Object.values(error.constraints ?? {}),
      );
      throw new BadRequestException(messages);
    }
    return dto;
  }

  private async getOnlineUserIds(roomId: string, actorId: string): Promise<string[]> {
    const key = this.roomPresenceKey(roomId);
    const userIds = await this.redis.smembers(key);
    const onlineUserIds: string[] = [];

    for (const userId of userIds) {
      if (await this.redis.get(this.roomPresenceUserKey(roomId, userId))) {
        onlineUserIds.push(userId);
      } else if (await this.redis.srem(key, userId)) {
        this.publisher.publishRoomPresenceChanged(null, {
          actorId,
          roomId,
          userId,
          online: false,
        });
      }
    }

    return onlineUserIds;
  }

  private async refreshRoomPresence(
    roomId: string,
    userId: string,
  ): Promise<boolean> {
    const addedToSet = await this.redis.sadd(
      this.roomPresenceKey(roomId),
      userId,
    );
    await this.redis.set(
      this.roomPresenceUserKey(roomId, userId),
      '1',
      ROOM_PRESENCE_TTL_SECONDS,
    );
    await this.redis.expire(
      this.roomPresenceKey(roomId),
      ROOM_PRESENCE_TTL_SECONDS,
    );
    return addedToSet > 0;
  }

  private async removeRoomPresence(
    socket: Socket,
    roomId: string,
    leaveChannel: boolean,
  ) {
    const channel = `room-page:${roomId}`;
    if (leaveChannel) await socket.leave(channel);
    socket.data.presenceRoomIds = (socket.data.presenceRoomIds ?? []).filter(
      (id: string) => id !== roomId,
    );

    const remainingSockets = await socket.nsp.in(channel).fetchSockets();
    const hasOtherSocket = remainingSockets.some(
      (remainingSocket) => remainingSocket.data.userId === socket.data.userId,
    );
    if (hasOtherSocket) return;

    const key = this.roomPresenceKey(roomId);
    const removed = await this.redis.srem(key, socket.data.userId);
    await this.redis.del(this.roomPresenceUserKey(roomId, socket.data.userId));
    if (removed) {
      this.publisher.publishRoomPresenceChanged(socket.id, {
        actorId: socket.data.userId,
        roomId,
        userId: socket.data.userId,
        online: false,
      });
    }
  }

  private roomPresenceKey(roomId: string) {
    return `room-presence:${roomId}`;
  }

  private roomPresenceUserKey(roomId: string, userId: string) {
    return `room-presence:${roomId}:user:${userId}`;
  }

  private sendExpectedError(socket: Socket, error: unknown) {
    if (!(error instanceof HttpException)) throw error;
    const response = error.getResponse();
    this.publisher.sendError(socket, {
      statusCode: error.getStatus(),
      error: error.name,
      message:
        typeof response === 'string'
          ? response
          : ((response as { message?: string | string[] }).message ??
            error.message),
    });
  }
}

function isJwtTokenError(error: unknown): boolean {
  const name = (error as { name?: unknown } | null)?.name;
  return (
    name === 'JsonWebTokenError' ||
    name === 'TokenExpiredError' ||
    name === 'NotBeforeError'
  );
}
