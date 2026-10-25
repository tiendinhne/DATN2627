"use client";

import {
  CalendarDays,
  Copy,
  FileText,
  MessageSquare,
  MoreHorizontal,
  Radio,
  Video,
} from "lucide-react";
import { useState } from "react";
import { meetings as mockMeetings } from "@/data/mockData";
import type { Meeting } from "@/types";
import type { RoomRole } from "../types";

interface RoomOverviewTabProps {
  role: RoomRole;
  roomInfo?: {
    joinCode?: string;
    ownerName?: string;
    memberCount?: number;
    createdAt?: string;
  };
  activeMeeting?: {
    id: string;
    title: string;
    participantCount?: number;
  } | null;
  recentMeetings?: Meeting[];
  onJoinMeeting: (meetingId?: string) => void;
  onEndMeeting: () => void;
}

export function RoomOverviewTab({
  role,
  roomInfo,
  activeMeeting,
  recentMeetings,
  onJoinMeeting,
  onEndMeeting,
}: RoomOverviewTabProps) {
  const [copied, setCopied] = useState(false);

  const joinCode = roomInfo?.joinCode || "STUDY-6X2P";
  const displayMeetings = recentMeetings !== undefined ? recentMeetings : mockMeetings;

  const handleCopyCode = () => {
    navigator.clipboard?.writeText(joinCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="room-layout">
      <div className="space-y-5">
        {activeMeeting ? (
          <section className="live-meeting-card">
            <div className="live-visual">
              <div className="live-rings">
                <Video size={27} />
              </div>
            </div>
            <div className="flex-1">
              <div className="live-label">
                <Radio size={13} /> ĐANG DIỄN RA
              </div>
              <h2>{activeMeeting.title}</h2>
              <p>{activeMeeting.participantCount || 1} người đang trong buổi học</p>
            </div>
            <div className="live-actions">
              <button
                className="button white"
                onClick={() => onJoinMeeting(activeMeeting.id)}
                type="button"
              >
                Tham gia ngay <Video size={17} />
              </button>
              {role === "owner" && (
                <button
                  className="button end-meeting-button"
                  onClick={onEndMeeting}
                  type="button"
                >
                  Kết thúc
                </button>
              )}
            </div>
          </section>
        ) : (
          <section className="live-meeting-card" style={{ opacity: 0.9 }}>
            <div className="live-visual">
              <div className="live-rings">
                <Video size={27} />
              </div>
            </div>
            <div className="flex-1">
              <div className="live-label">
                <Radio size={13} /> PHÒNG TRỰC TUYẾN
              </div>
              <h2>Chưa có cuộc họp nào đang diễn ra</h2>
              <p>Chủ phòng có thể bấm Bắt đầu cuộc họp để tạo phiên học mới.</p>
            </div>
            <div className="live-actions">
              {role === "owner" && (
                <button
                  className="button white"
                  onClick={() => onJoinMeeting()}
                  type="button"
                >
                  Bắt đầu ngay <Video size={17} />
                </button>
              )}
            </div>
          </section>
        )}

        <section className="panel-card">
          <div className="section-heading">
            <div>
              <h2>Cuộc họp gần đây</h2>
              <p>Whiteboard được lưu riêng theo từng cuộc họp</p>
            </div>
            <button className="text-button" type="button">
              Xem tất cả
            </button>
          </div>
           {displayMeetings.length === 0 ? (
            <div className="p-4 text-center text-sm text-slate-400">
              Chưa có cuộc họp nào gần đây.
            </div>
          ) : (
            displayMeetings.map((meeting) => (
            <button
              className="history-row"
              key={meeting.id}
              onClick={() => onJoinMeeting(meeting.id)}
              type="button"
            >
              <span className="history-icon">
                <Video size={18} />
              </span>
              <span className="flex-1 text-left">
                <strong>{meeting.title}</strong>
                <small>
                  {meeting.date} · {meeting.duration}
                </small>
              </span>
              <span className="board-badge">
                <FileText size={14} /> Có bảng vẽ
              </span>
              <MoreHorizontal size={19} />
            </button>
           ))
          )}
        </section>
      </div>

      <aside className="space-y-5">
        <section className="panel-card info-card">
          <h2>Thông tin phòng</h2>
          <dl>
            <div>
              <dt>Chủ phòng</dt>
              <dd>
                <span className="mini-avatar">AN</span>
                {roomInfo?.ownerName || "Chủ phòng"}
              </dd>
            </div>
            <div>
              <dt>Thành viên</dt>
              <dd>{roomInfo?.memberCount || 1} người</dd>
            </div>
            <div>
              <dt>Ngày tạo</dt>
              <dd>{roomInfo?.createdAt || "Gần đây"}</dd>
            </div>
          </dl>
          <div className="room-code">
            <span>
              <small>MÃ PHÒNG</small>
              <strong>{joinCode}</strong>
            </span>
            <button
              className="icon-button"
              onClick={handleCopyCode}
              type="button"
              aria-label="Sao chép mã phòng"
            >
              <Copy size={17} />
            </button>
          </div>
        </section>

        <section className="panel-card">
          <div className="section-heading compact">
            <div>
              <h2>Hoạt động gần đây</h2>
            </div>
          </div>
          <div className="activity">
            <span className="activity-icon">
              <MessageSquare size={16} />
            </span>
            <p>
              <strong>Hệ thống</strong> Phòng học đã sẵn sàng
              <small>Vừa xong</small>
            </p>
          </div>
          <div className="activity">
            <span className="activity-icon purple">
              <FileText size={16} />
            </span>
            <p>
              Bảng vẽ sẵn sàng hoạt động
              <small>Hôm nay</small>
            </p>
          </div>
          <div className="activity">
            <span className="activity-icon green">
              <CalendarDays size={16} />
            </span>
            <p>
              Cuộc họp mới có thể bắt đầu bất cứ lúc nào
              <small>Hôm nay</small>
            </p>
          </div>
        </section>
      </aside>
    </div>
  );
}

export default RoomOverviewTab;
