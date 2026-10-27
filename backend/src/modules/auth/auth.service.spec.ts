import { describe, it, expect, vi } from 'vitest';
import { NotFoundException, UnauthorizedException } from '@nestjs/common';
import { Types } from 'mongoose';
import * as crypto from 'crypto';
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
    updateDisplayName: vi.fn().mockResolvedValue({ ...user, displayName: 'Tên mới' }),
  };
  const jwtService = { sign: vi.fn(() => 'access.jwt') };
  const refreshTokenModel = {
    findOne: q(doc),
    // Thu hồi có điều kiện revokedAt: null — null nghĩa là request khác đã xoay vòng trước
    findOneAndUpdate: q(claimed),
    create: vi.fn().mockResolvedValue({}),
    updateOne: q({ modifiedCount: 1 }),
  };
  const service = new AuthService(usersService as any, jwtService as any, refreshTokenModel as any);
  return { service, usersService, jwtService, refreshTokenModel };
}

describe('AuthService.updateProfile', () => {
  it('updates the authenticated user displayName and returns public user fields', async () => {
    const { service, usersService } = build();

    await expect(service.updateProfile(userId.toString(), 'Tên mới')).resolves.toEqual({
      id: userId.toString(),
      email: user.email,
      username: user.username,
      displayName: 'Tên mới',
      avatarUrl: user.avatarUrl,
    });
    expect(usersService.updateDisplayName).toHaveBeenCalledWith(userId.toString(), 'Tên mới');
  });

  it('returns not found if the user no longer exists', async () => {
    const { service, usersService } = build();
    usersService.updateDisplayName.mockResolvedValue(null);

    await expect(service.updateProfile(userId.toString(), 'Tên mới')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

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
