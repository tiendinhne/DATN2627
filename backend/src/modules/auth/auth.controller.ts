import { Body, Controller, Get, Post, Req, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service.js';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { LocalAuthGuard } from './guards/local-auth.guard.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import { GoogleAuthGuard } from './guards/google-auth.guard.js';

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private configService: ConfigService,
  ) {}

  // POST /auth/register  { email, username, password }
  @Post('register')
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  // POST /auth/login  { identifier, password }
  // LocalAuthGuard tự động gọi LocalStrategy.validate() trước khi vào hàm này,
  // nếu hợp lệ thì req.user sẽ chứa user đã xác thực.
  @UseGuards(LocalAuthGuard)
  @Post('login')
  async login(@Body() _dto: LoginDto, @Req() req: any) {
    return this.authService.login(req.user);
  }

  // GET /auth/google -> Guard tự động redirect người dùng sang trang đăng nhập Google
  @UseGuards(GoogleAuthGuard)
  @Get('google')
  async googleAuth() {
    // Không cần code, GoogleAuthGuard xử lý redirect
  }

  // GET /auth/google/callback -> Google redirect về đây sau khi người dùng đồng ý
  @UseGuards(GoogleAuthGuard)
  @Get('google/callback')
  async googleAuthCallback(@Req() req: any, @Res() res: Response) {
    const { accessToken } = await this.authService.login(req.user);
    const frontendUrl = this.configService.get<string>('FRONTEND_URL');

    // Redirect về frontend kèm token trên query string.
    // Frontend sẽ đọc token này ở trang /auth/callback rồi lưu lại (xem frontend-example).
    return res.redirect(`${frontendUrl}/auth/callback?token=${accessToken}`);
  }

  // GET /auth/me -> lấy thông tin user hiện tại, yêu cầu header Authorization: Bearer <token>
  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getProfile(@Req() req: any) {
    return req.user;
  }
}
