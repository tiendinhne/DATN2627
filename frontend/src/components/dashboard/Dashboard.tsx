"use client";

import { DashboardView } from "@/features/dashboard";

export function Dashboard({ onNavigate }: { onNavigate?: (page: any) => void }) {
  return <DashboardView onNavigate={onNavigate} />;
}

export default Dashboard;
