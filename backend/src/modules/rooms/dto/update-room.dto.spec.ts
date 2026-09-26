import { describe, it, expect } from 'vitest';
import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { UpdateRoomDto } from './update-room.dto.js';

// PATCH /rooms/:roomId: body đi qua ValidationPipe cùng cấu hình main.ts
const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });
const validate = (body: unknown) =>
  pipe.transform(body, { type: 'body', metatype: UpdateRoomDto, data: '' }) as Promise<UpdateRoomDto>;

describe('UpdateRoomDto — gửi null', () => {
  it('name: null → 400 (không để findOneAndUpdate ghi null vào DB)', async () => {
    await expect(validate({ name: null })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('description: null → 400', async () => {
    await expect(validate({ description: null })).rejects.toBeInstanceOf(BadRequestException);
  });
});
