"use client";

import { useEffect, useState } from "react";
import { ArrowRight, Plus, PlusCircle, Radio, Sparkles, UserPlus, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/common/Modal";
import { useAuth } from "@/context/auth.context";
import { createRoom, joinRoom, listMyRooms } from "@/services/room.service";
import type { Room } from "@/types/backend";

const ROOM_COLORS = ["#5667e9", "#e0534b", "#10b981", "#8b5cf6", "#f59e0b"];

export function RoomListView() {
  const router = useRouter();
  const { token, isLoading: isAuthLoading } = useAuth();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [modal, setModal] = useState<"create" | "join" | null>(null);
  const [modalError, setModalError] = useState("");
  const [modalBusy, setModalBusy] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createDescription, setCreateDescription] = useState("");
  const [joinCode, setJoinCode] = useState("");

  useEffect(() => {
    if (isAuthLoading) return;
    if (!token) {
      router.replace("/login?redirect=rooms");
      return;
    }

    let isActive = true;

    const loadRooms = async () => {
      setIsLoading(true);
      setError("");

      try {
        const allRooms: Room[] = [];
        let page = 1;
        let hasMore: boolean;

        do {
          const response = await listMyRooms(token, page);
          allRooms.push(...response.items);
          hasMore = response.hasMore;
          page += 1;
        } while (hasMore);

        if (isActive) setRooms(allRooms);
      } catch (err) {
        if (isActive) {
          setError(err instanceof Error ? err.message : "Không tải được danh sách phòng.");
        }
      } finally {
        if (isActive) setIsLoading(false);
      }
    };

    void loadRooms();
    return () => {
      isActive = false;
    };
  }, [isAuthLoading, router, token]);

  const handleCreateRoom = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!token) return;
    setModalError("");
    setModalBusy(true);

    try {
      const room = await createRoom(token, {
        name: createName.trim(),
        description: createDescription.trim() || undefined,
      });
      router.push(`/rooms/${room.id}`);
    } catch (err) {
      setModalError(err instanceof Error ? err.message : "Tạo phòng thất bại");
    } finally {
      setModalBusy(false);
    }
  };

  const handleJoinRoom = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!token) return;
    setModalError("");
    setModalBusy(true);

    try {
      const room = await joinRoom(token, joinCode.trim().toUpperCase());
      router.push(`/rooms/${room.id}`);
    } catch (err) {
      setModalError(err instanceof Error ? err.message : "Tham gia phòng thất bại");
    } finally {
      setModalBusy(false);
    }
  };

  if (isAuthLoading || !token) {
    return (
      <div className="p-8 text-center text-slate-500">
        Đang tải danh sách phòng...
      </div>
    );
  }

  return (
    <div className="content-wrap">
        <div className="room-heading">
          <div>
            <p className="eyebrow">PHÒNG HỌC CỦA TÔI</p>
            <p>Tất cả phòng học bạn đã tham gia</p>
          </div>
          {!isLoading && rooms.length > 0 && (
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
          )}
        </div>

        {error ? (
          <p className="p-8 text-center text-red-600">{error}</p>
        ) : isLoading ? (
          <p className="p-8 text-center text-slate-500">Đang tải danh sách phòng...</p>
        ) : rooms.length > 0 ? (
          <div className="rooms-grid">
            {rooms.map((room, index) => (
              <article className="room-card" key={room.id}>
                <div
                  className="room-banner"
                  style={{ backgroundColor: ROOM_COLORS[index % ROOM_COLORS.length] }}
                >
                  <h3>{room.name}</h3>
                  {room.status === "ACTIVE" && (
                    <div className="live-pill">
                      <Radio size={12} /> SẴN SÀNG
                    </div>
                  )}
                </div>
                <div className="room-body" onClick={() => router.push(`/rooms/${room.id}`)}>
                  <p>{room.description || "Phòng học nhóm cộng tác trực tuyến."}</p>
                  <div className="room-meta">
                    <span>
                      <Users size={15} /> {room.memberCount || 1} thành viên
                    </span>
                    <span>Mã: {room.joinCode}</span>
                  </div>
                  <button
                    className="open-room"
                    type="button"
                  >
                    Mở phòng <ArrowRight size={16} />
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="rooms-grid">
            <div className="col-span-full flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-slate-300 bg-gradient-to-b from-slate-50 to-white px-6 py-12 text-center dark:border-slate-700 dark:from-slate-900 dark:to-slate-950">
              <div
                aria-hidden="true"
                className="flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400"
              >
                <Users size={32} />
              </div>

              <div className="space-y-2">
                <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
                  Chưa có phòng học nào
                </h3>
                <p className="mx-auto max-w-md text-sm leading-6 text-slate-500 dark:text-slate-400">
                  Bắt đầu học tập cùng bạn bè bằng cách tạo một phòng mới
                  hoặc tham gia phòng đã có.
                </p>
              </div>

              <div className="flex flex-wrap justify-center gap-2 text-sm">
                <button
                  className="inline-flex items-center gap-2 rounded-lg bg-indigo-50 px-3 py-2 font-medium text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300"
                  onClick={() => {
                    setModalError("");
                    setModal("create");
                  }}
                  type="button"
                >
                  <PlusCircle size={16} aria-hidden="true" />
                  Tạo phòng mới
                </button>
                <button
                  className="inline-flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-2 font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200"
                  onClick={() => {
                    setModalError("");
                    setModal("join");
                  }}
                  type="button"
                >
                  <UserPlus size={16} aria-hidden="true" />
                  Tham gia phòng
                </button>
              </div>
            </div>
          </div>
        )}

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
                    onChange={(event) => setCreateName(event.target.value)}
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
                    onChange={(event) => setCreateDescription(event.target.value)}
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
                  onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
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

export default RoomListView;
