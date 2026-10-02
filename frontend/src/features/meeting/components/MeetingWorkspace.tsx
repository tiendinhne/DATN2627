"use client";

import { useState } from "react";
import {
  Bot,
  ChevronRight,
  MessageSquare,
  Sparkles,
  Users,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useTheme } from "@/context/ThemeContext";
import { participants } from "@/data/mockData";
import { MeetingChat } from "@/features/chat";
import { AIPanel, WhiteboardCanvas } from "@/features/whiteboard";
import { EndMeetingModal } from "./EndMeetingModal";
import { MeetingControls } from "./MeetingControls";
import { MeetingHeader } from "./MeetingHeader";
import { ParticipantPanel } from "./ParticipantPanel";
import { VideoRail } from "./VideoRail";

interface MeetingWorkspaceProps {
  dark?: boolean;
  meetingId?: string;
  onBack?: () => void;
}

export function MeetingWorkspace({
  dark: propDark,
  meetingId = "sprint-review-05",
  onBack,
}: MeetingWorkspaceProps) {
  const router = useRouter();
  const { dark: contextDark } = useTheme();
  const isDark = propDark !== undefined ? propDark : contextDark;

  const [muted, setMuted] = useState(false);
  const [camera, setCamera] = useState(true);
  const [sideTab, setSideTab] = useState<"chat" | "people" | "ai">("chat");
  const [panelOpen, setPanelOpen] = useState(true);
  const [endConfirm, setEndConfirm] = useState(false);

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      router.push("/rooms/software-engineering");
    }
  };

  return (
    <div className={`meeting-workspace ${isDark ? "dark" : ""}`}>
      <MeetingHeader
        roomName="Software Engineering"
        meetingTitle="Họp tiến độ tuần 5"
        participantCount={participants.length + 1}
        onBack={handleBack}
        onLeave={() => setEndConfirm(true)}
      />

      <div className="meeting-body">
        <VideoRail participants={participants} />

        <main className="board-area">
          <div className="board-topbar">
            <div className="board-title">
              <strong>Bảng vẽ cộng tác</strong>
              <span>Đã lưu lúc 14:32</span>
            </div>
            <div className="collaborators">
              <span style={{ background: "#5667e9" }}>AN</span>
              <span style={{ background: "#dd7a55" }}>MA</span>
              <span style={{ background: "#349a79" }}>QH</span>
              <small>+2</small>
            </div>
            <button
              className="ai-button"
              onClick={() => {
                setPanelOpen(true);
                setSideTab("ai");
              }}
              type="button"
            >
              <Sparkles size={16} /> AI hỗ trợ
            </button>
          </div>

          <WhiteboardCanvas />
        </main>

        {panelOpen && (
          <aside className="meeting-panel">
            <div className="panel-tabs">
              <button
                className={sideTab === "chat" ? "active" : ""}
                onClick={() => setSideTab("chat")}
                type="button"
              >
                <MessageSquare size={16} /> Trò chuyện
              </button>
              <button
                className={sideTab === "people" ? "active" : ""}
                onClick={() => setSideTab("people")}
                type="button"
                aria-label="Thành viên"
              >
                <Users size={16} />
              </button>
              <button
                className={sideTab === "ai" ? "active" : ""}
                onClick={() => setSideTab("ai")}
                type="button"
                aria-label="AI hỗ trợ"
              >
                <Bot size={16} />
              </button>
              <button
                className="collapse"
                onClick={() => setPanelOpen(false)}
                type="button"
                aria-label="Thu gọn"
              >
                <ChevronRight size={17} />
              </button>
            </div>

            {sideTab === "chat" ? (
              <MeetingChat />
            ) : sideTab === "ai" ? (
              <AIPanel />
            ) : (
              <ParticipantPanel participants={participants} />
            )}
          </aside>
        )}
      </div>

      <MeetingControls
        muted={muted}
        camera={camera}
        onToggleMic={() => setMuted(!muted)}
        onToggleCamera={() => setCamera(!camera)}
        onOpenChat={() => {
          setPanelOpen(true);
          setSideTab("chat");
        }}
        onOpenPeople={() => {
          setPanelOpen(true);
          setSideTab("people");
        }}
        onHangup={handleBack}
      />

      {endConfirm && (
        <EndMeetingModal
          onClose={() => setEndConfirm(false)}
          onConfirm={handleBack}
        />
      )}
    </div>
  );
}

export default MeetingWorkspace;
