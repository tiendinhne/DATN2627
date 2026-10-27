import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { UsersService } from '../users/users.service.js';
import { RefreshToken } from './schemas/refresh-token.schema.js';
import { RegisterDto } from './dto/register.dto.js';
import type { UserDocument } from '../users/schemas/user.schema.js';

// Refresh token sống 7 ngày; controller dùng cùng giá trị cho maxAge của cookie
export const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;
// Token vừa bị xoay vòng vẫn được nhận trong 10 giây: 2 tab (trang phòng + trang cuộc gọi)
// làm mới cùng lúc bằng cùng một cookie → tab tới sau không bị đăng xuất
const ROTATION_GRACE_MS = 10_000;
// Refresh token = 32 byte ngẫu nhiên dạng hex → kiểm định dạng trước khi đụng DB (ràng buộc 3)
const REFRESH_TOKEN_FORMAT = /^[a-f0-9]{64}$/;

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    @InjectModel(RefreshToken.name) private refreshTokenModel: Model<RefreshToken>,
  ) {}

  async register(dto: RegisterDto) {
    const existingEmail = await this.usersService.findByEmail(dto.email);
    if (existingEmail) {
      throw new BadRequestException('Email đã được sử dụng');
    }
    const existingUsername = await this.usersService.findByUsername(dto.username);
    if (existingUsername) {
      throw new BadRequestException('Username đã được sử dụng');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);
    const user = await this.usersService.createLocalUser({
      email: dto.email,
      username: dto.username,
      displayName: dto.displayName,
      password: hashedPassword,
    });

    return this.buildAuthResponse(user);
  }

  // Được LocalStrategy gọi để kiểm tra username/email + password
  async validateLocalUser(identifier: string, password: string): Promise<UserDocument | null> {
    const user = await this.usersService.findByIdentifier(identifier);

    // Không tìm thấy user, hoặc user đó chỉ đăng ký qua Google (không có password)
    if (!user || !user.password) {
      return null;
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return null;

    return user;
  }

  async login(user: UserDocument) {
    return this.buildAuthResponse(user);
  }

  async updateProfile(userId: string, displayName: string) {
    const user = await this.usersService.updateDisplayName(userId, displayName);
    if (!user) {
      throw new NotFoundException('Không tìm thấy tài khoản');
    }

    return {
      id: this.getUserId(user),
      email: user.email,
      username: user.username,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
    };
  }

  // Được GoogleStrategy gọi sau khi Google xác thực thành công
  async validateGoogleUser(data: {
    googleId: string;
    email?: string;
    displayName: string;
    avatarUrl?: string;
  }): Promise<UserDocument> {
    if (!data.email) {
      throw new UnauthorizedException('Không lấy được email từ tài khoản Google');
    }

    // Trường hợp 1: đã từng đăng nhập Google trước đó
    const existingByGoogleId = await this.usersService.findByGoogleId(data.googleId);
    if (existingByGoogleId) return existingByGoogleId;

    // Trường hợp 2: email đã đăng ký local trước đó -> liên kết Google vào tài khoản này
    const existingByEmail = await this.usersService.findByEmail(data.email);
    if (existingByEmail) {
      return this.usersService.linkGoogleAccount(
        existingByEmail.id,
        data.googleId,
        data.avatarUrl,
      );
    }

    // Trường hợp 3: user hoàn toàn mới -> tạo tài khoản chỉ dùng Google, không có password
    const uniqueUsername = await this.usersService.ensureUniqueUsername(
      data.displayName.toLowerCase(),
    );

    return this.usersService.createGoogleUser({
      email: data.email,
      username: uniqueUsername,
      displayName: data.displayName,
      googleId: data.googleId,
      avatarUrl: data.avatarUrl,
    });
  }

  // POST /auth/refresh — đổi refresh token (cookie) lấy access token mới, xoay vòng refresh token.
  // refreshToken trả về = null khi chỉ cấp access token (ân hạn) → controller giữ nguyên cookie.
  async refresh(rawToken: string | undefined) {
    if (!rawToken || !REFRESH_TOKEN_FORMAT.test(rawToken)) {
      throw new UnauthorizedException('Phiên đăng nhập không hợp lệ');
    }

    const doc = await this.refreshTokenModel.findOne({ tokenHash: this.hashToken(rawToken) }).lean().exec();
    // TTL index của Mongo xoá token hết hạn chậm tới ~60 giây → vẫn tự kiểm expiresAt
    if (!doc || doc.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException('Phiên đăng nhập đã hết hạn');
    }

    if (doc.revokedAt) {
      // Chỉ token bị XOAY VÒNG (có replacedByTokenHash) mới được ân hạn; token bị đăng xuất thì không
      const recentlyRotated =
        doc.replacedByTokenHash && Date.now() - doc.revokedAt.getTime() <= ROTATION_GRACE_MS;
      if (!recentlyRotated) {
        throw new UnauthorizedException('Phiên đăng nhập đã bị thu hồi');
      }
    }

    const user = await this.usersService.findById(doc.userId.toString());
    if (!user) {
      throw new UnauthorizedException('Tài khoản không còn tồn tại');
    }

    // Ân hạn: tab khác vừa xoay vòng → cookie trình duyệt đã là token mới, chỉ cấp access token
    if (doc.revokedAt) {
      return { ...this.issueAccessToken(user), refreshToken: null };
    }

    // Xoay vòng: thu hồi có điều kiện revokedAt: null → 2 request cùng lúc chỉ 1 cái thắng
    const next = this.newRefreshToken();
    const claimed = await this.refreshTokenModel
      .findOneAndUpdate(
        { _id: doc._id, revokedAt: null },
        { $set: { revokedAt: new Date(), replacedByTokenHash: next.tokenHash } },
      )
      .lean()
      .exec();
    if (!claimed) {
      // Thua cuộc đua: request kia đã xoay vòng và đặt cookie mới → coi như ân hạn
      return { ...this.issueAccessToken(user), refreshToken: null };
    }

    await this.refreshTokenModel.create({
      userId: doc.userId,
      tokenHash: next.tokenHash,
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
    });
    return { ...this.issueAccessToken(user), refreshToken: next.token };
  }

  // POST /auth/logout — thu hồi refresh token đang dùng. Không có / sai định dạng → bỏ qua (idempotent)
  async logout(rawToken: string | undefined) {
    if (!rawToken || !REFRESH_TOKEN_FORMAT.test(rawToken)) return;
    await this.refreshTokenModel
      .updateOne({ tokenHash: this.hashToken(rawToken), revokedAt: null }, { $set: { revokedAt: new Date() } })
      .exec();
  }

  private async buildAuthResponse(user: UserDocument) {
    const refreshToken = await this.generateRefreshToken(this.getUserId(user));
    return { ...this.issueAccessToken(user), refreshToken };
  }

  // Access token (JWT 15 phút) + thông tin user trả cho frontend
  private issueAccessToken(user: UserDocument) {
    const userId = this.getUserId(user);
    const payload = {
      sub: userId,
      email: user.email,
      username: user.username,
      provider: user.providers,
    };
    return {
      accessToken: this.jwtService.sign(payload),
      user: {
        id: userId,
        email: user.email,
        username: user.username,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        provider: user.providers,
      },
    };
  }

  private async generateRefreshToken(userId: string): Promise<string> {
    const { token, tokenHash } = this.newRefreshToken();
    await this.refreshTokenModel.create({
      userId,
      tokenHash,
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
    });
    return token;
  }

  // Token gốc chỉ gửi cho trình duyệt (cookie); Mongo chỉ lưu hash
  private newRefreshToken() {
    const token = crypto.randomBytes(32).toString('hex');
    return { token, tokenHash: this.hashToken(token) };
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private getUserId(user: UserDocument): string {
    return (user as any)._id.toString();
  }
}
