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
import { useLocalParticipant } from "@livekit/components-react";

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

export function LiveMeetingControls({
  onOpenChat,
  onOpenPeople,
  onHangup,
}: {
  onOpenChat: () => void;
  onOpenPeople: () => void;
  onHangup: () => void;
}) {
  const { localParticipant, isMicrophoneEnabled, isCameraEnabled, isScreenShareEnabled } =
    useLocalParticipant();

  const toggleMic = async () => {
    try {
      await localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled);
    } catch (err) {
      console.warn("Lỗi bật/tắt micro:", err);
    }
  };

  const toggleCamera = async () => {
    try {
      await localParticipant.setCameraEnabled(!isCameraEnabled);
    } catch (err) {
      console.warn("Lỗi bật/tắt camera:", err);
    }
  };

  const toggleScreen = async () => {
    try {
      await localParticipant.setScreenShareEnabled(!isScreenShareEnabled);
    } catch (err) {
      console.warn("Lỗi chia sẻ màn hình:", err);
    }
  };

  return (
    <footer className="meeting-controls">
      <div className="control-group">
        <button
          className={!isMicrophoneEnabled ? "danger" : ""}
          onClick={toggleMic}
          type="button"
          title={isMicrophoneEnabled ? "Tắt micro" : "Bật micro"}
        >
          {isMicrophoneEnabled ? <Mic size={20} /> : <MicOff size={20} />}
          <span>Mic</span>
        </button>
        <button
          className={!isCameraEnabled ? "danger" : ""}
          onClick={toggleCamera}
          type="button"
          title={isCameraEnabled ? "Tắt camera" : "Bật camera"}
        >
          {isCameraEnabled ? <Video size={20} /> : <VideoOff size={20} />}
          <span>Camera</span>
        </button>
        <button
          className={isScreenShareEnabled ? "active" : ""}
          onClick={toggleScreen}
          type="button"
          title={isScreenShareEnabled ? "Dừng chia sẻ màn hình" : "Chia sẻ màn hình"}
        >
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
