import { Body, Controller, Get, HttpCode, Patch, Post, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { AuthService, REFRESH_TOKEN_TTL_MS } from './auth.service.js';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { UpdateProfileDto } from './dto/update-profile.dto.js';
import { LocalAuthGuard } from './guards/local-auth.guard.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import { GoogleAuthGuard } from './guards/google-auth.guard.js';

// Refresh token nằm trong cookie httpOnly (PROJECT_CONTEXT §5) — JS của trang không đọc được.
// path /auth: trình duyệt chỉ gửi cookie kèm request tới /auth/* (refresh, logout).
const REFRESH_COOKIE = 'refresh_token';

// Đọc 1 cookie từ header Cookie (không cài thêm cookie-parser)
function readCookie(req: Request, name: string): string | undefined {
  const pair = req.headers.cookie
    ?.split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${name}=`));
  return pair ? decodeURIComponent(pair.slice(name.length + 1)) : undefined;
}

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private configService: ConfigService,
  ) {}

  // POST /auth/register  { email, username, displayName, password }
  // Trả { accessToken, user }; refresh token đi vào cookie, KHÔNG nằm trong body
  @Post('register')
  async register(@Body() dto: RegisterDto, @Res({ passthrough: true }) res: Response) {
    const { refreshToken, ...body } = await this.authService.register(dto);
    this.setRefreshCookie(res, refreshToken);
    return body;
  }

  // POST /auth/login  { identifier, password }
  // LocalAuthGuard tự động gọi LocalStrategy.validate() trước khi vào hàm này,
  // nếu hợp lệ thì req.user sẽ chứa user đã xác thực.
  @UseGuards(LocalAuthGuard)
  @Post('login')
  async login(@Body() _dto: LoginDto, @Req() req: any, @Res({ passthrough: true }) res: Response) {
    const { refreshToken, ...body } = await this.authService.login(req.user);
    this.setRefreshCookie(res, refreshToken);
    return body;
  }

  // POST /auth/refresh — cookie refresh_token → { accessToken, user } + cookie mới (xoay vòng)
  @Post('refresh')
  @HttpCode(200)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const { refreshToken, ...body } = await this.authService.refresh(readCookie(req, REFRESH_COOKIE));
    // null = ân hạn (tab khác vừa xoay vòng) → giữ nguyên cookie trình duyệt đang có
    if (refreshToken) this.setRefreshCookie(res, refreshToken);
    return body;
  }

  // POST /auth/logout — thu hồi refresh token + xoá cookie (JS không xoá được cookie httpOnly)
  @Post('logout')
  @HttpCode(204)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.authService.logout(readCookie(req, REFRESH_COOKIE));
    res.clearCookie(REFRESH_COOKIE, this.cookieOptions());
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
    const { refreshToken } = await this.authService.login(req.user);
    const frontendUrl = this.configService.get<string>('FRONTEND_URL');

    // Không đưa token lên query string (PROJECT_CONTEXT §16: lọt vào history, log, Referer).
    // Chỉ đặt cookie refresh; trang /auth/callback tải lại → AuthProvider gọi /auth/refresh lấy access token.
    this.setRefreshCookie(res, refreshToken);
    return res.redirect(`${frontendUrl}/auth/callback`);
  }

  // GET /auth/me -> lấy thông tin user hiện tại, yêu cầu header Authorization: Bearer <token>
  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getProfile(@Req() req: any) {
    return req.user;
  }

  // PATCH /auth/me -> cập nhật tên hiển thị user hiện tại
  @UseGuards(JwtAuthGuard)
  @Patch('me')
  async updateProfile(@Req() req: any, @Body() dto: UpdateProfileDto) {
    return this.authService.updateProfile(req.user.id, dto.displayName);
  }

  // sameSite lax: frontend và backend cùng site (localhost:3000/3001 khi dev, app./api.<domain> khi deploy)
  // nên lax đủ dùng, chặt hơn None của §5 [phát sinh kỹ thuật]. secure khi production (HTTPS).
  private cookieOptions() {
    return {
      httpOnly: true,
      sameSite: 'lax' as const,
      secure: this.configService.get<string>('NODE_ENV') === 'production',
      path: '/auth',
    };
  }

  private setRefreshCookie(res: Response, refreshToken: string) {
    res.cookie(REFRESH_COOKIE, refreshToken, { ...this.cookieOptions(), maxAge: REFRESH_TOKEN_TTL_MS });
  }
}
