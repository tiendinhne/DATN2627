import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { UsersService } from '../users/users.service.js';
import { RefreshToken } from './schemas/refresh-token.schema.js';
import { RegisterDto } from './dto/register.dto.js';
import type { UserDocument } from '../users/schemas/user.schema.js';

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

  private async buildAuthResponse(user: UserDocument) {
    const userId = this.getUserId(user);
    const payload = {
      sub: userId,
      email: user.email,
      username: user.username,
      provider: user.providers,
    };
    const accessToken = this.jwtService.sign(payload);
    const refreshToken = await this.generateRefreshToken(userId);

    return {
      accessToken,
      refreshToken,
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
    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await this.refreshTokenModel.create({
      userId,
      tokenHash,
      expiresAt,
    });

    return token;
  }

  private getUserId(user: UserDocument): string {
    return (user as any)._id.toString();
  }
}
