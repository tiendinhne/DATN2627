import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersModule } from './modules/users/users.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { RoomsModule } from './modules/rooms/rooms.module.js';
import { MeetingsModule } from './modules/meetings/meetings.module.js';
import { RoomMembersModule } from './modules/room-members/room-members.module.js';
import { ChatModule } from './modules/chat/chat.module.js';
import { WhiteboardModule } from './modules/whiteboard/whiteboard.module.js';
import { RealtimeModule } from './modules/realtime/realtime.module.js';
import { AiAssistantModule } from './modules/ai-assistant/ai-assistant.module.js';
import { RedisModule } from './common/redis.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    RedisModule,
    MongooseModule.forRoot(
      process.env.MONGO_URI ?? 'mongodb://localhost:27017/online-group-learning',
    ),
    UsersModule,
    AuthModule,
    RoomsModule,
    MeetingsModule,
    RoomMembersModule,
    ChatModule,
    WhiteboardModule,
    RealtimeModule,
    AiAssistantModule,
  ],
})
export class AppModule {}
