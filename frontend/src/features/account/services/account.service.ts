import type { UserProfile, UserSettings } from "../types";

export const accountService = {
  async getProfile(): Promise<UserProfile> {
    return {
      name: "An Nguyễn",
      email: "an.nguyen@example.com",
      initials: "AN",
      role: "Sinh viên · Đang hoạt động",
      roomsCount: 3,
      meetingsCount: 12,
      studyHours: 8.5,
      isVerified: true,
      memberSince: "02/06/2026",
    };
  },

  async updateProfile(data: Partial<UserProfile>): Promise<{ success: boolean }> {
    return { success: true };
  },

  async getSettings(): Promise<UserSettings> {
    return {
      notifications: true,
      autoMic: false,
      autoCamera: true,
      theme: "light",
    };
  },

  async updateSettings(data: Partial<UserSettings>): Promise<{ success: boolean }> {
    return { success: true };
  },
};

export default accountService;
