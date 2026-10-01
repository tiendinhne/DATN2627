import { describe, it, expect } from 'vitest';
import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { Types } from 'mongoose';
import { CreateRoomDto } from './create-room.dto.js';

// Test case lạ ở entry point POST /rooms: body đi qua ValidationPipe cùng cấu hình main.ts
const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });
const validate = (body: unknown) =>
  pipe.transform(body, { type: 'body', metatype: CreateRoomDto, data: '' }) as Promise<CreateRoomDto>;

describe('CreateRoomDto — case lạ', () => {
  it('body tự đặt ownerId / joinCode / memberCount / status → 400', async () => {
    const body = { name: 'X', ownerId: new Types.ObjectId().toString(), joinCode: 'AAAAAAAA', memberCount: 999, status: 'DISSOLVED' };
    await expect(validate(body)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('name là object kiểu NoSQL injection { $ne: null } → 400', async () => {
    await expect(validate({ name: { $ne: null } })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('name là mảng → 400', async () => {
    await expect(validate({ name: ['Nhóm Toán'] })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('name chỉ gồm tab, xuống dòng, khoảng trắng full-width → 400', async () => {
    await expect(validate({ name: ' \t\n　 ' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('name 100 ký tự (sau trim) nhận, 101 ký tự → 400', async () => {
    const dto = await validate({ name: `  ${'a'.repeat(100)}  ` });
    expect(dto.name).toHaveLength(100);
    await expect(validate({ name: 'a'.repeat(101) })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('body có __proto__ → không làm ô nhiễm Object.prototype', async () => {
    const body = JSON.parse('{"name":"X","__proto__":{"polluted":"yes"}}');
    await validate(body).catch(() => undefined);
    expect(({} as any).polluted).toBeUndefined();
  });
});
