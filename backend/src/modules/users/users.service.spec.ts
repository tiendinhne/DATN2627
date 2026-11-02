import { describe, expect, it, vi } from 'vitest';
import { Types } from 'mongoose';
import { UsersService } from './users.service.js';

function query(result: unknown) {
  return {
    exec: vi.fn().mockResolvedValue(result),
  };
}

describe('UsersService.updateDisplayName', () => {
  it('updates only displayName and returns the updated user', async () => {
    const updatedUser = { _id: 'user-id', displayName: 'Tên mới' };
    const updateQuery = query(updatedUser);
    const userModel = {
      findByIdAndUpdate: vi.fn(() => updateQuery),
    };
    const service = new UsersService(userModel as any);

    const result = await service.updateDisplayName('user-id', 'Tên mới');

    expect(userModel.findByIdAndUpdate).toHaveBeenCalledWith(
      'user-id',
      { $set: { displayName: 'Tên mới' } },
      { returnDocument: 'after', runValidators: true },
    );
    expect(updateQuery.exec).toHaveBeenCalledOnce();
    expect(result).toBe(updatedUser);
  });

  it('returns null if the user does not exist', async () => {
    const userModel = {
      findByIdAndUpdate: vi.fn(() => query(null)),
    };
    const service = new UsersService(userModel as any);

    await expect(service.updateDisplayName('missing-id', 'Tên mới')).resolves.toBeNull();
  });
});

// GET /auth/me trả toProfile; đổi mật khẩu dùng setPassword (ADR-027)
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

describe('UsersService.toProfile', () => {
  it('trả id (không _id, không __v), kèm createdAt và hasPassword', () => {
    const service = new UsersService({} as any);
    expect(service.toProfile(userDoc() as any)).toEqual({
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
    const service = new UsersService({} as any);
    expect(service.toProfile(userDoc({ providers: ['google'] }) as any).hasPassword).toBe(false);
  });
});

describe('UsersService.setPassword', () => {
  it('lưu hash và thêm provider local (tài khoản Google đặt mật khẩu lần đầu đăng nhập được bằng mật khẩu)', async () => {
    const userModel = { findByIdAndUpdate: vi.fn(() => query(userDoc())) };
    const service = new UsersService(userModel as any);

    await service.setPassword(userId.toString(), 'hash-moi');

    expect(userModel.findByIdAndUpdate).toHaveBeenCalledWith(userId.toString(), {
      $set: { password: 'hash-moi' },
      $addToSet: { providers: 'local' },
    });
  });
});
