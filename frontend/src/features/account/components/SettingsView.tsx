"use client";

import { Bell, Camera, Mic, Monitor, Moon, Sun, UserRound } from "lucide-react";
import { useState } from "react";
import { useTheme } from "@/context/ThemeContext";
import { useAuth } from "@/context/auth.context";

interface SettingsViewProps {
  dark?: boolean;
  onThemeChange?: (value: boolean) => void;
}

export function SettingsView({
  dark: propDark,
  onThemeChange: propOnThemeChange,
}: SettingsViewProps) {
  const { dark: contextDark, setDark: contextSetDark } = useTheme();
  const { user } = useAuth();

  const isDark = propDark !== undefined ? propDark : contextDark;
  const handleThemeChange = propOnThemeChange || contextSetDark;

  const [notifications, setNotifications] = useState(true);
  const [camera, setCamera] = useState(true);
  const [microphone, setMicrophone] = useState(false);

  return (
    <div className="content-wrap settings-page">
      <div className="account-heading">
        <p className="eyebrow">TÙY CHỈNH</p>
        <h1>Cài đặt</h1>
        <p>Quản lý trải nghiệm sử dụng RusSra của bạn.</p>
      </div>
      <div className="settings-stack">
        <SettingsSection
          icon={UserRound}
          title="Tài khoản"
          description="Thông tin đăng nhập và bảo mật"
        >
          <div className="settings-row">
            <div>
              <strong>Tên người dùng</strong>
              <small>{user?.displayName || user?.username || "Chưa cập nhật"}</small>
            </div>
            <button className="button secondary small" type="button">
              Chỉnh sửa
            </button>
          </div>
          <div className="settings-row">
            <div>
              <strong>Email</strong>
              <small>{user?.email || "Chưa cập nhật"}</small>
            </div>
            <span className="verified-pill">Đã xác minh</span>
          </div>
        </SettingsSection>

        <SettingsSection
          icon={Monitor}
          title="Giao diện"
          description="Chọn giao diện phù hợp với bạn"
        >
          <div className="theme-options">
            <button
              className={!isDark ? "active" : ""}
              onClick={() => handleThemeChange(false)}
              type="button"
            >
              <span>
                <Sun size={22} />
              </span>
              <strong>Sáng</strong>
              <small>Không gian sáng, rõ ràng</small>
            </button>
            <button
              className={isDark ? "active" : ""}
              onClick={() => handleThemeChange(true)}
              type="button"
            >
              <span className="dark-preview">
                <Moon size={22} />
              </span>
              <strong>Tối</strong>
              <small>Dịu mắt khi học buổi tối</small>
            </button>
          </div>
        </SettingsSection>

        <SettingsSection
          icon={Bell}
          title="Thông báo"
          description="Kiểm soát thông báo từ phòng học"
        >
          <ToggleRow
            label="Bật thông báo"
            detail="Nhận cập nhật mới từ phòng và cuộc họp"
            value={notifications}
            onChange={setNotifications}
          />
        </SettingsSection>

        <SettingsSection
          icon={Camera}
          title="Thiết bị cuộc họp"
          description="Thiết lập mặc định khi tham gia"
        >
          <ToggleRow
            icon={Mic}
            label="Bật microphone khi tham gia"
            detail="Bạn vẫn có thể thay đổi trong cuộc họp"
            value={microphone}
            onChange={setMicrophone}
          />
          <ToggleRow
            icon={Camera}
            label="Bật camera khi tham gia"
            detail="Hiển thị bản xem trước trước khi vào phòng"
            value={camera}
            onChange={setCamera}
          />
        </SettingsSection>
      </div>
    </div>
  );
}

function SettingsSection({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: typeof Bell;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="panel-card settings-section">
      <header>
        <span>
          <Icon size={19} />
        </span>
        <div>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
      </header>
      <div className="settings-content">{children}</div>
    </section>
  );
}

function ToggleRow({
  icon: Icon,
  label,
  detail,
  value,
  onChange,
}: {
  icon?: typeof Bell;
  label: string;
  detail: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="settings-row">
      <div className="toggle-label">
        {Icon && <Icon size={17} />}
        <p>
          <strong>{label}</strong>
          <small>{detail}</small>
        </p>
      </div>
      <button
        className={`toggle ${value ? "on" : ""}`}
        onClick={() => onChange(!value)}
        aria-label={label}
        type="button"
      >
        <span />
      </button>
    </div>
  );
}

export default SettingsView;
