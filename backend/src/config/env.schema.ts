import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production']).default('development'),
  PORT: z.coerce.number().default(3001),
  MONGO_URI: z.string().url('MONGO_URI must be a valid MongoDB connection URI'),
  FRONTEND_URL: z.string().url().optional(),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRE_IN: z.string().default('7d'),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_CALLBACK_URL: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(env: NodeJS.ProcessEnv): Env {
  return envSchema.parse(env);
}
