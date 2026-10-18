"use client";

import { Sparkles } from "lucide-react";
import { useState } from "react";

export function AIPanel() {
  const [prompt, setPrompt] = useState(
    "Tạo flowchart cho quy trình đăng nhập người dùng"
  );

  return (
    <div className="ai-panel">
      <div className="ai-hero">
        <span>
          <Sparkles size={20} />
        </span>
        <h2>AI Whiteboard</h2>
        <p>Biến ý tưởng thành nội dung trực quan trên bảng vẽ.</p>
      </div>
      <label>
        Bạn muốn tạo gì?
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
        />
      </label>
      <div className="suggestions">
        <button
          type="button"
          onClick={() => setPrompt("Tạo sơ đồ Mind map phân tích yêu cầu đồ án")}
        >
          Mind map
        </button>
        <button
          type="button"
          onClick={() => setPrompt("Tạo flowchart cho quy trình đăng nhập người dùng")}
        >
          Flowchart
        </button>
        <button
          type="button"
          onClick={() => setPrompt("Tạo bảng ghi chú các task cho Sprint 5")}
        >
          Ghi chú
        </button>
      </div>
      <button className="button primary w-full" type="button">
        <Sparkles size={17} /> Tạo bản xem trước
      </button>
    </div>
  );
}

export default AIPanel;
