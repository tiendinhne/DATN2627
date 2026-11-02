import { describe, it, expect, vi } from 'vitest';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { Types } from 'mongoose';
import * as crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { AuthService } from './auth.service.js';

// Query Mongoose giả: lean() nối chuỗi, exec() trả result
function query(result: unknown) {
  const chain: any = {
    lean: vi.fn(() => chain),
    exec: vi.fn().mockResolvedValue(result),
  };
  return chain;
}
const q = (result: unknown) => vi.fn((..._args: any[]) => query(result));

const sha256 = (s: string) => crypto.createHash('sha256').update(s).digest('hex');

const userId = new Types.ObjectId();
const rawToken = 'a'.repeat(64); // refresh token hợp lệ = 64 ký tự hex
const user = {
  _id: userId,
  email: 'a@test.com',
  username: 'a',
  displayName: 'A',
  avatarUrl: null,
  providers: ['local'],
};

// Bản ghi refresh_tokens trong Mongo
function tokenDoc(overrides: Record<string, unknown> = {}) {
  return {
    _id: new Types.ObjectId(),
    userId,
    tokenHash: sha256(rawToken),
    expiresAt: new Date(Date.now() + 60_000),
    revokedAt: null,
    replacedByTokenHash: null,
    ...overrides,
  };
}

function build(doc: unknown = tokenDoc(), claimed: unknown = { _id: 'x' }) {
  const usersService = {
    findById: vi.fn().mockResolvedValue(user),
    findByIdWithPassword: vi.fn().mockResolvedValue(user),
    setPassword: vi.fn().mockResolvedValue(undefined),
  };
  const jwtService = { sign: vi.fn(() => 'access.jwt') };
  const refreshTokenModel = {
    findOne: q(doc),
    // Thu hồi có điều kiện revokedAt: null — null nghĩa là request khác đã xoay vòng trước
    findOneAndUpdate: q(claimed),
    create: vi.fn().mockResolvedValue({}),
    updateOne: q({ modifiedCount: 1 }),
    updateMany: q({ modifiedCount: 2 }),
  };
  const service = new AuthService(usersService as any, jwtService as any, refreshTokenModel as any);
  return { service, usersService, jwtService, refreshTokenModel };
}

describe('AuthService.refresh', () => {
  it('không có cookie → 401, không đọc DB', async () => {
    const { service, refreshTokenModel } = build();
    await expect(service.refresh(undefined)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(refreshTokenModel.findOne).not.toHaveBeenCalled();
  });

  it('cookie sai định dạng → 401, không đọc DB', async () => {
    const { service, refreshTokenModel } = build();
    await expect(service.refresh('abc')).rejects.toBeInstanceOf(UnauthorizedException);
    expect(refreshTokenModel.findOne).not.toHaveBeenCalled();
  });

  it('không tìm thấy token → 401', async () => {
    const { service } = build(null);
    await expect(service.refresh(rawToken)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('token hết hạn → 401', async () => {
    const { service } = build(tokenDoc({ expiresAt: new Date(Date.now() - 1000) }));
    await expect(service.refresh(rawToken)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('hợp lệ → xoay vòng: thu hồi token cũ, lưu token mới, trả access token + refresh token mới', async () => {
    const doc = tokenDoc();
    const { service, refreshTokenModel } = build(doc);

    const res = await service.refresh(rawToken);

    expect(refreshTokenModel.findOne).toHaveBeenCalledWith({ tokenHash: sha256(rawToken) });
    expect(res.accessToken).toBe('access.jwt');
    expect(res.user).toMatchObject({ id: userId.toString(), displayName: 'A' });
    expect(res.refreshToken).toMatch(/^[a-f0-9]{64}$/);
    expect(res.refreshToken).not.toBe(rawToken);

    const newHash = sha256(res.refreshToken as string);
    // Thu hồi có điều kiện → 2 request cùng lúc chỉ 1 cái xoay vòng được
    const [filter, update] = refreshTokenModel.findOneAndUpdate.mock.calls[0];
    expect(filter).toEqual({ _id: doc._id, revokedAt: null });
    expect(update.$set.replacedByTokenHash).toBe(newHash);
    expect(update.$set.revokedAt).toBeInstanceOf(Date);
    // Token mới cùng user, chỉ lưu hash
    expect(refreshTokenModel.create).toHaveBeenCalledWith(
      expect.objectContaining({ userId: doc.userId, tokenHash: newHash }),
    );
  });

  it('token vừa bị xoay vòng trong 10 giây (tab khác refresh cùng lúc) → chỉ trả access token, không cấp refresh mới', async () => {
    const { service, refreshTokenModel } = build(
      tokenDoc({ revokedAt: new Date(Date.now() - 3000), replacedByTokenHash: 'h' }),
    );

    const res = await service.refresh(rawToken);

    expect(res.accessToken).toBe('access.jwt');
    expect(res.refreshToken).toBeNull();
    expect(refreshTokenModel.findOneAndUpdate).not.toHaveBeenCalled();
    expect(refreshTokenModel.create).not.toHaveBeenCalled();
  });

  it('token bị xoay vòng quá 10 giây → 401', async () => {
    const { service } = build(tokenDoc({ revokedAt: new Date(Date.now() - 11_000), replacedByTokenHash: 'h' }));
    await expect(service.refresh(rawToken)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('token bị thu hồi do đăng xuất (không có replacedByTokenHash) dù mới 1 giây → 401', async () => {
    const { service } = build(tokenDoc({ revokedAt: new Date(Date.now() - 1000) }));
    await expect(service.refresh(rawToken)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('thua cuộc đua xoay vòng (request khác vừa thu hồi) → chỉ trả access token, không cấp refresh mới', async () => {
    const { service, refreshTokenModel } = build(tokenDoc(), null);

    const res = await service.refresh(rawToken);

    expect(res.accessToken).toBe('access.jwt');
    expect(res.refreshToken).toBeNull();
    expect(refreshTokenModel.create).not.toHaveBeenCalled();
  });

  it('user không còn tồn tại → 401, không xoay vòng', async () => {
    const { service, usersService, refreshTokenModel } = build();
    usersService.findById.mockResolvedValue(null);
    await expect(service.refresh(rawToken)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(refreshTokenModel.findOneAndUpdate).not.toHaveBeenCalled();
  });
});

describe('AuthService.logout', () => {
  it('thu hồi token đang dùng (chỉ khi chưa bị thu hồi)', async () => {
    const { service, refreshTokenModel } = build();
    await service.logout(rawToken);
    const [filter, update] = refreshTokenModel.updateOne.mock.calls[0];
    expect(filter).toEqual({ tokenHash: sha256(rawToken), revokedAt: null });
    expect(update.$set.revokedAt).toBeInstanceOf(Date);
  });

  it('không có cookie / sai định dạng → không làm gì, không ném lỗi', async () => {
    const { service, refreshTokenModel } = build();
    await service.logout(undefined);
    await service.logout('abc');
    expect(refreshTokenModel.updateOne).not.toHaveBeenCalled();
  });
});

describe('AuthService.changePassword', () => {
  // User trong DB kèm hash mật khẩu (findByIdWithPassword select +password). password undefined = chỉ dùng Google
  async function buildFor(oldPassword: string | undefined, providers = ['local']) {
    const ctx = build();
    const dbUser = { ...user, providers, password: oldPassword ? await bcrypt.hash(oldPassword, 4) : undefined };
    ctx.usersService.findByIdWithPassword.mockResolvedValue(dbUser);
    return ctx;
  }

  it('đã có mật khẩu mà thiếu mật khẩu hiện tại → 400, không đổi gì', async () => {
    const { service, usersService, refreshTokenModel } = await buildFor('old-pass');
    await expect(
      service.changePassword(userId.toString(), { newPassword: 'new-pass' }, rawToken),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(usersService.setPassword).not.toHaveBeenCalled();
    expect(refreshTokenModel.updateMany).not.toHaveBeenCalled();
  });

  it('mật khẩu hiện tại sai → 400, không đổi gì', async () => {
    const { service, usersService, refreshTokenModel } = await buildFor('old-pass');
    await expect(
      service.changePassword(userId.toString(), { currentPassword: 'sai', newPassword: 'new-pass' }, rawToken),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(usersService.setPassword).not.toHaveBeenCalled();
    expect(refreshTokenModel.updateMany).not.toHaveBeenCalled();
  });

  it('đúng mật khẩu hiện tại → lưu hash mới, thu hồi mọi phiên khác, giữ phiên hiện tại', async () => {
    const { service, usersService, refreshTokenModel } = await buildFor('old-pass');

    await service.changePassword(userId.toString(), { currentPassword: 'old-pass', newPassword: 'new-pass' }, rawToken);

    const [id, hash] = usersService.setPassword.mock.calls[0];
    expect(id).toBe(userId.toString());
    expect(await bcrypt.compare('new-pass', hash)).toBe(true);
    const [filter, update] = refreshTokenModel.updateMany.mock.calls[0];
    expect(filter).toEqual({ userId: userId.toString(), revokedAt: null, tokenHash: { $ne: sha256(rawToken) } });
    expect(update.$set.revokedAt).toBeInstanceOf(Date);
  });

  it('tài khoản Google chưa có mật khẩu → đặt mật khẩu không cần mật khẩu cũ', async () => {
    const { service, usersService } = await buildFor(undefined, ['google']);

    await service.changePassword(userId.toString(), { newPassword: 'new-pass' }, rawToken);

    const [, hash] = usersService.setPassword.mock.calls[0];
    expect(await bcrypt.compare('new-pass', hash)).toBe(true);
  });

  it('không có cookie refresh (không biết phiên hiện tại) → thu hồi mọi phiên', async () => {
    const { service, refreshTokenModel } = await buildFor('old-pass');

    await service.changePassword(userId.toString(), { currentPassword: 'old-pass', newPassword: 'new-pass' }, undefined);

    const [filter] = refreshTokenModel.updateMany.mock.calls[0];
    expect(filter).toEqual({ userId: userId.toString(), revokedAt: null });
  });

  it('user không còn tồn tại → 401', async () => {
    const { service, usersService } = build();
    usersService.findByIdWithPassword.mockResolvedValue(null);
    await expect(
      service.changePassword(userId.toString(), { newPassword: 'new-pass' }, rawToken),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
