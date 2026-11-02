import { describe, it, expect, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { UsersService } from './users.service.js';

// Query Mongoose giả: exec() trả result
const q = (result: unknown) => vi.fn((..._args: any[]) => ({ exec: vi.fn().mockResolvedValue(result) }));

const userId = new Types.ObjectId();
const createdAt = new Date('2026-10-01T00:00:00.000Z');
const userDoc = (overrides: Record<string, unknown> = {}) => ({
  _id: userId,
  email: 'a@test.com',
  username: 'a',
  displayName: 'A',
  avatarUrl: null,
  providers: ['local'],
  createdAt,
  __v: 0,
  ...overrides,
});

function build(updated: unknown = userDoc()) {
  const userModel = { findByIdAndUpdate: q(updated) };
  const service = new UsersService(userModel as any);
  return { service, userModel };
}

describe('UsersService.toProfile', () => {
  it('trả id (không _id, không __v), kèm createdAt và hasPassword', () => {
    const { service } = build();
    const profile = service.toProfile(userDoc() as any);
    expect(profile).toEqual({
      id: userId.toString(),
      email: 'a@test.com',
      username: 'a',
      displayName: 'A',
      avatarUrl: null,
      providers: ['local'],
      hasPassword: true,
      createdAt,
    });
  });

  it('tài khoản chỉ dùng Google → hasPassword false', () => {
    const { service } = build();
    expect(service.toProfile(userDoc({ providers: ['google'] }) as any).hasPassword).toBe(false);
  });
});

describe('UsersService.updateDisplayName', () => {
  it('lưu tên đã trim, trả profile mới', async () => {
    const { service, userModel } = build(userDoc({ displayName: 'Tên mới' }));

    const profile = await service.updateDisplayName(userId.toString(), '  Tên mới  ');

    expect(userModel.findByIdAndUpdate).toHaveBeenCalledWith(
      userId.toString(),
      { $set: { displayName: 'Tên mới' } },
      { new: true, runValidators: true },
    );
    expect(profile).toMatchObject({ id: userId.toString(), displayName: 'Tên mới' });
  });

  it('user không còn tồn tại → 404', async () => {
    const { service } = build(null);
    await expect(service.updateDisplayName(userId.toString(), 'X')).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('UsersService.setPassword', () => {
  it('lưu hash và thêm provider local (tài khoản Google đặt mật khẩu lần đầu đăng nhập được bằng mật khẩu)', async () => {
    const { service, userModel } = build();

    await service.setPassword(userId.toString(), 'hash-moi');

    expect(userModel.findByIdAndUpdate).toHaveBeenCalledWith(userId.toString(), {
      $set: { password: 'hash-moi' },
      $addToSet: { providers: 'local' },
    });
  });
});
