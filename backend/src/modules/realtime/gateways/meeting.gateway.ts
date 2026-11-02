import {
  WebSocketGateway,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
} from '@nestjs/websockets';
import {
  BadRequestException,
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

  @SubscribeMessage('wb:ops')
  handleWhiteboardOps(socket: Socket, data: any) {
    this.logger.log(`Whiteboard ops from ${socket.id}:`, data);
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
