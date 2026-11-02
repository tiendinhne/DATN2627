import type { Room } from "@/types";

export type { Room };

export type RoomRole = "owner" | "member";

export interface RoomMember {
  userId?: string;
  name: string;
  email: string;
  initials: string;
  role: "Chủ phòng" | "Thành viên";
  online?: boolean; // chưa có API presence (small_task #2, phần C) → undefined = không biết
  color: string;
  joinedDate?: string;
}

export type RoomDialogType =
  | "edit"
  | "invite"
  | "start"
  | "end"
  | "delete"
  | "remove"
  | "leave"
  | "settings"
  | null;
