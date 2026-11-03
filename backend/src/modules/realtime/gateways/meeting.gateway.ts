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
    private readonly chat: ChatService,
    private readonly publisher: RealtimePublisher,
    private readonly whiteboard: WhiteboardService,
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

  handleDisconnect(socket: Socket) {
    this.logger.log(`Client disconnected: ${socket.id}`);
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
      });
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
