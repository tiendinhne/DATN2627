export interface UserProfile {
  name: string;
  email: string;
  initials: string;
  role: string;
  roomsCount: number;
  meetingsCount: number;
  studyHours: number;
  isVerified: boolean;
  memberSince: string;
}

export interface UserSettings {
  notifications: boolean;
  autoMic: boolean;
  autoCamera: boolean;
  theme: "light" | "dark";
}
