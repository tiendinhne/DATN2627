import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { RedisService } from './redis.service';

/**
 * @nestjs/schedule chạy cron trên MỌI replica. Không có lock thì 3 instance
 * sẽ cùng chạy job auto-end meeting — đúng kiểu "3 máy lặp lại công việc vô ích".
 *
 * Giới hạn: chỉ một Redis nên lock này là single point of failure.
 * Chấp nhận được ở phạm vi đồ án; ghi rõ trong phần Limitations.
 */
@Injectable()
export class DistributedLockService {
  constructor(private readonly redis: RedisService) {}

  /** Trả về token nếu giành được lock, null nếu instance khác đang giữ. */
  async acquire(key: string, ttlMs: number): Promise<string | null> {
    const token = randomUUID();
    const ok = await this.redis.client.set(`lock:${key}`, token, 'PX', ttlMs, 'NX');
    return ok === 'OK' ? token : null;
  }

  /** Chỉ xoá nếu token khớp — tránh xoá nhầm lock của instance khác đã gia hạn. */
  async release(key: string, token: string): Promise<void> {
    const lua = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end`;
    await this.redis.client.eval(lua, 1, `lock:${key}`, token);
  }

  /** Chạy fn nếu giành được lock. Trả false nếu instance khác đang chạy. */
  async runExclusive(key: string, ttlMs: number, fn: () => Promise<void>): Promise<boolean> {
    const token = await this.acquire(key, ttlMs);
    if (!token) return false;
    try {
      await fn();
      return true;
    } finally {
      await this.release(key, token);
    }
  }
}
