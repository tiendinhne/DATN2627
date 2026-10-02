import type { Metadata } from "next";
import { AppShell } from "@/components/layout/AppShell";
import { RoomView } from "@/features/room";

export const metadata: Metadata = {
  title: "Chi tiết phòng học — RusSra",
  description: "Không gian làm việc, tài liệu và các cuộc họp nhóm trên RusSra.",
};

interface RoomPageProps {
  params: Promise<{
    roomId: string;
  }>;
}

export default async function RoomPage({ params }: RoomPageProps) {
  const { roomId } = await params;
  return (
    <AppShell activePage="room">
      <RoomView roomId={roomId} />
    </AppShell>
  );
}
