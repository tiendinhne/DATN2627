"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
// CSS bắt buộc của Excalidraw (README của thư viện)
import "@excalidraw/excalidraw/index.css";
import { useWhiteboardSync } from "../hooks/useWhiteboardSync";

// Excalidraw dùng window/canvas nên chỉ render ở client → tắt SSR (cách Excalidraw hướng dẫn cho Next.js)
const Excalidraw = dynamic(
  async () => (await import("@excalidraw/excalidraw")).Excalidraw,
  { ssr: false }
);

// Tắt chèn ảnh (nút, dán, kéo thả) — ảnh làm ở spec sau. Hằng ngoài component để không tạo object mới mỗi render
const UI_OPTIONS = { tools: { image: false } };

interface WhiteboardCanvasProps {
  dark?: boolean;
  // Ẩn chứ không gỡ khỏi cây khi đang ghim nội dung khác — gỡ ra là mất kết nối đồng bộ
  hidden?: boolean;
  // Có token + meetingId → đồng bộ realtime; thiếu → chạy local
  token?: string | null;
  meetingId?: string;
}

// Không đặt langCode="vi-VN": Excalidraw 0.18.1 mới dịch 49% tiếng Việt, dưới ngưỡng 85% nên tự rơi về tiếng Anh
export function WhiteboardCanvas({ dark = false, hidden = false, token, meetingId }: WhiteboardCanvasProps) {
  const [api, setApi] = useState<ExcalidrawImperativeAPI | null>(null);
  const { onChange, onPointerUpdate, notice, clearNotice } = useWhiteboardSync({ token, meetingId, api });

  return (
    <div className="whiteboard" hidden={hidden}>
      <Excalidraw
        excalidrawAPI={setApi}
        theme={dark ? "dark" : "light"}
        onChange={onChange}
        onPointerUpdate={onPointerUpdate}
        isCollaborating={Boolean(meetingId)}
        // AI của đồ án là module riêng → tắt hộp thoại text-to-diagram / magicframe của Excalidraw
        aiEnabled={false}
        UIOptions={UI_OPTIONS}
      />
      {notice && (
        <button
          type="button"
          onClick={clearNotice}
          className="absolute bottom-3 left-1/2 z-10 -translate-x-1/2 rounded-md bg-slate-900/90 px-3 py-1.5 text-sm text-white"
        >
          {notice}
        </button>
      )}
    </div>
  );
}

export default WhiteboardCanvas;
