import { Body, Controller, Get, HttpCode, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { MeetingsService } from './meetings.service.js';
import { StartMeetingDto } from './dto/start-meeting.dto.js';
import { ListMeetingsQueryDto } from './dto/list-meetings-query.dto.js';

// Mọi route meeting đều cần đăng nhập (ADR-008).
// req.user là document User (JwtStrategy.validate) → dùng req.user.id, req.user.displayName
@UseGuards(JwtAuthGuard)
@Controller()
export class MeetingsController {
  constructor(private meetings: MeetingsService) {}

  // POST /rooms/:roomId/meetings  { title } — HOST bắt đầu buổi học
  @Post('rooms/:roomId/meetings')
  start(@Req() req: any, @Param('roomId') roomId: string, @Body() dto: StartMeetingDto) {
    return this.meetings.startMeeting(req.user.id, roomId, dto);
  }

  // GET /rooms/:roomId/meetings?page=1&limit=20 — lịch sử buổi học của phòng
  @Get('rooms/:roomId/meetings')
  list(@Req() req: any, @Param('roomId') roomId: string, @Query() query: ListMeetingsQueryDto) {
    return this.meetings.listMeetings(req.user.id, roomId, query.page, query.limit);
  }

  // POST /meetings/:meetingId/join — trả { token, livekitUrl, myRole, meeting }
  @Post('meetings/:meetingId/join')
  @HttpCode(200)
  join(@Req() req: any, @Param('meetingId') meetingId: string) {
    return this.meetings.joinMeeting(req.user.id, req.user.displayName, meetingId);
  }

  // POST /meetings/:meetingId/end — HOST kết thúc buổi học cho mọi người
  @Post('meetings/:meetingId/end')
  @HttpCode(204)
  end(@Req() req: any, @Param('meetingId') meetingId: string) {
    return this.meetings.endByHost(req.user.id, meetingId);
  }
}
