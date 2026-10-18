"use client";

import { Users, Video } from "lucide-react";
import { meetings as mockMeetings } from "@/data/mockData";
import type { Meeting } from "@/types";

interface MeetingsTabProps {
  meetings?: Meeting[];
  onMeeting: (meetingId?: string) => void;
  onStartMeeting?: () => void;
  isHost?: boolean;
  onEndMeeting?: (meetingId: string) => void;
}

const END_REASON_LABEL: Record<string, string> = {
  HOST_ENDED: "Host kết thúc",
  AUTO_EMPTY: "Tự kết thúc",
  ROOM_DISSOLVED: "Phòng giải tán",
};

export function MeetingsTab({
  meetings: propMeetings,
  onMeeting,
  onStartMeeting,
  isHost,
  onEndMeeting,
}: MeetingsTabProps) {
  // If undefined, fallback to mockData for preview. If array is passed (even empty []), use real data.
  const displayMeetings = propMeetings !== undefined ? propMeetings : mockMeetings;
  const activeMeeting = displayMeetings.find((m) => m.status === "Live");
  const historyMeetings = displayMeetings.filter((m) => m.id !== activeMeeting?.id);

  return (
    <section className="panel-card room-meetings-card">
      <div className="section-heading">
        <div>
          <h2>Lịch sử cuộc họp</h2>
          <p>Mỗi cuộc họp có bảng vẽ và nội dung cộng tác riêng</p>
        </div>
        <button
          className="button primary"
          onClick={onStartMeeting || (() => onMeeting())}
          type="button"
        >
          <Video size={16} /> Bắt đầu cuộc họp
        </button>
      </div>

      {activeMeeting && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-indigo-500/30 bg-indigo-500/10 p-4">
          <div className="flex items-center gap-3">
            <span className="relative flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500"></span>
            </span>
            <div>
              <p className="font-semibold text-white">{activeMeeting.title}</p>
              <p className="text-xs text-slate-400">
                Đang diễn ra · {activeMeeting.participants} người tham gia
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              className="button primary small"
              onClick={() => onMeeting(activeMeeting.id)}
              type="button"
            >
              Tham gia ngay
            </button>
            {isHost && onEndMeeting && (
              <button
                className="button destructive-button small"
                onClick={() => onEndMeeting(activeMeeting.id)}
                type="button"
              >
                Kết thúc
              </button>
            )}
          </div>
        </div>
      )}

      {displayMeetings.length === 0 ? (
        <div className="p-8 text-center text-slate-400">
          Chưa có cuộc họp nào trong phòng này. Bạn có thể bấm <strong>Bắt đầu cuộc họp</strong> để tạo phiên học mới!
        </div>
      ) : (
        <div className="meetings-table">
          <div className="meeting-table-head">
            <span>CUỘC HỌP</span>
            <span>THỜI GIAN</span>
            <span>THÀNH VIÊN</span>
            <span>TRẠNG THÁI</span>
            <span />
          </div>
          {displayMeetings.map((meeting) => (
            <div className="meeting-table-row" key={meeting.id}>
              <div>
                <span className="history-icon">
                  <Video size={17} />
                </span>
                <p>
                  <strong>{meeting.title}</strong>
                  <small>
                    {meeting.endReason
                      ? END_REASON_LABEL[meeting.endReason] || "Cuộc họp phòng"
                      : "Cuộc họp phòng"}
                  </small>
                </p>
              </div>
              <p>
                <strong>
                  {meeting.date}, {meeting.time}
                </strong>
                <small>{meeting.duration}</small>
              </p>
              <span>
                <Users size={15} />{" "}
                {meeting.totalParticipants !== undefined
                  ? `${meeting.peakParticipants || 1}/${meeting.totalParticipants}`
                  : meeting.participants}
              </span>
              <span className={`status-pill ${meeting.status.toLowerCase()}`}>
                {meeting.status === "Live"
                  ? "Đang diễn ra"
                  : meeting.status === "Upcoming"
                  ? "Sắp tới"
                  : "Đã kết thúc"}
              </span>
              <button
                className="button secondary small"
                onClick={() => onMeeting(meeting.id)}
                type="button"
              >
                {meeting.status === "Live" ? "Tham gia" : "Xem lại"}
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export default MeetingsTab;
