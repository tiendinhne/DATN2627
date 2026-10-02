import { Mic, MicOff } from "lucide-react";
import type { Participant } from "../types";

interface ParticipantPanelProps {
  participants: Participant[];
}

export function ParticipantPanel({ participants }: ParticipantPanelProps) {
  return (
    <div className="people-panel">
      <h2>Trong cuộc họp ({participants.length + 1})</h2>
      <div key="self">
        <span style={{ background: "#5869e8" }}>AN</span>
        <strong>Bạn (Chủ phòng)</strong>
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

export default ParticipantPanel;
