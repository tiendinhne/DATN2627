"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, Users } from "lucide-react";
import { useConnectionState, useParticipants } from "@livekit/components-react";

interface MeetingHeaderProps {
  roomName: string;
  meetingTitle: string;
  participantCount: number;
  duration?: string;
  isConnected?: boolean;
  isHost?: boolean;
  onBack: () => void;
  onLeave: () => void;
}

export function MeetingHeader({
  roomName,
  meetingTitle,
  participantCount,
  duration = "00:00:00",
  isConnected = true,
  isHost = true,
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
      <span className="connected" style={{ color: isConnected ? "#64bd96" : "#f59e0b" }}>
        <i style={{ background: isConnected ? "#58c28e" : "#f59e0b" }} />
        {isConnected ? "Đã kết nối" : "Đang kết nối..."}
      </span>
      <div className="meeting-header-meta">
        <span>
          <Users size={16} /> {participantCount}
        </span>
        <span>{duration}</span>
        <button
          className={`button ${isHost ? "leave" : "secondary"}`}
          onClick={onLeave}
          type="button"
        >
          {isHost ? "Kết thúc" : "Rời phòng"}
        </button>
      </div>
    </header>
  );
}

export function LiveMeetingHeader({
  roomName,
  meetingTitle,
  startedAt,
  isHost,
  onBack,
  onLeave,
}: {
  roomName: string;
  meetingTitle: string;
  startedAt?: string;
  isHost: boolean;
  onBack: () => void;
  onLeave: () => void;
}) {
  const participants = useParticipants();
  const connectionState = useConnectionState();
  const [durationStr, setDurationStr] = useState("00:00:00");

  useEffect(() => {
    if (!startedAt) return;
    const startMs = new Date(startedAt).getTime();

    const updateTimer = () => {
      const diffSec = Math.max(0, Math.floor((Date.now() - startMs) / 1000));
      const hours = Math.floor(diffSec / 3600);
      const minutes = Math.floor((diffSec % 3600) / 60);
      const seconds = diffSec % 60;
      const pad = (n: number) => String(n).padStart(2, "0");
      setDurationStr(`${pad(hours)}:${pad(minutes)}:${pad(seconds)}`);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [startedAt]);

  const isConnected = connectionState === "connected";

  return (
    <header className="meeting-header">
      <div>
        <p>{roomName}</p>
        <h1>{meetingTitle}</h1>
      </div>
      <span className="connected" style={{ color: isConnected ? "#64bd96" : "#f59e0b" }}>
        <i style={{ background: isConnected ? "#58c28e" : "#f59e0b" }} />
        {isConnected ? "Đã kết nối" : connectionState === "connecting" ? "Đang kết nối..." : "Mất kết nối"}
      </span>
      <div className="meeting-header-meta">
        <span>
          <Users size={16} /> {participants.length}
        </span>
        <span>{durationStr}</span>
        <button
          className={`button ${isHost ? "leave" : "secondary"}`}
          onClick={onLeave}
          type="button"
        >
          {isHost ? "Kết thúc" : "Rời phòng"}
        </button>
      </div>
    </header>
  );
}

export default MeetingHeader;
