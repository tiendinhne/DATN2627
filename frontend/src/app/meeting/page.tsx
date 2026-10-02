import type { Metadata } from "next";
import { MeetingWorkspace } from "@/features/meeting";

export const metadata: Metadata = {
  title: "Cuộc họp trực tuyến — RusSra",
  description: "Không gian họp trực tuyến WebRTC tích hợp bảng vẽ cộng tác và AI.",
};

export default function MeetingFallbackPage() {
  return <MeetingWorkspace meetingId="sprint-review-05" />;
}
