import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PassportModule } from '@nestjs/passport';
import { Meeting, MeetingSchema } from './schemas/meeting.schema.js';
import { MeetingParticipant, MeetingParticipantSchema } from './schemas/meeting-participant.schema.js';
import { Room, RoomSchema } from '../rooms/schemas/room.schema.js';
import { RoomMembersModule } from '../room-members/room-members.module.js';
import { MeetingsController } from './meetings.controller.js';
import { MeetingsService } from './meetings.service.js';
import { MEDIA_PORT } from './ports/media.port.js';
import { LivekitMediaAdapter } from './adapters/livekit-media.adapter.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Meeting.name, schema: MeetingSchema },
      { name: MeetingParticipant.name, schema: MeetingParticipantSchema },
      // Room: $inc meetingCount, đọc status khi hệ thống tự kết thúc meeting
      { name: Room.name, schema: RoomSchema },
    ]),
    // RoomAccessService để kiểm quyền
    RoomMembersModule,
    // JwtAuthGuard cần AuthModuleOptions trong module dùng nó (bài học Task 10 module room)
    PassportModule.register({ session: false }),
  ],
  controllers: [MeetingsController],
  // Port "media" cài bằng LiveKit — đổi vendor chỉ đổi useClass (ràng buộc 9)
  providers: [MeetingsService, { provide: MEDIA_PORT, useClass: LivekitMediaAdapter }],
  // RoomsService gọi khi kick / rời / giải tán (Task 7)
  exports: [MeetingsService],
})
export class MeetingsModule {}
