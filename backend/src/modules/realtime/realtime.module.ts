import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { ChatModule } from '../chat/chat.module.js';
import { RoomMembersModule } from '../room-members/room-members.module.js';
import { UsersModule } from '../users/users.module.js';
import { MeetingGateway } from './gateways/meeting.gateway.js';
import { RealtimePublisher } from './realtime-publisher.service.js';

@Module({
  imports: [AuthModule, ChatModule, RoomMembersModule, UsersModule],
  providers: [MeetingGateway, RealtimePublisher],
  exports: [RealtimePublisher],
})
export class RealtimeModule {}
