import { Controller, Headers, HttpCode, Inject, Post, Req, UnauthorizedException } from '@nestjs/common';
import { MeetingsService } from './meetings.service.js';
import { MEDIA_PORT } from './ports/media.port.js';
import type { MediaPort } from './ports/media.port.js';

// Webhook của media server. KHÔNG dùng JWT — xác thực bằng chữ ký (PROJECT_CONTEXT §7.4).
// Nhiều instance: NGINX chuyển mỗi event tới 1 instance; mọi side effect nằm trong Mongo / Redis
@Controller('webhooks')
export class MediaWebhookController {
  constructor(
    @Inject(MEDIA_PORT) private media: MediaPort,
    private meetings: MeetingsService,
  ) {}

  // POST /webhooks/livekit — 200 xử lý xong / bỏ qua; 401 sai chữ ký; 500 lỗi bất ngờ (LiveKit gửi lại)
  @Post('livekit')
  @HttpCode(200)
  async receive(@Req() req: { rawBody?: Buffer }, @Headers('authorization') authorization?: string) {
    // rawBody có nhờ main.ts bật rawBody + parser application/webhook+json (spec §4.4)
    const raw = req.rawBody?.toString('utf8');
    if (!raw) {
      throw new UnauthorizedException('Thiếu nội dung webhook');
    }
    const event = await this.media.parseWebhook(raw, authorization);
    await this.meetings.handleMediaEvent(event);
    return { ok: true };
  }
}
