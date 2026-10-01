import { describe, it, expect } from 'vitest';
import { RoomAction, can } from './permissions.js';
import { RoomRole } from './enums.js';

describe('can', () => {
  it('HOST được làm mọi hành động trong bảng', () => {
    for (const action of Object.values(RoomAction)) {
      expect(can(RoomRole.HOST, action)).toBe(true);
    }
  });

  it('MEMBER không được làm hành động nào trong bảng (bảng chỉ chứa hành động dành cho HOST)', () => {
    for (const action of Object.values(RoomAction)) {
      expect(can(RoomRole.MEMBER, action)).toBe(false);
    }
  });
});
