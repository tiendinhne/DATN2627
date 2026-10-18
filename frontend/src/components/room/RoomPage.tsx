"use client";

import { RoomView } from "@/features/room";

export function RoomPage({ onNavigate }: { onNavigate?: (page: any) => void }) {
  return <RoomView onNavigate={onNavigate} />;
}

export default RoomPage;
