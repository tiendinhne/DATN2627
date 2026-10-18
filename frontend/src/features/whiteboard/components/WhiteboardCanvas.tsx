"use client";

import { Minus, MousePointer2, Plus } from "lucide-react";
import { useState } from "react";
import { WhiteboardToolbar } from "./WhiteboardToolbar";

export function WhiteboardCanvas() {
  const [tool, setTool] = useState("select");
  const [zoom, setZoom] = useState(100);

  const handleZoomIn = () => setZoom((z) => Math.min(200, z + 10));
  const handleZoomOut = () => setZoom((z) => Math.max(50, z - 10));

  return (
    <div className="whiteboard">
      <WhiteboardToolbar currentTool={tool} onToolChange={setTool} />

      <div className="diagram-node start">ĐĂNG NHẬP</div>
      <div className="diagram-line line-one" />
      <div className="diagram-node validate">Kiểm tra dữ liệu</div>
      <div className="diagram-branch branch-one" />
      <div className="diagram-node success">Thành công</div>
      <div className="diagram-node error">Sai thông tin</div>
      <div className="diagram-note">
        <span>MA</span> Cần thêm bước xác thực?
      </div>
      <div className="cursor-label cursor-one">
        <MousePointer2 size={15} fill="currentColor" /> Minh Anh
      </div>
      <div className="cursor-label cursor-two">
        <MousePointer2 size={15} fill="currentColor" /> Quang Huy
      </div>

      <div className="zoom-control">
        <button type="button" onClick={handleZoomOut} aria-label="Thu nhỏ">
          <Minus size={15} />
        </button>
        <span>{zoom}%</span>
        <button type="button" onClick={handleZoomIn} aria-label="Phóng to">
          <Plus size={15} />
        </button>
      </div>
    </div>
  );
}

export default WhiteboardCanvas;
