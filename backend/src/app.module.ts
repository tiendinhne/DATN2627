import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersModule } from './modules/users/users.module.js';
import { AuthModule } from './modules/auth/auth.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forRoot(
      process.env.MONGO_URI ?? 'mongodb://localhost:27017/online-group-learning',
    ),
    UsersModule,
    AuthModule,
    // Các module khác của hệ thống (rooms, chat, whiteboard...) khai báo tiếp ở đây
  ],
})
export class AppModule {}
