"use client";

import { Sparkles } from "lucide-react";
import { useState } from "react";
import { AiRequestKind } from "@shared/enums";
import { AI_PROMPT_MAX_LENGTH, AI_PROMPT_MIN_LENGTH } from "@shared/ai";
import type { WhiteboardAi } from "../hooks/useWhiteboardSync";

// 3 loại sơ đồ của đề cương §5.7 — mỗi nút chọn loại và điền câu mẫu
const KINDS = [
  { kind: AiRequestKind.FLOWCHART, label: "Flowchart", sample: "Tạo flowchart cho quy trình đăng nhập người dùng" },
  { kind: AiRequestKind.MINDMAP, label: "Mind map", sample: "Tạo sơ đồ mind map phân tích yêu cầu đồ án" },
  { kind: AiRequestKind.DIAGRAM, label: "Sơ đồ", sample: "Tạo sơ đồ kiến trúc hệ thống gồm frontend, backend và database" },
];

// ai = null khi bảng vẽ chưa báo trạng thái lên (đang tải / chưa nối)
export function AIPanel({ ai }: { ai: WhiteboardAi | null }) {
  const [kind, setKind] = useState<AiRequestKind>(KINDS[0].kind);
  const [prompt, setPrompt] = useState(KINDS[0].sample);
  const pending = ai?.status === "pending";
  const canSubmit = Boolean(ai) && !pending && prompt.trim().length >= AI_PROMPT_MIN_LENGTH;

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
        <textarea value={prompt} maxLength={AI_PROMPT_MAX_LENGTH} onChange={(e) => setPrompt(e.target.value)} />
      </label>
      <div className="suggestions">
        {KINDS.map((item) => (
          <button
            key={item.kind}
            type="button"
            className={kind === item.kind ? "active" : ""}
            onClick={() => {
              setKind(item.kind);
              setPrompt(item.sample);
            }}
          >
            {item.label}
          </button>
        ))}
      </div>
      <button
        className="button primary w-full"
        type="button"
        disabled={!canSubmit}
        onClick={() => ai?.generate(prompt.trim(), kind)}
      >
        <Sparkles size={17} /> {pending ? "Đang tạo sơ đồ..." : "Tạo sơ đồ"}
      </button>
      {ai?.status === "error" && <p className="ai-error">{ai.message}</p>}
      {!ai && <p className="ai-note">Bảng vẽ đang kết nối...</p>}
    </div>
  );
}

export default AIPanel;
