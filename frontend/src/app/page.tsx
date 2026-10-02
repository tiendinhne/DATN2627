import type { Metadata } from "next";
import { LandingView } from "@/features/landing";

export const metadata: Metadata = {
  title: "RusSra — Hệ thống học nhóm trực tuyến",
  description:
    "Một không gian học nhóm trực tuyến với video meeting, cộng tác realtime và bảng vẽ thông minh tích hợp AI.",
};

export default function HomePage() {
  return <LandingView />;
}
