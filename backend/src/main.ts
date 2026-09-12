import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import type { Env } from './config/env.schema';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: false });
  const config = app.get(ConfigService<Env, true>);
  const logger = new Logger('Bootstrap');

  app.setGlobalPrefix('api/v1');

  // Frontend ở Vercel là origin KHÁC -> credentials phải bật, origin phải whitelist chính xác.
  app.enableCors({
    origin: config.get('CORS_ORIGINS', { infer: true }),
    credentials: true,
  });

  // Auto-scale sẽ thu hồi instance đang có kết nối -> cần shutdown hook để drain.
  app.enableShutdownHooks();

  const port = config.get('PORT', { infer: true });
  await app.listen(port);
  logger.log(`instance=${config.get('INSTANCE_ID', { infer: true })} đang chạy tại :${port}/api/v1`);
}
bootstrap();
