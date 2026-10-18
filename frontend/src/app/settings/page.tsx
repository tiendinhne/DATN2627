import type { Metadata } from "next";
import { AppShell } from "@/components/layout/AppShell";
import { SettingsView } from "@/features/account";

export const metadata: Metadata = {
  title: "Cài đặt — RusSra",
  description: "Tùy chỉnh tài khoản, giao diện sáng/tối và thiết bị cuộc họp trên RusSra.",
};

export default function SettingsPage() {
  return (
    <AppShell activePage="settings">
      <SettingsView />
    </AppShell>
  );
}
