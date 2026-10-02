import { Users, Video } from "lucide-react";
import { meetings } from "@/data/mockData";

interface MeetingsTabProps {
  onMeeting: () => void;
}

export function MeetingsTab({ onMeeting }: MeetingsTabProps) {
  return (
    <section className="panel-card room-meetings-card">
      <div className="section-heading">
        <div>
          <h2>Lịch sử cuộc họp</h2>
          <p>Mỗi cuộc họp có bảng vẽ và nội dung cộng tác riêng</p>
        </div>
        <button className="button primary" onClick={onMeeting} type="button">
          <Video size={16} /> Bắt đầu cuộc họp
        </button>
      </div>
      <div className="meetings-table">
        <div className="meeting-table-head">
          <span>CUỘC HỌP</span>
          <span>THỜI GIAN</span>
          <span>THÀNH VIÊN</span>
          <span>TRẠNG THÁI</span>
          <span />
        </div>
        {meetings.map((meeting) => (
          <div className="meeting-table-row" key={meeting.id}>
            <div>
              <span className="history-icon">
                <Video size={17} />
              </span>
              <p>
                <strong>{meeting.title}</strong>
                <small>Bắt đầu bởi An Nguyễn</small>
              </p>
            </div>
            <p>
              <strong>
                {meeting.date}, {meeting.time}
              </strong>
              <small>{meeting.duration}</small>
            </p>
            <span>
              <Users size={15} /> {meeting.participants}
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
              onClick={onMeeting}
              type="button"
            >
              {meeting.status === "Live" ? "Tham gia" : "Xem lại"}
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}

export default MeetingsTab;
