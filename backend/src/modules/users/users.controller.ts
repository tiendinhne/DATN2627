import { Body, Controller, Get, Patch, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { UsersService } from './users.service.js';
import { UpdateProfileDto } from './dto/update-profile.dto.js';

// Thông tin tài khoản của chính người đang đăng nhập.
// req.user là document User do JwtStrategy.validate trả về (đọc mới từ DB mỗi request).
// Đổi mật khẩu nằm ở POST /auth/password vì cần cookie refresh (path /auth) — ADR-025.
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  // GET /users/me
  @Get('me')
  getMe(@Req() req: any) {
    return this.usersService.toProfile(req.user);
  }

  // PATCH /users/me  { displayName }
  @Patch('me')
  updateMe(@Req() req: any, @Body() dto: UpdateProfileDto) {
    return this.usersService.updateDisplayName(req.user.id, dto.displayName);
  }
}
