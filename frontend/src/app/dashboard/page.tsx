import type { Metadata } from "next";
import { AppShell } from "@/components/layout/AppShell";
import { DashboardView } from "@/features/dashboard";

export const metadata: Metadata = {
  title: "Bảng điều khiển — RusSra",
  description: "Tổng quan các phòng học, cuộc họp sắp tới và thời gian học tập của bạn trên RusSra.",
};

export default function DashboardPage() {
  return (
    <AppShell activePage="dashboard">
      <DashboardView />
    </AppShell>
  );
}
