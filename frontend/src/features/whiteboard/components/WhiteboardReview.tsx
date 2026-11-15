"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";
// CSS bắt buộc của Excalidraw (README của thư viện)
import "@excalidraw/excalidraw/index.css";
import { useAuth } from "@/context/auth.context";
import { useTheme } from "@/context/ThemeContext";
import { getMeetingWhiteboard } from "@/services/meeting.service";

// Excalidraw dùng window/canvas → chỉ render ở client (giống WhiteboardCanvas)
const Excalidraw = dynamic(async () => (await import("@excalidraw/excalidraw")).Excalidraw, { ssr: false });

interface WhiteboardReviewProps {
  meetingId: string;
  roomId?: string;
}

// Xem lại bảng của buổi đã kết thúc (đề cương §5.8): tải bản lưu Mongo, mở Excalidraw ở chế độ chỉ xem.
// Không kết nối socket — buổi đã kết thúc thì bảng không còn đồng bộ
export function WhiteboardReview({ meetingId, roomId }: WhiteboardReviewProps) {
  const { token, isLoading } = useAuth();
  const { dark } = useTheme();
  const router = useRouter();
  const [board, setBoard] = useState<{ elements: ExcalidrawElement[]; lastPersistedAt: string | null } | null>(null);
  const [error, setError] = useState("");

  // Chưa đăng nhập → /login, đăng nhập xong quay lại đúng trang này (giống trang meeting)
  useEffect(() => {
    if (!isLoading && !token) {
      router.replace(`/login?returnUrl=${encodeURIComponent(window.location.pathname + window.location.search)}`);
    }
  }, [isLoading, token, router]);

  useEffect(() => {
    if (!token) return;
    getMeetingWhiteboard(token, meetingId)
      .then((data) =>
        setBoard({ elements: data.elements as ExcalidrawElement[], lastPersistedAt: data.lastPersistedAt })
      )
      .catch((err: Error) => setError(err.message));
  }, [token, meetingId]);

  const backHref = roomId ? `/rooms/${roomId}` : "/rooms";

  return (
    <div className={`flex h-screen flex-col ${dark ? "bg-slate-950 text-slate-100" : "bg-white text-slate-900"}`}>
      <header className="flex items-center justify-between gap-4 border-b border-slate-200/20 px-4 py-3">
        <div>
          <h1 className="text-base font-semibold">Xem lại bảng vẽ</h1>
          <p className="text-xs opacity-70">
            {board?.lastPersistedAt
              ? `Lưu lần cuối: ${new Date(board.lastPersistedAt).toLocaleString("vi-VN")} · chỉ xem`
              : "Chỉ xem"}
          </p>
        </div>
        <Link href={backHref} className="button secondary small">
          Quay lại phòng
        </Link>
      </header>

      <main className="relative min-h-0 flex-1">
        {error ? (
          <p className="p-6 text-sm text-red-500">{error}</p>
        ) : !board ? (
          <p className="p-6 text-sm opacity-70">Đang tải bảng vẽ...</p>
        ) : board.elements.length === 0 ? (
          <p className="p-6 text-sm opacity-70">Buổi học này không có nội dung trên bảng vẽ.</p>
        ) : (
          <Excalidraw
            initialData={{ elements: board.elements, scrollToContent: true }}
            viewModeEnabled
            theme={dark ? "dark" : "light"}
            // AI của đồ án là module riêng; bảng chỉ xem nên tắt luôn hộp thoại AI có sẵn của Excalidraw
            aiEnabled={false}
          />
        )}
      </main>
    </div>
  );
}

export default WhiteboardReview;
