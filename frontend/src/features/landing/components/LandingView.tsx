"use client";

import { LandingNav } from "./LandingNav";
import { HeroSection } from "./HeroSection";
import { FeatureSection } from "./FeatureSection";
import { HowSection } from "./HowSection";
import { LandingFooter } from "./LandingFooter";

export function LandingView({
  onNavigate,
}: {
  onNavigate?: (page: string) => void;
}) {
  return (
    <div className="landing">
      <LandingNav onNavigate={onNavigate} />
      <main>
        <HeroSection onNavigate={onNavigate} />
        <FeatureSection />
        <HowSection onNavigate={onNavigate} />
      </main>
      <LandingFooter />
    </div>
  );
}

export default LandingView;
