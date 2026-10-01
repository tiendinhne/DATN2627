// Kiểu dữ liệu khớp response của backend (docs/api/endpoint.md — Rooms)
export type RoomRole = 'HOST' | 'MEMBER';

export interface Room {
  id: string;
  name: string;
  description: string;
  joinCode: string;
  ownerId: string;
  status: 'ACTIVE' | 'DISSOLVED';
  memberCount: number;
  createdAt: string;
  myRole: RoomRole;
}

export interface RoomListResponse {
  items: Room[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface RoomMember {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  role: RoomRole;
  joinedAt: string;
}
