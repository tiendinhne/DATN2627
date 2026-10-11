'use client';

import { ControlBar, GridLayout, ParticipantTile, RoomAudioRenderer, useTracks } from '@livekit/components-react';
import { Track } from 'livekit-client';

// Phần cuộc gọi — PHẢI nằm bên trong <LiveKitRoom>: useTracks cần RoomContext (spec §11.3).
// Không dùng <VideoConference>: nó tự gắn <Chat> chạy trên data channel (trái P2 — app data đi Socket.IO)
export function MeetingStage() {
  // Camera của mọi người (chưa bật cam vẫn có ô placeholder) + màn hình đang chia sẻ
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false },
  );

  return (
    <div className="flex h-full flex-col">
      {/* GridLayout tự phân trang khi nhiều ô (webrtc.md §5) */}
      <GridLayout tracks={tracks} className="min-h-0 flex-1">
        <ParticipantTile />
      </GridLayout>
      {/* Tắt nút chat: chat của hệ thống đi Socket.IO, không qua LiveKit */}
      <ControlBar controls={{ chat: false }} />
      <RoomAudioRenderer />
    </div>
  );
}
