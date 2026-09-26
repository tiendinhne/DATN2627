import { Body, Controller, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RoomsService } from './rooms.service.js';
import { CreateRoomDto } from './dto/create-room.dto.js';
import { JoinRoomDto } from './dto/join-room.dto.js';

// Mọi route room đều cần đăng nhập (ADR-008).
// req.user là user đã xác thực (JwtStrategy.validate trả về document User → dùng req.user.id).
@UseGuards(JwtAuthGuard)
@Controller('rooms')
export class RoomsController {
  constructor(private roomsService: RoomsService) {}

  // POST /rooms  { name, description? }
  @Post()
  create(@Req() req: any, @Body() dto: CreateRoomDto) {
    return this.roomsService.createRoom(req.user.id, dto);
  }

  // POST /rooms/join  { code } — link /join/:code ở frontend gọi cùng API này
  @Post('join')
  @HttpCode(200)
  join(@Req() req: any, @Body() dto: JoinRoomDto) {
    return this.roomsService.joinRoom(req.user.id, dto.code);
  }
}
