import { describe, expect, it } from 'vitest';
import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { UpdateProfileDto } from './update-profile.dto.js';

const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });
const validate = (body: unknown) =>
  pipe.transform(body, { type: 'body', metatype: UpdateProfileDto, data: '' }) as Promise<UpdateProfileDto>;

describe('UpdateProfileDto', () => {
  it('trim displayName before validating', async () => {
    await expect(validate({ displayName: '  Tên mới  ' })).resolves.toMatchObject({
      displayName: 'Tên mới',
    });
  });

  it.each([
    ['empty displayName', { displayName: '   ' }],
    ['too long displayName', { displayName: 'A'.repeat(21) }],
    ['non-string displayName', { displayName: 123 }],
    ['unknown field', { displayName: 'Tên mới', email: 'other@example.com' }],
  ])('rejects %s', async (_case, body) => {
    await expect(validate(body)).rejects.toBeInstanceOf(BadRequestException);
  });
});
