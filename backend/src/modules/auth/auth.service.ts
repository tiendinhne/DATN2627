import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { UsersService } from '../users/users.service.js';
import { RegisterDto } from './dto/register.dto.js';
import type { UserDocument } from '../users/schemas/user.schema.js';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
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

  async validateGoogleUser(data: {
    googleId: string;
    email?: string;
    displayName: string;
    avatarUrl?: string;
  }): Promise<UserDocument> {
    if (!data.email) {
      throw new UnauthorizedException('Không lấy được email từ tài khoản Google');
    }

    const existingByGoogleId = await this.usersService.findByGoogleId(data.googleId);
    if (existingByGoogleId) return existingByGoogleId;

    const existingByEmail = await this.usersService.findByEmail(data.email);
    if (existingByEmail) {
      return this.usersService.linkGoogleAccount(
        existingByEmail.id,
        data.googleId,
        data.avatarUrl,
      );
    }

    const uniqueUsername = await this.usersService.ensureUniqueUsername(
      data.displayName.toLowerCase(),
    );

    return this.usersService.createGoogleUser({
      email: data.email,
      username: uniqueUsername,
      googleId: data.googleId,
      displayName: data.displayName,
      avatarUrl: data.avatarUrl,
    });
  }

  private buildAuthResponse(user: UserDocument) {
    const userId = this.getUserId(user);
    const payload = {
      sub: userId,
      email: user.email,
      username: user.username,
      provider: user.providers,
    };
    const accessToken = this.jwtService.sign(payload);

    return {
      accessToken,
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

  // Mongoose Document không khai báo sẵn property "id" trong kiểu TypeScript,
  // nên lấy trực tiếp từ "_id" và convert sang string cho nhất quán.
  private getUserId(user: UserDocument): string {
    return (user as any)._id.toString();
  }
}
