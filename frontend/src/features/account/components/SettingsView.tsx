"use client";

import { Bell, Camera, Check, KeyRound, Mic, Monitor, Moon, Sun, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "@/context/ThemeContext";
import { useAuth } from "@/context/auth.context";
import { changePassword, getMyProfile } from "@/services/user.service";

interface SettingsViewProps {
  dark?: boolean;
  onThemeChange?: (value: boolean) => void;
}

export function SettingsView({
  dark: propDark,
  onThemeChange: propOnThemeChange,
}: SettingsViewProps) {
  const { dark: contextDark, setDark: contextSetDark } = useTheme();
  const { user, token } = useAuth();
  const router = useRouter();

  const isDark = propDark !== undefined ? propDark : contextDark;
  const handleThemeChange = propOnThemeChange || contextSetDark;

  const [notifications, setNotifications] = useState(true);
  const [camera, setCamera] = useState(true);
  const [microphone, setMicrophone] = useState(false);

  // Đổi mật khẩu (ADR-027). hasPassword = false: tài khoản chỉ dùng Google → "Đặt mật khẩu", không hỏi mật khẩu cũ
  const [hasPassword, setHasPassword] = useState(true);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordDone, setPasswordDone] = useState(false);
  const [passwordBusy, setPasswordBusy] = useState(false);

  useEffect(() => {
    if (!token) return;
    getMyProfile(token)
      .then((profile) => setHasPassword(profile.hasPassword))
      .catch(() => {});
  }, [token]);

  const handleChangePassword = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!token) return;
    setPasswordError("");
    setPasswordDone(false);
    if (newPassword !== confirmPassword) {
      setPasswordError("Mật khẩu nhập lại không khớp");
      return;
    }
    setPasswordBusy(true);
    try {
      await changePassword(token, { currentPassword: hasPassword ? currentPassword : undefined, newPassword });
      setHasPassword(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordDone(true);
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : "Không đổi được mật khẩu");
    } finally {
      setPasswordBusy(false);
    }
  };

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
            <button className="button secondary small" type="button" onClick={() => router.push("/profile")}>
              Chỉnh sửa
            </button>
          </div>
          <div className="settings-row">
            <div>
              <strong>Email</strong>
              <small>{user?.email || "Chưa cập nhật"}</small>
            </div>
          </div>
        </SettingsSection>

        <SettingsSection
          icon={KeyRound}
          title={hasPassword ? "Đổi mật khẩu" : "Đặt mật khẩu"}
          description={
            hasPassword
              ? "Đổi xong, các thiết bị khác sẽ bị đăng xuất"
              : "Tài khoản đăng nhập bằng Google — đặt mật khẩu để đăng nhập thêm bằng mật khẩu"
          }
        >
          <form className="profile-form" onSubmit={handleChangePassword}>
            {hasPassword && (
              <label>
                <span>Mật khẩu hiện tại</span>
                <input
                  type="password"
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                  required
                />
              </label>
            )}
            <label>
              <span>Mật khẩu mới</span>
              <input
                type="password"
                autoComplete="new-password"
                minLength={6}
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                required
              />
            </label>
            <label>
              <span>Nhập lại mật khẩu mới</span>
              <input
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                required
              />
            </label>
            <div className="form-footer">
              {passwordError && <span className="text-sm text-red-600">{passwordError}</span>}
              {passwordDone && (
                <span className="saved-message">
                  <Check size={15} /> Đã cập nhật mật khẩu
                </span>
              )}
              <button className="button primary" type="submit" disabled={passwordBusy}>
                {hasPassword ? "Đổi mật khẩu" : "Đặt mật khẩu"}
              </button>
            </div>
          </form>
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
