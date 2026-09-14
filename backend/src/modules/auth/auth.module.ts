import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import type { JwtModuleOptions } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { UsersModule } from '../users/users.module.js';
import { AuthService } from './auth.service.js';
import { AuthController } from './auth.controller.js';
import { LocalStrategy } from './strategies/local.strategy.js';
import { JwtStrategy } from './strategies/jwt.strategy.js';
import { GoogleStrategy } from './strategies/google.strategy.js';

@Module({
  imports: [
    UsersModule,
    PassportModule.register({
      session: false,
    }),
    ConfigModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService): JwtModuleOptions => ({
        secret: config.get<string>('JWT_SECRET'),
        // Ép kiểu "as any" cho signOptions vì @nestjs/jwt yêu cầu kiểu StringValue cụ thể
        // (từ package "ms", ví dụ '7d' | '1h'...), trong khi giá trị đọc từ .env luôn là string thông thường.
        signOptions: {
          expiresIn: config.get<string>('JWT_EXPIRE_IN') || '7d',
        } as any,
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, LocalStrategy, JwtStrategy, GoogleStrategy],
  exports: [AuthService],
})
export class AuthModule {}
