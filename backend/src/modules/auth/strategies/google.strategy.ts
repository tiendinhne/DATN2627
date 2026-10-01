import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-google-oauth20';
import type { VerifyCallback, Profile } from 'passport-google-oauth20';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth.service.js';

// Google OAuth là optional feature: nếu chưa cấu hình (chưa tạo credentials
// trên Google Cloud Console), app vẫn phải chạy được với local login.
export function isGoogleOAuthConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(
    private configService: ConfigService,
    private authService: AuthService,
  ) {
    super({
      // Ép kiểu "as string" vì ConfigService.get() trả về "string | undefined",
      // nếu thiếu biến này trong .env thì lỗi sẽ hiện rõ khi Google từ chối request lúc chạy,
      // dễ debug hơn là để TypeScript báo lỗi mơ hồ ở overload của passport-google-oauth20.
      clientID: configService.get<string>('GOOGLE_CLIENT_ID') as string,
      clientSecret: configService.get<string>('GOOGLE_CLIENT_SECRET') as string,
      callbackURL: configService.get<string>('GOOGLE_CALLBACK_URL') as string,
      scope: ['email', 'profile'],
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: Profile,
    done: VerifyCallback,
  ) {
    const { id, name, emails, photos } = profile;
    const displayName =
      `${name?.givenName ?? ''}${name?.familyName ?? ''}` ||
      emails?.[0]?.value?.split('@')[0] ||
      'user';

    const user = await this.authService.validateGoogleUser({
      googleId: id,
      email: emails?.[0]?.value,
      displayName,
      avatarUrl: photos?.[0]?.value,
    });
    done(null, user);
  }
}
