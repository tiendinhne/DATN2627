"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
// CSS bắt buộc của Excalidraw (README của thư viện)
import "@excalidraw/excalidraw/index.css";
import { useWhiteboardSync } from "../hooks/useWhiteboardSync";
import type { WhiteboardAi } from "../hooks/useWhiteboardSync";

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
  // Báo trạng thái AI + hàm tạo sơ đồ lên MeetingWorkspace — AIPanel nằm ở panel bên, ngoài canvas (spec AI §8.4)
  onAiChange?: (ai: WhiteboardAi) => void;
}

// Không đặt langCode="vi-VN": Excalidraw 0.18.1 mới dịch 49% tiếng Việt, dưới ngưỡng 85% nên tự rơi về tiếng Anh
export function WhiteboardCanvas({ dark = false, hidden = false, token, meetingId, onAiChange }: WhiteboardCanvasProps) {
  const [api, setApi] = useState<ExcalidrawImperativeAPI | null>(null);
  const { onChange, onPointerUpdate, notice, clearNotice, ai } = useWhiteboardSync({ token, meetingId, api });

  // ai chỉ đổi khi trạng thái đổi (useMemo trong hook) → không render lặp
  useEffect(() => {
    onAiChange?.(ai);
  }, [ai, onAiChange]);

  // Thông báo đồng bộ bảng vẽ hiện bằng toast có sẵn của Excalidraw (tự tắt sau 5 s, có nút đóng).
  // Hiện xong thì xoá notice → cùng một thông báo lặp lại (vd mỗi lần thử nối lại) vẫn hiện lại được
  useEffect(() => {
    if (!api || !notice) return;
    api.setToast({ message: notice, closable: true });
    clearNotice();
  }, [api, notice, clearNotice]);

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
    </div>
  );
}

export default WhiteboardCanvas;
