import { Injectable, OnModuleDestroy, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import type { Env } from '../../config/env.schema';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);

  /** client chính cho lệnh thường */
  public client: Redis;
  /** Socket.IO Redis adapter cần 2 client riêng: subscriber không dùng chung được */
  public pubClient: Redis;
  public subClient: Redis;

  constructor(private readonly config: ConfigService<Env, true>) {}

  private create(): Redis {
    return new Redis({
      host: this.config.get('REDIS_HOST', { infer: true }),
      port: this.config.get('REDIS_PORT', { infer: true }),
      password: this.config.get('REDIS_PASSWORD', { infer: true }) || undefined,
      maxRetriesPerRequest: null,
      lazyConnect: false,
    });
  }

  onModuleInit() {
    this.client = this.create();
    this.pubClient = this.create();
    this.subClient = this.pubClient.duplicate();
    this.client.on('error', (e) => this.logger.error(`Redis error: ${e.message}`));
    this.logger.log('Redis đã kết nối');
  }

  async onModuleDestroy() {
    await Promise.allSettled([
      this.client?.quit(),
      this.pubClient?.quit(),
      this.subClient?.quit(),
    ]);
  }
}
