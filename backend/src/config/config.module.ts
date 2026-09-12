import { Global, Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule, ConfigService } from '@nestjs/config';
import { Env, validateEnv } from './env.schema';

export type TypedConfigService = ConfigService<Env, true>;

@Global()
@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
      validate: validateEnv,
      cache: true,
    }),
  ],
  exports: [NestConfigModule],
})
export class ConfigModule {}
