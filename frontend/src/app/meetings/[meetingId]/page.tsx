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
  searchParams: Promise<{
    roomId?: string;
  }>;
}

export default async function MeetingPage({ params, searchParams }: MeetingPageProps) {
  const [{ meetingId }, { roomId }] = await Promise.all([params, searchParams]);
  return <MeetingWorkspace meetingId={meetingId} initialRoomId={roomId} />;
}
