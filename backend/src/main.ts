import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';
import { AppModule } from './app.module.js';

class RedisIoAdapter extends IoAdapter {
  private adapterConstructor: ReturnType<typeof createAdapter>;

  async connectToRedis(): Promise<void> {
    const pubClient = createClient({ url: process.env.REDIS_URL || 'redis://redis:6379' });
    const subClient = pubClient.duplicate();

    await Promise.all([pubClient.connect(), subClient.connect()]);

    this.adapterConstructor = createAdapter(pubClient, subClient);
  }

  createIOServer(port: number, options?: any) {
    const server = super.createIOServer(port, options);
    server.adapter(this.adapterConstructor);
    return server;
  }
}

async function bootstrap() {
  // rawBody: giữ body gốc để verify chữ ký webhook LiveKit (spec §4.4)
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true });
  // LiveKit gửi webhook với Content-Type application/webhook+json — parser JSON mặc định bỏ qua loại này.
  // Phải liệt kê cả application/json: thấy đã có middleware tên "jsonParser" thì Nest KHÔNG đăng ký
  // parser JSON mặc định nữa (ExpressAdapter.registerParserMiddleware) → thiếu dòng này mọi REST mất body
  app.useBodyParser('json', { type: ['application/json', 'application/webhook+json'] });

  app.enableCors({
    origin: (process.env.FRONTEND_URL || 'http://localhost:3000').split(','),
    credentials: true,
  });

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));

  const redisIoAdapter = new RedisIoAdapter();
  await redisIoAdapter.connectToRedis();
  app.useWebSocketAdapter(redisIoAdapter);

  const port = process.env.PORT || 3001;
  await app.listen(3001, '0.0.0.0');
  console.log(`Backend is running on: ${await app.getUrl()}`);
  console.log(`WebSocket server listening on port ${port}`);
}
bootstrap();
