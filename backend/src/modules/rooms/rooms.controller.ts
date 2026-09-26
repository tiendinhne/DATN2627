import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RoomsService } from './rooms.service.js';
import { CreateRoomDto } from './dto/create-room.dto.js';
import { JoinRoomDto } from './dto/join-room.dto.js';
import { ListRoomsQueryDto } from './dto/list-rooms-query.dto.js';
import { UpdateRoomDto } from './dto/update-room.dto.js';

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

  // GET /rooms?page=1&limit=20 — phòng của tôi
  @Get()
  list(@Req() req: any, @Query() query: ListRoomsQueryDto) {
    return this.roomsService.listMyRooms(req.user.id, query.page, query.limit);
  }

  // GET /rooms/:roomId
  @Get(':roomId')
  get(@Req() req: any, @Param('roomId') roomId: string) {
    return this.roomsService.getRoom(req.user.id, roomId);
  }

  // PATCH /rooms/:roomId  { name?, description? } — chỉ HOST
  @Patch(':roomId')
  update(@Req() req: any, @Param('roomId') roomId: string, @Body() dto: UpdateRoomDto) {
    return this.roomsService.updateRoom(req.user.id, roomId, dto);
  }

  // GET /rooms/:roomId/members
  @Get(':roomId/members')
  members(@Req() req: any, @Param('roomId') roomId: string) {
    return this.roomsService.listMembers(req.user.id, roomId);
  }

  // DELETE /rooms/:roomId/members/:userId — HOST kick thành viên
  @Delete(':roomId/members/:userId')
  @HttpCode(204)
  kick(@Req() req: any, @Param('roomId') roomId: string, @Param('userId') userId: string) {
    return this.roomsService.kickMember(req.user.id, roomId, userId);
  }
}
