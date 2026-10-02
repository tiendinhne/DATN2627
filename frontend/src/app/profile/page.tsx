import type { Metadata } from "next";
import { AppShell } from "@/components/layout/AppShell";
import { ProfileView } from "@/features/account";

export const metadata: Metadata = {
  title: "Hồ sơ cá nhân — RusSra",
  description: "Quản lý thông tin hồ sơ người dùng trên RusSra.",
};

export default function ProfilePage() {
  return (
    <AppShell activePage="profile">
      <ProfileView />
    </AppShell>
  );
}
