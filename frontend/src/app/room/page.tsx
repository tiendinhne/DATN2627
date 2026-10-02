import type { Metadata } from "next";
import { AppShell } from "@/components/layout/AppShell";
import { RoomView } from "@/features/room";

export const metadata: Metadata = {
  title: "Chi tiết phòng học — RusSra",
  description: "Không gian làm việc, tài liệu và các cuộc họp nhóm trên RusSra.",
};

export default function RoomFallbackPage() {
  return (
    <AppShell activePage="room">
      <RoomView roomId="software-engineering" />
    </AppShell>
  );
}
