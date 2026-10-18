import type { Metadata } from "next";
import { AppShell } from "@/components/layout/AppShell";
import { RoomListView } from "@/features/room";

export const metadata: Metadata = {
  title: "Phòng học của tôi — RusSra",
  description: "Danh sách các phòng học bạn đã tham gia.",
};

export default function RoomsPage() {
  return (
    <AppShell activePage="room">
      <RoomListView />
    </AppShell>
  );
}
