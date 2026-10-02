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
import { meetings } from "@/data/mockData";
import type { RoomRole } from "../types";

interface RoomOverviewTabProps {
  role: RoomRole;
  onJoinMeeting: () => void;
  onEndMeeting: () => void;
}

export function RoomOverviewTab({
  role,
  onJoinMeeting,
  onEndMeeting,
}: RoomOverviewTabProps) {
  const [copied, setCopied] = useState(false);

  const handleCopyCode = () => {
    navigator.clipboard?.writeText("STUDY-6X2P");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="room-layout">
      <div className="space-y-5">
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
            <h2>Họp tiến độ tuần 5</h2>
            <p>5 thành viên đang trao đổi trong phòng</p>
          </div>
          <div className="live-actions">
            <button className="button white" onClick={onJoinMeeting} type="button">
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
          {meetings.map((meeting) => (
            <button
              className="history-row"
              key={meeting.id}
              onClick={onJoinMeeting}
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
          ))}
        </section>
      </div>

      <aside className="space-y-5">
        <section className="panel-card info-card">
          <h2>Thông tin phòng</h2>
          <dl>
            <div>
              <dt>Chủ phòng</dt>
              <dd>
                <span className="mini-avatar">AN</span>An Nguyễn
              </dd>
            </div>
            <div>
              <dt>Thành viên</dt>
              <dd>8 người</dd>
            </div>
            <div>
              <dt>Ngày tạo</dt>
              <dd>02/06/2026</dd>
            </div>
          </dl>
          <div className="room-code">
            <span>
              <small>MÃ PHÒNG</small>
              <strong>STUDY-6X2P</strong>
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
              <strong>Minh Anh</strong> đã gửi một tin nhắn
              <small>12 phút trước</small>
            </p>
          </div>
          <div className="activity">
            <span className="activity-icon purple">
              <FileText size={16} />
            </span>
            <p>
              Bảng vẽ đã được cập nhật
              <small>35 phút trước</small>
            </p>
          </div>
          <div className="activity">
            <span className="activity-icon green">
              <CalendarDays size={16} />
            </span>
            <p>
              Cuộc họp mới đã được lên lịch
              <small>Hôm qua</small>
            </p>
          </div>
        </section>
      </aside>
    </div>
  );
}

export default RoomOverviewTab;
