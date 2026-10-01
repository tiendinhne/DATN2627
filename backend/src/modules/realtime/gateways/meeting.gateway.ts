import { WebSocketGateway, WebSocketServer, OnGatewayConnection, OnGatewayDisconnect, SubscribeMessage } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UseGuards, HttpCode } from '@nestjs/common';

@WebSocketGateway({
  cors: {
    origin: (process.env.FRONTEND_URL || 'http://localhost:3000').split(','),
    credentials: true,
  },
  transports: ['websocket'],
  namespace: '/meeting',
})
export class MeetingGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(MeetingGateway.name);

  handleConnection(socket: Socket) {
    this.logger.log(`Client connected: ${socket.id}`);
  }

  handleDisconnect(socket: Socket) {
    this.logger.log(`Client disconnected: ${socket.id}`);
  }

  @SubscribeMessage('meeting:join')
  handleMeetingJoin(socket: Socket, data: any) {
    this.logger.log(`Meeting join from ${socket.id}:`, data);
  }

  @SubscribeMessage('chat:send')
  handleChatSend(socket: Socket, data: any) {
    this.logger.log(`Chat message from ${socket.id}:`, data);
  }

  @SubscribeMessage('wb:ops')
  handleWhiteboardOps(socket: Socket, data: any) {
    this.logger.log(`Whiteboard ops from ${socket.id}:`, data);
  }
}
