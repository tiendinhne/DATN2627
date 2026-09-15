import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { createClient, RedisClientType } from 'redis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private client: RedisClientType;
  private readonly logger = new Logger(RedisService.name);

  async onModuleInit() {
    this.client = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379',
    });

    this.client.on('error', (err) => {
      this.logger.error(`Redis error: ${err}`);
    });

    this.client.on('connect', () => {
      this.logger.log('Redis connected');
    });

    await this.client.connect();
  }

  async onModuleDestroy() {
    await this.client.quit();
  }

  getClient(): RedisClientType {
    return this.client;
  }

  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds) {
      await this.client.setEx(key, ttlSeconds, value);
    } else {
      await this.client.set(key, value);
    }
  }

  async del(key: string): Promise<number> {
    return this.client.del(key);
  }

  async incr(key: string): Promise<number> {
    return this.client.incr(key);
  }

  async lpush(key: string, ...values: string[]): Promise<number> {
    return this.client.lPush(key, values);
  }

  async ltrim(key: string, start: number, stop: number): Promise<void> {
    await this.client.lTrim(key, start, stop);
  }

  async sadd(key: string, ...members: string[]): Promise<number> {
    return this.client.sAdd(key, members);
  }

  async srem(key: string, ...members: string[]): Promise<number> {
    return this.client.sRem(key, members);
  }

  async expire(key: string, seconds: number): Promise<boolean> {
    return this.client.expire(key, seconds);
  }
}
