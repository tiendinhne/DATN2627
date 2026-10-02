"use client";

import { LandingView } from "@/features/landing";

export function LandingPage({ onNavigate }: { onNavigate?: (page: any) => void }) {
  return <LandingView onNavigate={onNavigate} />;
}

export default LandingPage;
