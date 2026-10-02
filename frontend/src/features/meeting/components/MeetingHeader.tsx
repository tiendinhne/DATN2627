"use client";

import { ArrowLeft, Users } from "lucide-react";

interface MeetingHeaderProps {
  roomName: string;
  meetingTitle: string;
  participantCount: number;
  duration?: string;
  onBack: () => void;
  onLeave: () => void;
}

export function MeetingHeader({
  roomName,
  meetingTitle,
  participantCount,
  duration = "00:32:18",
  onBack,
  onLeave,
}: MeetingHeaderProps) {
  return (
    <header className="meeting-header">
      <button className="meeting-back" onClick={onBack} type="button" aria-label="Quay lại">
        <ArrowLeft size={18} />
      </button>
      <div>
        <p>{roomName}</p>
        <h1>{meetingTitle}</h1>
      </div>
      <span className="connected">
        <i /> Đã kết nối
      </span>
      <div className="meeting-header-meta">
        <span>
          <Users size={16} /> {participantCount}
        </span>
        <span>{duration}</span>
        <button className="button leave" onClick={onLeave} type="button">
          Kết thúc
        </button>
      </div>
    </header>
  );
}

export default MeetingHeader;
