"use client";

import { Mic, MicOff } from "lucide-react";
import { useParticipants } from "@livekit/components-react";
import type { Participant } from "../types";
import { getAvatarColor, getInitials } from "../services/meeting.service";

interface ParticipantPanelProps {
  participants?: Participant[];
  currentUserName?: string;
  isHost?: boolean;
}

export function ParticipantPanel({
  participants = [],
  currentUserName = "Bạn",
  isHost = false,
}: ParticipantPanelProps) {
  return (
    <div className="people-panel">
      <h2>Trong cuộc họp ({participants.length + 1})</h2>
      <div key="self">
        <span style={{ background: getAvatarColor(currentUserName) }}>
          {getInitials(currentUserName)}
        </span>
        <strong>
          {currentUserName} {isHost ? "(Chủ phòng)" : ""}
        </strong>
        <Mic size={15} />
      </div>
      {participants.map((person) => (
        <div key={person.id}>
          <span style={{ background: person.color }}>{person.initials}</span>
          <strong>{person.name}</strong>
          {person.muted ? <MicOff size={15} /> : <Mic size={15} />}
        </div>
      ))}
    </div>
  );
}

export function LiveParticipantPanel({ isHost }: { isHost?: boolean }) {
  const participants = useParticipants();

  return (
    <div className="people-panel">
      <h2>Trong cuộc họp ({participants.length})</h2>
      {participants.map((p) => {
        const name = p.name || p.identity || "Thành viên";
        return (
          <div key={p.identity}>
            <span style={{ background: getAvatarColor(name) }}>
              {getInitials(name)}
            </span>
            <strong>
              {p.isLocal ? `Bạn (${name})` : name}
              {p.isLocal && isHost ? " (Host)" : ""}
            </strong>
            {p.isMicrophoneEnabled ? <Mic size={15} /> : <MicOff size={15} />}
          </div>
        );
      })}
    </div>
  );
}

export default ParticipantPanel;
