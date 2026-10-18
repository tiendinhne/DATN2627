"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Radio, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth.context";
import { listMyRooms } from "@/services/room.service";
import type { Room } from "@/types/backend";

const ROOM_COLORS = ["#5667e9", "#e0534b", "#10b981", "#8b5cf6", "#f59e0b"];

export function RoomListView() {
  const router = useRouter();
  const { token, isLoading: isAuthLoading } = useAuth();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

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

  if (isAuthLoading || !token) {
    return (
      <div className="p-8 text-center text-slate-500">
        Đang tải danh sách phòng...
      </div>
    );
  }

  return (
    <div className="content-wrap">
      <section className="section-block">
        <div className="section-heading">
          <div>
            <p className="eyebrow">KHÔNG GIAN CỦA BẠN</p>
            <h1>Phòng học của tôi</h1>
            <p>Tất cả phòng học bạn đã tham gia</p>
          </div>
          <button
            className="text-button"
            onClick={() => router.push("/dashboard")}
            type="button"
          >
            <ArrowLeft size={16} /> Quay lại tổng quan
          </button>
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
                    onClick={() => router.push(`/rooms/${room.id}`)}
                    type="button"
                  >
                    Mở phòng <ArrowRight size={16} />
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="p-8 text-center text-slate-500">
            Bạn chưa tham gia phòng nào.
          </p>
        )}
      </section>
    </div>
  );
}

export default RoomListView;
