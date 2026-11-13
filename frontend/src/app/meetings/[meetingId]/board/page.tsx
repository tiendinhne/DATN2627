import type { Metadata } from "next";
import { WhiteboardReview } from "@/features/whiteboard";

export const metadata: Metadata = {
  title: "Xem lại bảng vẽ — RusSra",
  description: "Xem lại nội dung bảng vẽ của buổi học đã kết thúc.",
};

interface BoardPageProps {
  params: Promise<{ meetingId: string }>;
  searchParams: Promise<{ roomId?: string }>;
}

// /meetings/:meetingId/board?roomId=… — bảng của buổi đã kết thúc, chỉ xem (đề cương §5.8)
export default async function BoardPage({ params, searchParams }: BoardPageProps) {
  const [{ meetingId }, { roomId }] = await Promise.all([params, searchParams]);
  return <WhiteboardReview meetingId={meetingId} roomId={roomId} />;
}
