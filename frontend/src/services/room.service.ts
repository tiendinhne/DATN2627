import type { Room, RoomListResponse, RoomMember, RoomUserSearchResult } from '@/types/backend';
import { request } from './api';

export const listMyRooms = (token: string, page = 1) =>
  request<RoomListResponse>(token, `/rooms?page=${page}&limit=20`);

export const createRoom = (token: string, data: { name: string; description?: string }) =>
  request<Room>(token, '/rooms', { method: 'POST', body: JSON.stringify(data) });

export const joinRoom = (token: string, code: string) =>
  request<Room>(token, '/rooms/join', { method: 'POST', body: JSON.stringify({ code }) });

export const getRoom = (token: string, roomId: string) =>
  request<Room>(token, `/rooms/${roomId}`);

export const updateRoom = (token: string, roomId: string, data: { name?: string; description?: string }) =>
  request<Room>(token, `/rooms/${roomId}`, { method: 'PATCH', body: JSON.stringify(data) });

export const listMembers = (token: string, roomId: string) =>
  request<RoomMember[]>(token, `/rooms/${roomId}/members`);

export const searchRoomUsers = (token: string, roomId: string, query: string) =>
  request<RoomUserSearchResult[]>(
    token,
    `/rooms/${roomId}/members/search?q=${encodeURIComponent(query)}`,
  );

export const addMember = (token: string, roomId: string, email: string) =>
  request<RoomMember>(token, `/rooms/${roomId}/members`, { method: 'POST', body: JSON.stringify({ email }) });

export const kickMember = (token: string, roomId: string, userId: string) =>
  request<void>(token, `/rooms/${roomId}/members/${userId}`, { method: 'DELETE' });

export const leaveRoom = (token: string, roomId: string) =>
  request<void>(token, `/rooms/${roomId}/members/me`, { method: 'DELETE' });

export const dissolveRoom = (token: string, roomId: string) =>
  request<void>(token, `/rooms/${roomId}/dissolve`, { method: 'POST' });
