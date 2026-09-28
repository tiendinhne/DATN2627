import type { Room, RoomListResponse, RoomMember } from '@/types/room';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// Gọi API kèm token; lỗi thì ném Error với message backend trả về
async function request<T>(token: string, path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...init.headers,
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    // Lỗi validate của class-validator trả message dạng mảng
    const message = Array.isArray(body.message) ? body.message.join(', ') : body.message;
    throw new Error(message || `Lỗi ${res.status}`);
  }
  // 204 không có body
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const listMyRooms = (token: string, page = 1) =>
  request<RoomListResponse>(token, `/rooms?page=${page}&limit=20`);

export const createRoom = (token: string, data: { name: string; description?: string }) =>
  request<Room>(token, '/rooms', { method: 'POST', body: JSON.stringify(data) });

export const joinRoom = (token: string, code: string) =>
  request<Room>(token, '/rooms/join', { method: 'POST', body: JSON.stringify({ code }) });

export const getRoom = (token: string, roomId: string) => request<Room>(token, `/rooms/${roomId}`);

export const updateRoom = (token: string, roomId: string, data: { name?: string; description?: string }) =>
  request<Room>(token, `/rooms/${roomId}`, { method: 'PATCH', body: JSON.stringify(data) });

export const listMembers = (token: string, roomId: string) =>
  request<RoomMember[]>(token, `/rooms/${roomId}/members`);

export const kickMember = (token: string, roomId: string, userId: string) =>
  request<void>(token, `/rooms/${roomId}/members/${userId}`, { method: 'DELETE' });

export const leaveRoom = (token: string, roomId: string) =>
  request<void>(token, `/rooms/${roomId}/members/me`, { method: 'DELETE' });

export const dissolveRoom = (token: string, roomId: string) =>
  request<void>(token, `/rooms/${roomId}/dissolve`, { method: 'POST' });
