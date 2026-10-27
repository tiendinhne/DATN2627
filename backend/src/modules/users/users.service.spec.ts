import { describe, expect, it, vi } from 'vitest';
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
