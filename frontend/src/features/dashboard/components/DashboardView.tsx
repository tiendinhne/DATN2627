"use client";

import { useState } from "react";
import {
  ArrowRight,
  CalendarDays,
  Clock3,
  Plus,
  Radio,
  Sparkles,
  Users,
  Video,
} from "lucide-react";
import Link from "next/link";
import { useEffect } from 'react';
import { useRouter } from "next/navigation";
import { Modal } from "@/components/common/Modal";
import { useAuth } from '@/context/auth.context';
import { useNow } from "./hooks/useNow";
import { getGreeting, formatEyebrow } from "./utils/greeting";

import { meetings, rooms } from "@/data/mockData";

export function DashboardView({
  onNavigate,
}: {
  onNavigate?: (page: string) => void;
}) {
  const router = useRouter();
  const { user, token, isLoading, logout } = useAuth();
  const now = useNow();
  const [modal, setModal] = useState<"create" | "join" | null>(null);

  useEffect(() => {
    if (!isLoading && !token) {
      router.push('/login?redirect=dashboard');
    }
  }, [token, isLoading, router]);
  

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mb-4 inline-block animate-spin rounded-full border-4 border-purple-600 border-t-transparent" />
          <p className="text-gray-600 dark:text-gray-300">Đang tải...</p>
        </div>
      </div>
    );
  }

  if (!user || !token) {
    return null;
  }

  const displayName = user.displayName || user.username || "bạn";


  const navigateToMeeting = () => {
    if (onNavigate) {
      onNavigate("meeting");
    } else {
      router.push("/meetings/sprint-review-05");
    }
  };

  const navigateToRoom = (roomId: string = "software-engineering") => {
    if (onNavigate) {
      onNavigate("room");
    } else {
      router.push(`/rooms/${roomId}`);
    }
  };

  return (
    <div className="content-wrap">
      <section className="welcome-row">
        <div>
          <p className="eyebrow">{formatEyebrow(now)}</p>
          <h1>{getGreeting(now)}, {displayName}</h1>
          <p>Sẵn sàng để học và tạo nên những điều tuyệt vời cùng nhau?</p>
        </div>
        <div className="quick-actions">
          <button className="button secondary" onClick={() => setModal("join")} type="button">
            <Users size={18} /> Tham gia phòng
          </button>
          <button className="button primary" onClick={() => setModal("create")} type="button">
            <Plus size={18} /> Tạo phòng mới
          </button>
        </div>
      </section>

      <section className="stats-grid">
        <div className="stat-card">
          <span className="stat-icon indigo">
            <Users size={21} />
          </span>
          <div>
            <p>Phòng của tôi</p>
            <strong>3</strong>
            <small>+1 trong tháng này</small>
          </div>
        </div>
        <div className="stat-card">
          <span className="stat-icon green">
            <Video size={21} />
          </span>
          <div>
            <p>Cuộc họp</p>
            <strong>12</strong>
            <small>4 giờ học tuần này</small>
          </div>
        </div>
        <div className="stat-card">
          <span className="stat-icon orange">
            <Clock3 size={21} />
          </span>
          <div>
            <p>Thời gian học</p>
            <strong>8.5h</strong>
            <small>+12% so với tuần trước</small>
          </div>
        </div>
      </section>

      <section className="section-block">
        <div className="section-heading">
          <div>
            <h2>Phòng gần đây</h2>
            <p>Tiếp tục học tập cùng nhóm của bạn</p>
          </div>
          <button className="text-button" type="button" onClick={() => navigateToRoom()}>
            Xem tất cả <ArrowRight size={16} />
          </button>
        </div>
        <div className="rooms-grid">
          {rooms.map((room) => (
            <article className="room-card" key={room.id}>
              <div className="room-banner" style={{ backgroundColor: room.color }}>
                <span>{room.tag}</span>
                {room.activeMeeting && (
                  <div className="live-pill">
                    <Radio size={12} /> ĐANG HỌP
                  </div>
                )}
              </div>
              <div className="room-body">
                <h3>{room.name}</h3>
                <p>{room.description}</p>
                {room.activeMeeting && (
                  <button
                    className="active-meeting"
                    onClick={navigateToMeeting}
                    type="button"
                  >
                    <span className="pulse-dot" />
                    <span>
                      <strong>{room.activeMeeting}</strong>
                      <small>Đang diễn ra · 5 người</small>
                    </span>
                    <Video size={17} />
                  </button>
                )}
                <div className="room-meta">
                  <span>
                    <Users size={15} /> {room.members} thành viên
                  </span>
                  <span>{room.lastActivity}</span>
                </div>
                <button
                  className="open-room"
                  onClick={() => navigateToRoom(room.id)}
                  type="button"
                >
                  Mở phòng <ArrowRight size={16} />
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="meetings-panel">
        <div className="section-heading">
          <div>
            <h2>Cuộc họp sắp tới</h2>
            <p>Lịch học nhóm của bạn</p>
          </div>
          <button className="icon-button" type="button" aria-label="Lịch cuộc họp">
            <CalendarDays size={18} />
          </button>
        </div>
        <div className="meeting-list">
          {meetings.slice(0, 2).map((meeting) => (
            <div className="meeting-row" key={meeting.id}>
              <div className="date-tile">
                <strong>{meeting.date === "Hôm nay" ? "22" : "18"}</strong>
                <span>THÁNG 6</span>
              </div>
              <div className="meeting-info">
                <h3>{meeting.title}</h3>
                <p>{meeting.room}</p>
              </div>
              <div className="meeting-time">
                <Clock3 size={16} />
                <span>{meeting.time}</span>
                <small>{meeting.duration}</small>
              </div>
              <div className="avatar-stack">
                <span>MA</span>
                <span>QH</span>
                <span>+{meeting.participants - 2}</span>
              </div>
              <button
                className="button small secondary"
                onClick={navigateToMeeting}
                type="button"
              >
                Tham gia
              </button>
            </div>
          ))}
        </div>
      </section>

      {modal && (
        <Modal
          title={modal === "create" ? "Tạo phòng học mới" : "Tham gia phòng"}
          subtitle={
            modal === "create"
              ? "Tạo không gian cộng tác cho nhóm của bạn."
              : "Nhập mã được chia sẻ bởi chủ phòng."
          }
          onClose={() => setModal(null)}
        >
          <form
            className="modal-form"
            onSubmit={(event) => {
              event.preventDefault();
              setModal(null);
              navigateToRoom();
            }}
          >
            {modal === "create" ? (
              <>
                <label>
                  Tên phòng
                  <input
                    required
                    placeholder="Ví dụ: Đồ án tốt nghiệp"
                    autoFocus
                  />
                </label>
                <label>
                  Mô tả
                  <textarea placeholder="Phòng dùng để học và cộng tác..." />
                </label>
                <label>
                  Mã phòng
                  <input value="STUDY-6X2P" readOnly />
                </label>
              </>
            ) : (
              <label>
                Mã phòng
                <input required placeholder="Nhập mã phòng" autoFocus />
              </label>
            )}
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                className="button secondary"
                onClick={() => setModal(null)}
              >
                Hủy
              </button>
              <button className="button primary" type="submit">
                {modal === "create" ? <Sparkles size={17} /> : null}
                {modal === "create" ? "Tạo phòng" : "Tham gia"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

export default DashboardView;
