"use client";

import dynamic from "next/dynamic";
// CSS bắt buộc của Excalidraw (README của thư viện)
import "@excalidraw/excalidraw/index.css";

// Excalidraw dùng window/canvas nên chỉ render ở client → tắt SSR (cách Excalidraw hướng dẫn cho Next.js)
const Excalidraw = dynamic(
  async () => (await import("@excalidraw/excalidraw")).Excalidraw,
  { ssr: false }
);

interface WhiteboardCanvasProps {
  dark?: boolean;
  // Ẩn chứ không gỡ khỏi cây khi đang ghim nội dung khác — gỡ ra là mất nét vẽ (chưa có đồng bộ / lưu)
  hidden?: boolean;
}

// Hiện chỉ chạy local: chưa đồng bộ giữa người dùng, tải lại trang là mất nét vẽ
// Không đặt langCode="vi-VN": Excalidraw 0.18.1 mới dịch 49% tiếng Việt, dưới ngưỡng 85% nên tự rơi về tiếng Anh
export function WhiteboardCanvas({ dark = false, hidden = false }: WhiteboardCanvasProps) {
  return (
    <div className="whiteboard" hidden={hidden}>
      <Excalidraw theme={dark ? "dark" : "light"} />
    </div>
  );
}

export default WhiteboardCanvas;
