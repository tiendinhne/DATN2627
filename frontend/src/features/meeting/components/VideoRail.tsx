import { LayoutGrid, Mic, MicOff } from "lucide-react";
import type { Participant } from "../types";

interface VideoRailProps {
  participants: Participant[];
}

export function VideoRail({ participants }: VideoRailProps) {
  return (
    <aside className="video-rail">
      <div className="rail-title">
        <span>Người tham gia</span>
        <button type="button" aria-label="Xem lưới">
          <LayoutGrid size={16} />
        </button>
      </div>
      {participants.map((person) => (
        <div
          className={`participant-tile ${person.speaking ? "speaking" : ""}`}
          key={person.id}
        >
          <div
            className="participant-avatar"
            style={{ background: person.color }}
          >
            {person.initials}
          </div>
          <span>{person.name}</span>
          <i>{person.muted ? <MicOff size={13} /> : <Mic size={13} />}</i>
        </div>
      ))}
    </aside>
  );
}

export default VideoRail;
