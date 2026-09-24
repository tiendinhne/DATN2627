import { Global, Module } from '@nestjs/common';
import { RedisService } from './services/redis.service.js';

// Global để mọi module inject RedisService mà dùng chung một kết nối
@Global()
@Module({
  providers: [RedisService],
  exports: [RedisService],
})
export class RedisModule {}
