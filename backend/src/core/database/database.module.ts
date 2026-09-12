import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import type { Env } from '../../config/env.schema';

@Module({
  imports: [
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        uri: config.get('MONGODB_URI', { infer: true }),
        // autoIndex bật ở dev để index tự tạo; ở prod tạo index thủ công
        // vì autoIndex trên collection lớn có thể chặn write.
        autoIndex: config.get('NODE_ENV', { infer: true }) !== 'production',
      }),
    }),
  ],
})
export class DatabaseModule {}
