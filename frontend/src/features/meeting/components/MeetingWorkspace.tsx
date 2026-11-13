"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Bot,
  ChevronRight,
  MessageSquare,
  Pin,
  Sparkles,
  Users,
  Video,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  isTrackReference,
  LiveKitRoom,
  RoomAudioRenderer,
  useTracks,
  VideoTrack,
} from "@livekit/components-react";
import {
  DisconnectReason,
  MediaDeviceFailure,
  Track,
  VideoPresets,
  type RoomOptions,
} from "livekit-client";
import "@livekit/components-styles";

import { useAuth } from "@/context/auth.context";
import { useTheme } from "@/context/ThemeContext";
import { MeetingChat } from "@/features/chat";
import { getAvatarColor, getInitials } from "@/features/meeting/services/meeting.service";
import { AIPanel, WhiteboardCanvas } from "@/features/whiteboard";
import type { WhiteboardAi } from "@/features/whiteboard";
import { endMeeting, joinMeeting } from "@/services/meeting.service";
import { getRoom } from "@/services/room.service";
import type { JoinMeetingResponse } from "@/types/backend";

import { EndMeetingModal } from "./EndMeetingModal";
import { LiveMeetingControls } from "./MeetingControls";
import { LiveMeetingHeader } from "./MeetingHeader";
import { LiveParticipantPanel } from "./ParticipantPanel";
import { LiveVideoRail } from "./VideoRail";

// LiveKit configuration matching frontend-re spec §11.3, §11.4
const ROOM_OPTIONS: RoomOptions = {
  adaptiveStream: true,
  dynacast: true,
  videoCaptureDefaults: { resolution: VideoPresets.h360.resolution },
};

const DISCONNECT_MESSAGE: Partial<Record<DisconnectReason, string>> = {
  [DisconnectReason.ROOM_DELETED]: "Buổi học đã kết thúc",
  [DisconnectReason.PARTICIPANT_REMOVED]: "Bạn đã bị mời ra khỏi buổi học",
  [DisconnectReason.DUPLICATE_IDENTITY]: "Bạn đã vào buổi học từ tab khác",
};

const DEVICE_MESSAGE: Record<MediaDeviceFailure, string> = {
  [MediaDeviceFailure.PermissionDenied]: "trình duyệt chưa được cấp quyền",
  [MediaDeviceFailure.NotFound]: "không tìm thấy thiết bị",
  [MediaDeviceFailure.DeviceInUse]: "thiết bị đang được ứng dụng khác dùng",
  [MediaDeviceFailure.Other]: "lỗi không xác định",
};

interface MeetingWorkspaceProps {
  dark?: boolean;
  meetingId: string;
  initialRoomId?: string;
  onBack?: () => void;
}

type MeetingPin =
  | { type: "whiteboard" }
  | { type: "track"; key: string; label: string }
  | { type: "participant"; id: string; label: string }
  | null;

/**
 * Live collaborative workspace inside LiveKitRoom
 */
function LiveMeetingContent({
  meetingData,
  roomName,
  isDark,
  deviceWarning,
  onClearDeviceWarning,
  accessToken,
  currentUserId,
  onBack,
  onEndMeeting,
  pinnedContent,
  onPinContent,
}: {
  meetingData: JoinMeetingResponse;
  roomName: string;
  isDark: boolean;
  deviceWarning?: string;
  onClearDeviceWarning?: () => void;
  accessToken: string | null;
  currentUserId?: string;
  onBack: () => void;
  onEndMeeting: () => void;
  pinnedContent: MeetingPin;
  onPinContent: (content: MeetingPin) => void;
}) {
  const [sideTab, setSideTab] = useState<"chat" | "people" | "ai">("chat");
  // Trạng thái AI của bảng (WhiteboardCanvas báo lên) → AIPanel ở panel bên
  const [wbAi, setWbAi] = useState<WhiteboardAi | null>(null);
  const [panelOpen, setPanelOpen] = useState(true);
  const [endConfirm, setEndConfirm] = useState(false);
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false }
  );
  const pinnedTrack =
    pinnedContent?.type === "track"
      ? tracks.find(
          (trackRef) =>
            `${trackRef.participant.identity}-${trackRef.source}` === pinnedContent.key
        )
      : undefined;
  const isPinnedVideoActive =
    pinnedTrack &&
    isTrackReference(pinnedTrack) &&
    (pinnedTrack.source === Track.Source.ScreenShare ||
      (pinnedTrack.participant.isCameraEnabled &&
        pinnedTrack.publication &&
        !pinnedTrack.publication.isMuted));

  const isHost = meetingData.myRole === "HOST";

  const handleLeaveOrEnd = () => {
    if (isHost) {
      setEndConfirm(true);
    } else {
      onBack();
    }
  };

  return (
    <div className={`meeting-workspace ${isDark ? "dark" : ""}`}>
      <LiveMeetingHeader
        roomName={roomName}
        meetingTitle={meetingData.meeting.title}
        startedAt={meetingData.meeting.startedAt}
        isHost={isHost}
        onBack={onBack}
        onLeave={handleLeaveOrEnd}
      />

      {deviceWarning && (
        <div className="flex items-center justify-between gap-3 border-b border-amber-500/30 bg-amber-500/15 px-4 py-2 text-xs text-amber-300">
          <span className="flex items-center gap-2">
            <AlertTriangle size={15} />
            {deviceWarning}
          </span>
          {onClearDeviceWarning && (
            <button
              onClick={onClearDeviceWarning}
              className="text-amber-300 hover:text-white"
              type="button"
            >
              ✕
            </button>
          )}
        </div>
      )}

      <div className="meeting-body">
        <LiveVideoRail
          tracks={tracks}
          pinnedTrackKey={pinnedContent?.type === "track" ? pinnedContent.key : undefined}
          onPinTrack={(key, label) => {
            onPinContent(
              pinnedContent?.type === "track" && pinnedContent.key === key
                ? null
                : { type: "track", key, label }
            );
          }}
        />

        <main className="board-area">
          <div className="board-topbar">
            <div className="board-title">
              <strong>
                {pinnedContent?.type === "track" ? pinnedContent.label : "Bảng vẽ cộng tác"}
              </strong>
              <span>
                {pinnedContent?.type === "track" ? "Đã ghim chỉ với bạn" : "Đã lưu phiên học"}
              </span>
            </div>
            <div className="collaborators">
              <span style={{ background: "#5667e9" }}>AN</span>
              <span style={{ background: "#dd7a55" }}>MA</span>
              <span style={{ background: "#349a79" }}>QH</span>
              <small>+2</small>
            </div>
            <button
              className={`ai-button ${pinnedContent?.type === "whiteboard" ? "active" : ""}`}
              onClick={() => {
                onPinContent(
                  pinnedContent?.type === "whiteboard" ? null : { type: "whiteboard" }
                );
              }}
              title={pinnedContent?.type === "whiteboard" ? "Bỏ ghim bảng vẽ" : "Ghim bảng vẽ"}
              type="button"
            >
              <Pin size={15} /> {pinnedContent?.type === "whiteboard" ? "Đã ghim" : "Ghim bảng vẽ"}
            </button>
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

          {pinnedContent?.type === "track" && pinnedTrack ? (
            <div className="pinned-stage">
              {isPinnedVideoActive ? (
                <VideoTrack
                  trackRef={pinnedTrack}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit:
                      pinnedTrack.source === Track.Source.ScreenShare ? "contain" : "cover",
                  }}
                />
              ) : (
                <div
                  className="participant-avatar pinned-avatar"
                  style={{
                    background: getAvatarColor(
                      pinnedTrack.participant.name || pinnedTrack.participant.identity
                    ),
                  }}
                >
                  {getInitials(
                    pinnedTrack.participant.name || pinnedTrack.participant.identity
                  )}
                </div>
              )}
              <span className="pinned-stage-label">
                <Pin size={13} /> {pinnedContent.label} · chỉ hiển thị với bạn
              </span>
            </div>
          ) : pinnedContent?.type === "track" ? (
            <div className="pinned-stage">
              <span className="pinned-stage-label">
                Màn hình hoặc camera này không còn được chia sẻ.
                <button className="pinned-unpin" onClick={() => onPinContent(null)} type="button">
                  Bỏ ghim
                </button>
              </span>
            </div>
          ) : null}
          {/* Luôn render, chỉ ẩn khi ghim camera / màn hình — để không mất nét vẽ */}
          <WhiteboardCanvas
            dark={isDark}
            hidden={pinnedContent?.type === "track"}
            token={accessToken}
            meetingId={meetingData.meeting.id}
            onAiChange={setWbAi}
          />
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
              <MeetingChat
                roomId={meetingData.meeting.roomId}
                meetingId={meetingData.meeting.id}
                token={accessToken}
                currentUserId={currentUserId}
              />
            ) : sideTab === "ai" ? (
              <AIPanel ai={wbAi} />
            ) : (
              <LiveParticipantPanel isHost={isHost} />
            )}
          </aside>
        )}
      </div>

      <LiveMeetingControls
        onOpenChat={() => {
          setPanelOpen(true);
          setSideTab("chat");
        }}
        onOpenPeople={() => {
          setPanelOpen(true);
          setSideTab("people");
        }}
        onHangup={onBack}
      />

      {endConfirm && (
        <EndMeetingModal
          meetingTitle={meetingData.meeting.title}
          onClose={() => setEndConfirm(false)}
          onConfirm={() => {
            setEndConfirm(false);
            onEndMeeting();
          }}
        />
      )}
    </div>
  );
}

export function MeetingWorkspace({
  dark: propDark,
  meetingId,
  initialRoomId,
  onBack,
}: MeetingWorkspaceProps) {
  const router = useRouter();
  const { token, user, isLoading: isAuthLoading } = useAuth();
  const { dark: contextDark } = useTheme();
  const isDark = propDark !== undefined ? propDark : contextDark;
  const hasValidMeetingId = /^[a-f\d]{24}$/i.test(meetingId);

  const [join, setJoin] = useState<JoinMeetingResponse | null>(null);
  const [joinError, setJoinError] = useState("");
  const [isJoining, setIsJoining] = useState(false);
  const [ended, setEnded] = useState<{ message: string; canRetry: boolean } | null>(null);
  const [deviceWarning, setDeviceWarning] = useState("");
  const [roomName, setRoomName] = useState("Phòng học nhóm");
  const [attempt, setAttempt] = useState(0);
  const [pinnedContent, setPinnedContent] = useState<MeetingPin>(null);

  const connectedRef = useRef(false);
  const tokenRef = useRef(token);
  useEffect(() => {
    tokenRef.current = token;
  }, [token]);

  // Chưa đăng nhập → /login, đăng nhập xong quay lại đúng buổi học (giống trang /join)
  useEffect(() => {
    if (!isAuthLoading && !token) {
      router.replace(`/login?returnUrl=${encodeURIComponent(window.location.pathname + window.location.search)}`);
    }
  }, [isAuthLoading, token, router]);

  // Load meeting backend data and LiveKit token
  useEffect(() => {
    const authToken = tokenRef.current;
    if (!authToken || !hasValidMeetingId) return;
    let cancelled = false;
    setIsJoining(true);

    joinMeeting(authToken, meetingId)
      .then((res) => {
        if (cancelled) return;
        setJoin(res);
        setJoinError("");

        if (res.meeting?.roomId) {
          getRoom(authToken, res.meeting.roomId)
            .then((roomData) => {
              if (!cancelled && roomData?.name) {
                setRoomName(roomData.name);
              }
            })
            .catch(() => {});
        }
      })
      .catch((err: Error) => {
        if (!cancelled) {
          console.warn("Không thể kết nối meeting backend:", err.message);
          setJoinError(err.message || "Không thể kết nối vào cuộc họp");
        }
      })
      .finally(() => {
        if (!cancelled) setIsJoining(false);
      });

    return () => {
      cancelled = true;
    };
  }, [token, meetingId, hasValidMeetingId, attempt]);

  const roomId = (hasValidMeetingId ? join?.meeting.roomId : null) || initialRoomId;

  const handleBack = useCallback(() => {
    if (onBack) {
      onBack();
    } else if (roomId) {
      router.push(`/rooms/${roomId}`);
    } else {
      router.back();
    }
  }, [onBack, router, roomId]);

  const onConnected = useCallback(() => {
    connectedRef.current = true;
  }, []);

  const onDisconnected = useCallback(
    (reason?: DisconnectReason) => {
      if (reason === DisconnectReason.CLIENT_INITIATED) {
        handleBack();
        return;
      }
      const message = reason !== undefined ? DISCONNECT_MESSAGE[reason] : undefined;
      setEnded(message ? { message, canRetry: false } : { message: "Mất kết nối tới buổi học", canRetry: true });
    },
    [handleBack]
  );

  const onError = useCallback((err: Error) => {
    if (err instanceof DOMException) return;
    if (!connectedRef.current) {
      setEnded({ message: `Không kết nối được buổi học: ${err.message}`, canRetry: true });
    }
  }, []);

  const onMediaDeviceFailure = useCallback((failure?: MediaDeviceFailure, kind?: MediaDeviceKind) => {
    const device = kind === "audioinput" ? "micro" : "camera";
    setDeviceWarning(
      `Không bật được ${device}: ${DEVICE_MESSAGE[failure ?? MediaDeviceFailure.Other]}. ` +
        "Bạn vẫn nghe và xem được mọi người; có thể bật lại ở thanh điều khiển."
    );
  }, []);

  const retry = () => {
    connectedRef.current = false;
    setJoin(null);
    setJoinError("");
    setEnded(null);
    setAttempt((a) => a + 1);
  };

  const handleEndMeeting = async () => {
    if (hasValidMeetingId && token && join?.myRole === "HOST") {
      try {
        await endMeeting(token, meetingId);
      } catch (err) {
        console.error("Lỗi khi kết thúc cuộc họp:", err);
      }
    }
    handleBack();
  };

  // Screen for ended meeting / disconnected
  if (hasValidMeetingId && ended) {
    return (
      <div className={`meeting-workspace flex flex-col items-center justify-center p-6 text-center ${isDark ? "dark" : ""}`}>
        <div className="max-w-md rounded-2xl border border-slate-700 bg-slate-900/90 p-8 shadow-2xl backdrop-blur-sm">
          <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-slate-800 text-slate-300">
            <Video size={28} />
          </div>
          <h2 className="mb-2 text-xl font-bold text-white">{ended.message}</h2>
          <p className="mb-6 text-sm text-slate-400">
            Nội dung bảng vẽ và tin nhắn đã được lưu trữ an toàn trong phòng học.
          </p>
          <div className="flex justify-center gap-3">
            {ended.canRetry && (
              <button className="button primary" onClick={retry} type="button">
                Vào lại
              </button>
            )}
            <button className="button secondary" onClick={handleBack} type="button">
              ← Về phòng
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Screen for join error
  if (hasValidMeetingId && joinError && !join) {
    return (
      <div className={`meeting-workspace flex flex-col items-center justify-center p-6 text-center ${isDark ? "dark" : ""}`}>
        <div className="max-w-md rounded-2xl border border-red-500/30 bg-slate-900/90 p-8 shadow-2xl backdrop-blur-sm">
          <h2 className="mb-2 text-xl font-bold text-red-400">Không thể vào cuộc họp</h2>
          <p className="mb-6 text-sm text-slate-400">{joinError}</p>
          <div className="flex justify-center gap-3">
            <button className="button primary" onClick={retry} type="button">
              Xem bản vẽ
            </button>
            <button className="button secondary" onClick={handleBack} type="button">
              ← Về phòng
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Loading state when connecting
  if (hasValidMeetingId && isJoining && !join) {
    return (
      <div className={`meeting-workspace flex flex-col items-center justify-center p-6 text-center ${isDark ? "dark" : ""}`}>
        <div className="mb-4 inline-block h-10 w-10 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
        <p className="text-base text-slate-300">Đang vào buổi học trực tuyến...</p>
      </div>
    );
  }

  // LiveKit real connection
  if (hasValidMeetingId && join && join.token && join.livekitUrl) {
    return (
      <LiveKitRoom
        data-lk-theme="default"
        serverUrl={join.livekitUrl}
        token={join.token}
        connect
        audio
        video
        options={ROOM_OPTIONS}
        onConnected={onConnected}
        onDisconnected={onDisconnected}
        onError={onError}
        onMediaDeviceFailure={onMediaDeviceFailure}
        className="h-full w-full"
      >
        <RoomAudioRenderer />
        <LiveMeetingContent
          meetingData={join}
          roomName={roomName}
          isDark={isDark}
          deviceWarning={deviceWarning}
          onClearDeviceWarning={() => setDeviceWarning("")}
          accessToken={token}
          currentUserId={user?.id}
          onBack={handleBack}
          onEndMeeting={handleEndMeeting}
          pinnedContent={pinnedContent}
          onPinContent={setPinnedContent}
        />
      </LiveKitRoom>
    );
  }

  // Id không đúng dạng ObjectId → không gọi backend, báo không tìm thấy (không còn màn preview giả)
  if (!hasValidMeetingId) {
    return (
      <div className={`meeting-workspace flex flex-col items-center justify-center p-6 text-center ${isDark ? "dark" : ""}`}>
        <div className="max-w-md rounded-2xl border border-slate-700 bg-slate-900/90 p-8 shadow-2xl backdrop-blur-sm">
          <h2 className="mb-2 text-xl font-bold text-white">Không tìm thấy buổi học</h2>
          <p className="mb-6 text-sm text-slate-400">Đường dẫn buổi học không hợp lệ.</p>
          <button className="button secondary" onClick={() => router.push("/dashboard")} type="button">
            ← Về trang chủ
          </button>
        </div>
      </div>
    );
  }

  // Đang kiểm đăng nhập / chưa bắt đầu vào buổi học / đang chuyển về /login
  return (
    <div className={`meeting-workspace flex flex-col items-center justify-center p-6 text-center ${isDark ? "dark" : ""}`}>
      <div className="mb-4 inline-block h-10 w-10 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
      <p className="text-base text-slate-300">Đang vào buổi học trực tuyến...</p>
    </div>
  );
}

export default MeetingWorkspace;
