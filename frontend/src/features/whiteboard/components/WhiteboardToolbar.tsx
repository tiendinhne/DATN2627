"use client";

import {
  Circle,
  Eraser,
  Hand,
  Image,
  MousePointer2,
  Pencil,
  Redo2,
  Square,
  Type,
  Undo2,
} from "lucide-react";
import type { WhiteboardTool } from "../types";

interface WhiteboardToolbarProps {
  currentTool: string;
  onToolChange: (tool: string) => void;
}

const tools = [
  ["select", MousePointer2],
  ["hand", Hand],
  ["shape", Square],
  ["circle", Circle],
  ["pen", Pencil],
  ["text", Type],
  ["image", Image],
  ["eraser", Eraser],
] as const;

export function WhiteboardToolbar({
  currentTool,
  onToolChange,
}: WhiteboardToolbarProps) {
  return (
    <div className="whiteboard-toolbar">
      {tools.map(([name, Icon]) => (
        <button
          key={name}
          className={currentTool === name ? "active" : ""}
          onClick={() => onToolChange(name)}
          aria-label={name}
          type="button"
        >
          <Icon size={18} />
        </button>
      ))}
      <span />
      <button type="button" aria-label="Hoàn tác">
        <Undo2 size={18} />
      </button>
      <button type="button" aria-label="Làm lại">
        <Redo2 size={18} />
      </button>
    </div>
  );
}

export default WhiteboardToolbar;
