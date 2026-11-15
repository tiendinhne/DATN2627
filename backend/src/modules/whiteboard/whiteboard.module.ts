import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PassportModule } from '@nestjs/passport';
import { Whiteboard, WhiteboardSchema } from './schemas/whiteboard.schema.js';
import { Meeting, MeetingSchema } from '../meetings/schemas/meeting.schema.js';
import { RoomMembersModule } from '../room-members/room-members.module.js';
import { WhiteboardService } from './whiteboard.service.js';
import { WhiteboardController } from './whiteboard.controller.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Whiteboard.name, schema: WhiteboardSchema },
      // Meeting: kiểm ACTIVE khi join, lấy roomId khi lưu — đăng ký trực tiếp để không import MeetingsModule (tránh vòng)
      { name: Meeting.name, schema: MeetingSchema },
    ]),
    // RoomAccessService để kiểm thành viên khi meeting:join
    RoomMembersModule,
    // JwtAuthGuard cần AuthModuleOptions trong module dùng nó (bài học Task 10 module room)
    PassportModule.register({ session: false }),
  ],
  // GET /meetings/:meetingId/whiteboard — xem lại bảng của buổi đã kết thúc
  controllers: [WhiteboardController],
  providers: [WhiteboardService],
  // RealtimeModule (gateway) và MeetingsModule (lưu bản cuối) dùng
  exports: [WhiteboardService],
})
export class WhiteboardModule {}
