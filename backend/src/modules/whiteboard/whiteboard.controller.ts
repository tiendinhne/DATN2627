import { Controller, Get, Param, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { WhiteboardService } from './whiteboard.service.js';

// REST của whiteboard — chỉ phần xem lại; bảng live đi qua Socket.IO (meeting.gateway)
@UseGuards(JwtAuthGuard)
@Controller()
export class WhiteboardController {
  constructor(private whiteboard: WhiteboardService) {}

  // GET /meetings/:meetingId/whiteboard — bảng đã lưu của buổi đã kết thúc, chỉ để xem
  @Get('meetings/:meetingId/whiteboard')
  getEnded(@Req() req: any, @Param('meetingId') meetingId: string) {
    return this.whiteboard.getEndedBoard(req.user.id, meetingId);
  }
}
