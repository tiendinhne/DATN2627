"use client";

import { LayoutGrid, Mic, MicOff, MonitorUp, Pin } from "lucide-react";
import {
  isTrackReference,
  VideoTrack,
  type TrackReferenceOrPlaceholder,
} from "@livekit/components-react";
import { Track } from "livekit-client";
import type { Participant } from "../types";
import { getAvatarColor, getInitials } from "../services/meeting.service";

interface VideoRailProps {
  participants?: Participant[];
  pinnedParticipantId?: string;
  onPinParticipant?: (id: string, name: string) => void;
}

export function VideoRail({
  participants = [],
  pinnedParticipantId,
  onPinParticipant,
}: VideoRailProps) {
  return (
    <aside className="video-rail">
      <div className="rail-title">
        <span>Người tham gia ({participants.length})</span>
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
          {onPinParticipant && (
            <button
              className={`participant-pin ${pinnedParticipantId === person.id ? "active" : ""}`}
              onClick={() => onPinParticipant(person.id, person.name)}
              type="button"
              title={pinnedParticipantId === person.id ? "Bỏ ghim người tham gia" : "Ghim người tham gia"}
              aria-label={pinnedParticipantId === person.id ? "Bỏ ghim người tham gia" : `Ghim ${person.name}`}
              aria-pressed={pinnedParticipantId === person.id}
            >
              <Pin size={13} />
            </button>
          )}
        </div>
      ))}
    </aside>
  );
}

export function LiveVideoRail({
  tracks,
  pinnedTrackKey,
  onPinTrack,
}: {
  tracks: TrackReferenceOrPlaceholder[];
  pinnedTrackKey?: string;
  onPinTrack: (key: string, name: string) => void;
}) {
  return (
    <aside className="video-rail">
      <div className="rail-title">
        <span>Người tham gia ({tracks.length})</span>
        <button type="button" aria-label="Xem lưới">
          <LayoutGrid size={16} />
        </button>
      </div>
      {tracks.length === 0 ? (
        <div className="p-3 text-center text-xs text-slate-400">
          Đang kết nối thiết bị...
        </div>
      ) : (
        tracks.map((trackRef) => {
          const p = trackRef.participant;
          const name = p.name || p.identity || "Thành viên";
          const isScreenShare = trackRef.source === Track.Source.ScreenShare;
          const trackKey = `${p.identity}-${trackRef.source}`;
          const isPinned = pinnedTrackKey === trackKey;
          const hasTrack = isTrackReference(trackRef) && trackRef.publication && !trackRef.publication.isMuted;
          const isVideoActive = isTrackReference(trackRef) && (isScreenShare || (p.isCameraEnabled && hasTrack));

          return (
            <div
              className={`participant-tile ${p.isSpeaking ? "speaking" : ""}`}
              key={`${p.identity}-${trackRef.source}`}
            >
              {isVideoActive ? (
                <div style={{ position: "absolute", inset: 0, zIndex: 1, overflow: "hidden" }}>
                  <VideoTrack
                    trackRef={trackRef}
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                </div>
              ) : (
                <div
                  className="participant-avatar"
                  style={{ background: getAvatarColor(name) }}
                >
                  {getInitials(name)}
                </div>
              )}
              <span style={{ zIndex: 2 }}>
                {isScreenShare ? `Màn hình ${name}` : p.isLocal ? "Bạn" : name}
              </span>
              <i style={{ zIndex: 2 }}>
                {isScreenShare ? (
                  <MonitorUp size={13} />
                ) : p.isMicrophoneEnabled ? (
                  <Mic size={13} />
                ) : (
                  <MicOff size={13} />
                )}
              </i>
              <button
                className={`participant-pin ${isPinned ? "active" : ""}`}
                onClick={() => onPinTrack(trackKey, isScreenShare ? `Màn hình ${name}` : name)}
                type="button"
                title={isPinned ? "Bỏ ghim" : isScreenShare ? "Ghim màn hình đang chia sẻ" : "Ghim người tham gia"}
                aria-label={isPinned ? `Bỏ ghim ${isScreenShare ? "màn hình" : name}` : `Ghim ${isScreenShare ? "màn hình" : name}`}
                aria-pressed={isPinned}
              >
                <Pin size={13} />
              </button>
            </div>
          );
        })
      )}
    </aside>
  );
}

export default VideoRail;
