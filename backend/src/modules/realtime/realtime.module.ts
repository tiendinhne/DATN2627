import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { ChatModule } from '../chat/chat.module.js';
import { RoomMembersModule } from '../room-members/room-members.module.js';
import { UsersModule } from '../users/users.module.js';
import { WhiteboardModule } from '../whiteboard/whiteboard.module.js';
import { AiAssistantModule } from '../ai-assistant/ai-assistant.module.js';
import { MeetingGateway } from './gateways/meeting.gateway.js';
import { RealtimePublisher } from './realtime-publisher.service.js';

@Module({
  // AiAssistantModule: gateway gọi AiAssistantService cho ai:generate
  imports: [AuthModule, ChatModule, RoomMembersModule, UsersModule, WhiteboardModule, AiAssistantModule],
  providers: [MeetingGateway, RealtimePublisher],
  exports: [RealtimePublisher],
})
export class RealtimeModule {}
