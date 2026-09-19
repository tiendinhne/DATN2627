import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';
import type { JwtModuleOptions } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { UsersModule } from '../users/users.module.js';
import { AuthService } from './auth.service.js';
import { AuthController } from './auth.controller.js';
import { LocalStrategy } from './strategies/local.strategy.js';
import { JwtStrategy } from './strategies/jwt.strategy.js';
import { GoogleStrategy, isGoogleOAuthConfigured } from './strategies/google.strategy.js';
import { RefreshToken, RefreshTokenSchema } from './schemas/refresh-token.schema.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: RefreshToken.name, schema: RefreshTokenSchema },
    ]),
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
        signOptions: {
          expiresIn: config.get<string>('JWT_EXPIRES_IN') || '15m',
        } as any,
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    LocalStrategy,
    JwtStrategy,
    // Chỉ đăng ký GoogleStrategy khi có đủ credentials, tránh crash toàn app
    // (OAuth2Strategy throw cứng lúc khởi tạo nếu thiếu clientID) khi Google Cloud
    // chưa được cấu hình. Xem docs/DOCKER_NOTES.md.
    ...(isGoogleOAuthConfigured() ? [GoogleStrategy] : []),
  ],
  exports: [AuthService],
})
export class AuthModule {}
