"use client";

import { Camera, Check, Mail, ShieldCheck, UserRound } from "lucide-react";
import { useAuth } from "@/context/auth.context";
import { listMyRooms } from "@/services/room.service";
import { getMyProfile, updateMyProfile } from "@/services/user.service";
import { useEffect, useState } from "react";

export function ProfileView() {
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const { user, token, updateUser } = useAuth();
  const [displayName, setDisplayName] = useState("");
  // Số phòng thật từ GET /rooms; "—" khi chưa tải được
  const [roomCount, setRoomCount] = useState("—");
  // Ngày tạo tài khoản từ GET /users/me
  const [joinedDate, setJoinedDate] = useState("Chưa có dữ liệu");

  useEffect(() => {
    if (!token) return;
    getMyProfile(token)
      .then((profile) => setJoinedDate(new Date(profile.createdAt).toLocaleDateString("vi-VN")))
      .catch(() => setJoinedDate("Chưa có dữ liệu"));
  }, [token]);

  // Lưu tên hiển thị: PATCH /users/me, rồi cập nhật user trong context để menu đổi theo
  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!token) return;
    setError("");
    setSaving(true);
    try {
      const profile = await updateMyProfile(token, displayName);
      updateUser({ displayName: profile.displayName });
      setDisplayName(profile.displayName);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không lưu được thay đổi");
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
  if (user) {
    setDisplayName(user.displayName || user.username || "");
  }
}, [user]);

  useEffect(() => {
    if (!token) return;
    listMyRooms(token, 1)
      .then((res) => setRoomCount(`${res.items.length}${res.hasMore ? "+" : ""}`))
      .catch(() => setRoomCount("—"));
  }, [token]);

  return (
    <div className="content-wrap account-page">
      <div className="account-heading">
        <div>
          <p className="eyebrow">TÀI KHOẢN CỦA BẠN</p>
          <h1>Hồ sơ cá nhân</h1>
          <p>Quản lý thông tin hiển thị với các thành viên khác.</p>
        </div>
      </div>
      <div className="account-layout">
        <section className="panel-card profile-card">
          <div className="profile-cover" />
          <div className="profile-identity">
            <div className="profile-avatar">
              {(user?.displayName || user?.username || "U")
                .slice(0, 2)
                .toUpperCase()}
              <button aria-label="Đổi ảnh đại diện" type="button">
                <Camera size={15} />
              </button>
            </div>
            <div>
              <h2>{user?.displayName || user?.username || "Chưa cập nhật"}</h2>
              <p>@{user?.username}</p>
            </div>
          </div>
          <div className="profile-facts">
            <div>
              <strong>{roomCount}</strong>
              <span>Phòng học</span>
            </div>
            {/* Cuộc họp / giờ học: chưa có API thống kê theo user (small_task #2, phần C) */}
            <div>
              <strong>—</strong>
              <span>Cuộc họp</span>
            </div>
            <div>
              <strong>—</strong>
              <span>Thời gian học</span>
            </div>
          </div>
        </section>
        <section className="panel-card profile-form-card">
          <div className="section-heading">
            <div>
              <h2>Thông tin cá nhân</h2>
              <p>Cập nhật tên và thông tin liên hệ của bạn</p>
            </div>
          </div>
          <form className="profile-form" onSubmit={handleSave}>
            <label>
              <span>
                <UserRound size={15} /> Tên người dùng
              </span>
              <input
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
              />
            </label>
            <label>
              <span>
                <Mail size={15} /> Địa chỉ email
              </span>
              <input
                type="email"
                value={user?.email || ""}
                readOnly
              />
            </label>
            <div className="read-only-row">
              <span>
                <ShieldCheck size={17} />
              </span>
              <p>
                <strong>Ngày tham gia</strong>
                <small>{joinedDate}</small>
              </p>
            </div>
            <div className="form-footer">
              {error && <span className="text-sm text-red-600">{error}</span>}
              {saved && (
                <span className="saved-message">
                  <Check size={15} /> Đã lưu thay đổi
                </span>
              )}
              <button className="button primary" type="submit" disabled={saving}>
                Lưu thay đổi
              </button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}

export default ProfileView;
