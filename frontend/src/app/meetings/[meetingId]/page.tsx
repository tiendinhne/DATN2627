import type { Metadata } from "next";
import { MeetingWorkspace } from "@/features/meeting";

export const metadata: Metadata = {
  title: "Cuộc họp trực tuyến — RusSra",
  description: "Không gian họp trực tuyến WebRTC tích hợp bảng vẽ cộng tác và AI.",
};

interface MeetingPageProps {
  params: Promise<{
    meetingId: string;
  }>;
}

export default async function MeetingPage({ params }: MeetingPageProps) {
  const { meetingId } = await params;
  return <MeetingWorkspace meetingId={meetingId} />;
}
