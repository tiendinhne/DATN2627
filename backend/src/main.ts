import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: process.env.FRONTEND_URL,
    credentials: true,
  });

  // whitelist: true -> tự loại bỏ field không khai báo trong DTO
  // transform: true -> tự convert type theo DTO
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  await app.listen(process.env.PORT || 3001);
  console.log(`Backend is running on: ${await app.getUrl()}`);
}
bootstrap();
