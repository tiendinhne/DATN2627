import type { Room } from "@/types";

export type { Room };

export type RoomRole = "owner" | "member";

export interface RoomMember {
  name: string;
  email: string;
  initials: string;
  role: "Chủ phòng" | "Thành viên";
  online: boolean;
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
