import type { MyProfile } from '@/types/backend';
import { request } from './api';

// Thông tin tài khoản của người đang đăng nhập
export const getMyProfile = (token: string) => request<MyProfile>(token, '/users/me');

export const updateMyProfile = (token: string, displayName: string) =>
  request<MyProfile>(token, '/users/me', { method: 'PATCH', body: JSON.stringify({ displayName }) });

// Đổi mật khẩu / đặt lần đầu (tài khoản Google bỏ trống currentPassword). Gửi kèm cookie refresh
// (request có credentials: 'include') → backend giữ phiên này, đăng xuất các phiên khác (ADR-025)
export const changePassword = (token: string, data: { currentPassword?: string; newPassword: string }) =>
  request<void>(token, '/auth/password', { method: 'POST', body: JSON.stringify(data) });
