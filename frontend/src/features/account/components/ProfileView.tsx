"use client";

import { Camera, Check, Mail, ShieldCheck, UserRound } from "lucide-react";
import { useAuth } from "@/context/auth.context";
import { useEffect, useState } from "react";

export function ProfileView() {
  const [saved, setSaved] = useState(false);
  const { user } = useAuth();
  const [displayName, setDisplayName] = useState("");

  useEffect(() => {
  if (user) {
    setDisplayName(user.displayName || user.username || "");
  }
}, [user]);

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
              <p>Sinh viên · Đang hoạt động</p>
            </div>
          </div>
          <div className="profile-facts">
            <div>
              <strong>3</strong>
              <span>Phòng học</span>
            </div>
            <div>
              <strong>12</strong>
              <span>Cuộc họp</span>
            </div>
            <div>
              <strong>8.5h</strong>
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
          <form
            className="profile-form"
            onSubmit={(event) => {
              event.preventDefault();
              setSaved(true);
              window.setTimeout(() => setSaved(false), 2500);
            }}
          >
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
                <strong>Tài khoản sinh viên đã xác minh</strong>
                <small>Thành viên từ ngày 02/06/2026</small>
              </p>
            </div>
            <div className="form-footer">
              {saved && (
                <span className="saved-message">
                  <Check size={15} /> Đã lưu thay đổi
                </span>
              )}
              <button className="button primary" type="submit">
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
