import { z } from 'zod';

/**
 * FAIL FAST: thiếu env thì app không khởi động được, thay vì chạy rồi crash giữa chừng.
 * Với 4 môi trường (local, docker, VPS, AWS) đây là thứ tiết kiệm nhiều giờ debug nhất.
 */
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  /** Bắt buộc có trong log để chứng minh load balancer phân phối đều (thí nghiệm E3). */
  INSTANCE_ID: z.string().default('api-local'),

  MONGODB_URI: z.string().url().or(z.string().startsWith('mongodb')),

  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().int().positive().default(6379),
  REDIS_PASSWORD: z.string().optional(),

  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET phải >= 32 ký tự'),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET phải >= 32 ký tự'),
  JWT_REFRESH_TTL_DAYS: z.coerce.number().int().positive().default(7),

  CORS_ORIGINS: z
    .string()
    .default('http://localhost:3000')
    .transform((s) => s.split(',').map((x) => x.trim()).filter(Boolean)),

  LIVEKIT_URL: z.string(),
  LIVEKIT_API_KEY: z.string(),
  LIVEKIT_API_SECRET: z.string().min(32),
  LIVEKIT_TOKEN_TTL_HOURS: z.coerce.number().int().positive().default(6),

  STORAGE_ENDPOINT: z.string(),
  STORAGE_ACCESS_KEY: z.string(),
  STORAGE_SECRET_KEY: z.string(),
  STORAGE_BUCKET: z.string().default('datn2627'),
  STORAGE_REGION: z.string().default('us-east-1'),

  AI_PROVIDER: z.enum(['gemini', 'openai']).default('gemini'),
  GEMINI_API_KEY: z.string().optional(),
  AI_TIMEOUT_MS: z.coerce.number().int().positive().default(30_000),

  WB_PERSIST_DEBOUNCE_MS: z.coerce.number().int().positive().default(15_000),
  WB_PERSIST_MAX_INTERVAL_MS: z.coerce.number().int().positive().default(60_000),
  WB_OPS_BUFFER_SIZE: z.coerce.number().int().positive().default(500),

  MEETING_AUTO_END_AFTER_MIN: z.coerce.number().int().positive().default(10),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(raw: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(raw);
  if (!parsed.success) {
    const lines = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`);
    throw new Error(`Cấu hình môi trường không hợp lệ:\n${lines.join('\n')}`);
  }
  return parsed.data;
}
