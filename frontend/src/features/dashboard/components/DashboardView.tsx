"use client";

import { useEffect, useState } from "react";
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
import { useRouter } from "next/navigation";
import { Modal } from "@/components/common/Modal";
import { useAuth } from '@/context/auth.context';
import { createRoom, joinRoom, listMyRooms } from "@/services/room.service";
import type { Room as BackendRoom } from "@/types/backend";
import { useNow } from "./hooks/useNow";
import { getGreeting, formatEyebrow } from "./utils/greeting";
import { meetings } from "@/data/mockData";

const ROOM_COLORS = ["#5667e9", "#e0534b", "#10b981", "#8b5cf6", "#f59e0b"];

export function DashboardView({
  onNavigate,
}: {
  onNavigate?: (page: string) => void;
}) {
  const router = useRouter();
  const { user, token, isLoading } = useAuth();
  const now = useNow();

  const [modal, setModal] = useState<"create" | "join" | null>(null);
  const [rooms, setRooms] = useState<BackendRoom[]>([]);
  const [isFetchingRooms, setIsFetchingRooms] = useState(false);
  const [modalError, setModalError] = useState("");
  const [modalBusy, setModalBusy] = useState(false);

  // Form states
  const [createName, setCreateName] = useState("");
  const [createDescription, setCreateDescription] = useState("");
  const [joinCode, setJoinCode] = useState("");

  useEffect(() => {
    if (!isLoading && !token) {
      router.push('/login?redirect=dashboard');
    }
  }, [token, isLoading, router]);

  // Load danh sách phòng thật từ backend
  useEffect(() => {
    if (!token) return;
    setIsFetchingRooms(true);
    listMyRooms(token, 1)
      .then((res) => {
        setRooms(res.items);
      })
      .catch((err) => {
        console.error("Lỗi tải danh sách phòng:", err);
      })
      .finally(() => {
        setIsFetchingRooms(false);
      });
  }, [token]);

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

  const navigateToRoom = (roomId?: string) => {
    const targetId = roomId || (rooms.length > 0 ? rooms[0].id : "software-engineering");
    if (onNavigate) {
      onNavigate("room");
    } else {
      router.push(`/rooms/${targetId}`);
    }
  };

  const navigateToRooms = () => {
    if (onNavigate) {
      onNavigate("rooms");
    } else {
      router.push("/rooms");
    }
  };

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setModalError("");
    setModalBusy(true);

    try {
      const newRoom = await createRoom(token, {
        name: createName.trim(),
        description: createDescription.trim() || undefined,
      });
      setModal(null);
      setCreateName("");
      setCreateDescription("");
      router.push(`/rooms/${newRoom.id}`);
    } catch (err) {
      setModalError(err instanceof Error ? err.message : "Tạo phòng thất bại");
    } finally {
      setModalBusy(false);
    }
  };

  const handleJoinRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setModalError("");
    setModalBusy(true);

    try {
      const joinedRoom = await joinRoom(token, joinCode.trim().toUpperCase());
      setModal(null);
      setJoinCode("");
      router.push(`/rooms/${joinedRoom.id}`);
    } catch (err) {
      setModalError(err instanceof Error ? err.message : "Tham gia phòng thất bại");
    } finally {
      setModalBusy(false);
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
          <button
            className="button secondary"
            onClick={() => {
              setModalError("");
              setModal("join");
            }}
            type="button"
          >
            <Users size={18} /> Tham gia phòng
          </button>
          <button
            className="button primary"
            onClick={() => {
              setModalError("");
              setModal("create");
            }}
            type="button"
          >
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
            <strong>{rooms.length}</strong>
            <small>Đang hoạt động</small>
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
          <button className="text-button" type="button" onClick={navigateToRooms}>
            Xem tất cả <ArrowRight size={16} />
          </button>
        </div>
        <div className="rooms-grid">
          {rooms.length > 0 ? (
            rooms.map((room, index) => {
              const color = ROOM_COLORS[index % ROOM_COLORS.length];
              return (
                <article className="room-card" key={room.id}>
                  <div className="room-banner" style={{ backgroundColor: color }}>
                    <span>{room.myRole === "HOST" ? "HOST" : "THÀNH VIÊN"}</span>
                    {room.status === "ACTIVE" && (
                      <div className="live-pill">
                        <Radio size={12} /> SẴN SÀNG
                      </div>
                    )}
                  </div>
                  <div className="room-body">
                    <h3>{room.name}</h3>
                    <p>{room.description || "Phòng học nhóm cộng tác trực tuyến."}</p>
                    <div className="room-meta">
                      <span>
                        <Users size={15} /> {room.memberCount || 1} thành viên
                      </span>
                      <span>Mã: {room.joinCode}</span>
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
              );
            })
          ) : isFetchingRooms ? (
            <div className="p-8 text-center text-slate-500">Đang tải danh sách phòng...</div>
          ) : (
            <div className="p-8 text-center text-slate-500">
              Bạn chưa tham gia phòng nào. Hãy bấm <strong>Tạo phòng mới</strong> hoặc <strong>Tham gia phòng</strong> để bắt đầu!
            </div>
          )}
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
              : "Nhập mã được chia sẻ bởi chủ phòng (8 ký tự)."
          }
          onClose={() => {
            setModal(null);
            setModalError("");
          }}
        >
          <form
            className="modal-form"
            onSubmit={modal === "create" ? handleCreateRoom : handleJoinRoom}
          >
            {modalError && (
              <div className="mb-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">
                {modalError}
              </div>
            )}
            {modal === "create" ? (
              <>
                <label>
                  Tên phòng
                  <input
                    required
                    value={createName}
                    onChange={(e) => setCreateName(e.target.value)}
                    placeholder="Ví dụ: Đồ án tốt nghiệp"
                    maxLength={100}
                    autoFocus
                    disabled={modalBusy}
                  />
                </label>
                <label>
                  Mô tả
                  <textarea
                    value={createDescription}
                    onChange={(e) => setCreateDescription(e.target.value)}
                    placeholder="Phòng dùng để học và cộng tác..."
                    maxLength={500}
                    disabled={modalBusy}
                  />
                </label>
              </>
            ) : (
              <label>
                Mã phòng
                <input
                  required
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="VD: ABCD2345"
                  maxLength={8}
                  style={{ textTransform: "uppercase", letterSpacing: "2px" }}
                  autoFocus
                  disabled={modalBusy}
                />
              </label>
            )}
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                className="button secondary"
                onClick={() => {
                  setModal(null);
                  setModalError("");
                }}
                disabled={modalBusy}
              >
                Hủy
              </button>
              <button className="button primary" type="submit" disabled={modalBusy}>
                {modalBusy ? (
                  "Đang xử lý..."
                ) : (
                  <>
                    {modal === "create" ? <Sparkles size={17} /> : null}
                    {modal === "create" ? "Tạo phòng" : "Tham gia"}
                  </>
                )}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

export default DashboardView;
