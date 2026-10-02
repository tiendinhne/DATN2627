"use client";

import {
  MessageSquare,
  Mic,
  MicOff,
  MonitorUp,
  PhoneOff,
  Shapes,
  Users,
  Video,
  VideoOff,
} from "lucide-react";

interface MeetingControlsProps {
  muted: boolean;
  camera: boolean;
  onToggleMic: () => void;
  onToggleCamera: () => void;
  onOpenChat: () => void;
  onOpenPeople: () => void;
  onHangup: () => void;
}

export function MeetingControls({
  muted,
  camera,
  onToggleMic,
  onToggleCamera,
  onOpenChat,
  onOpenPeople,
  onHangup,
}: MeetingControlsProps) {
  return (
    <footer className="meeting-controls">
      <div className="control-group">
        <button
          className={muted ? "danger" : ""}
          onClick={onToggleMic}
          type="button"
        >
          {muted ? <MicOff size={20} /> : <Mic size={20} />}
          <span>Mic</span>
        </button>
        <button
          className={!camera ? "danger" : ""}
          onClick={onToggleCamera}
          type="button"
        >
          {camera ? <Video size={20} /> : <VideoOff size={20} />}
          <span>Camera</span>
        </button>
        <button type="button">
          <MonitorUp size={20} />
          <span>Chia sẻ</span>
        </button>
      </div>
      <div className="control-group">
        <button onClick={onOpenChat} type="button">
          <MessageSquare size={20} />
          <span>Trò chuyện</span>
        </button>
        <button onClick={onOpenPeople} type="button">
          <Users size={20} />
          <span>Thành viên</span>
        </button>
        <button type="button">
          <Shapes size={20} />
          <span>Công cụ</span>
        </button>
      </div>
      <button className="hangup" onClick={onHangup} type="button">
        <PhoneOff size={20} />
        <span>Rời cuộc họp</span>
      </button>
    </footer>
  );
}

export default MeetingControls;
