export interface Room {
  id: string;
  name: string;
  description: string;
  color: string;
  members: number;
  lastActivity: string;
  activeMeeting?: string;
  tag: string;
}

export interface Meeting {
  id: string;
  title: string;
  room: string;
  date: string;
  time: string;
  duration: string;
  participants: number;
  status: "Live" | "Upcoming" | "Completed";
}

export interface Participant {
  id: string;
  name: string;
  initials: string;
  color: string;
  muted?: boolean;
  speaking?: boolean;
}

export interface User {
  id: string;
  name: string;
  email: string;
  initials: string;
  role: string;
  avatar?: string;
}

export interface ApiResponse<T = unknown> {
  statusCode: number;
  message: string;
  data: T;
}
