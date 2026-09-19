import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { isGoogleOAuthConfigured } from '../strategies/google.strategy.js';

@Injectable()
export class GoogleAuthGuard extends AuthGuard('google') {
  canActivate(context: ExecutionContext) {
    if (!isGoogleOAuthConfigured()) {
      throw new ServiceUnavailableException(
        'Google login chưa được cấu hình (thiếu GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET)',
      );
    }
    return super.canActivate(context);
  }
}
