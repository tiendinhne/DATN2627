"use client";

import { Eye } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { SocialDivider } from "./SocialDivider";
import { useAuth } from '@/context/auth.context';

export function RegisterForm({
  onNavigate,
}: {
  onNavigate?: (page: string) => void;
}) {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { register } = useAuth();
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Mật khẩu không khớp');
      return;
    }

    if (password.length < 6) {
      setError('Mật khẩu phải có ít nhất 6 ký tự');
      return;
    }

    setIsLoading(true);

    try {
      await register(email, username, displayName, password);
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Đăng ký thất bại');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = () => {
    if (onNavigate) {
      onNavigate("login");
    } else {
      router.push("/login");
    }
  };

  return (
    <form className="auth-form register-form" onSubmit={handleSubmit}>
      <p className="eyebrow">BẮT ĐẦU CÙNG RUSSRA</p>
      <h1>Tạo tài khoản mới</h1>
      <p>Tham gia không gian học nhóm và sáng tạo cùng bạn bè.</p>
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}
      <div className="field-grid">
        <label>
          Tên người dùng
          <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={isLoading}
              placeholder="Username"
              required
            />
        </label>
        <label>
          Tên hiển thị
          <input
              id="displayName"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              disabled={isLoading}
              placeholder="Nguyễn Văn A"
              maxLength={20}
              required
            />
        </label>
      </div>
      <label>
        Email
        <div className="password-input">
          <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading}
              placeholder="your@email.com"
              required
          />
        </div>
      </label>
      <label>
        Mật khẩu
        <div className="password-input">
          <input
            id="password"
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isLoading}
            placeholder="Ít nhất 6 ký tự"
            required
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            style={{ border: 0, background: "none", cursor: "pointer", padding: 0 }}
            aria-label="Ẩn/Hiện mật khẩu"
          >
            <Eye size={18} />
          </button>
        </div>
      </label>
      <label>
        Xác nhận mật khẩu
        <div className="password-input">
          <input
              id="confirmPassword"
              type={showConfirmPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={isLoading}
              placeholder="Nhập lại mật khẩu"
              required
            />
          <button
            type="button"
            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            style={{ border: 0, background: "none", cursor: "pointer", padding: 0 }}
            aria-label="Ẩn/Hiện xác nhận mật khẩu"
          >
            <Eye size={18} />
          </button>
        </div>
      </label>
      <label className="terms-check">
        <input type="checkbox" required /> Tôi đồng ý với{" "}
        <button type="button">Điều khoản sử dụng</button> và{" "}
        <button type="button">Chính sách bảo mật</button>.
      </label>
      <button className="button primary large w-full" type="submit" disabled={isLoading}>
        {isLoading ? 'Đang đăng ký...' : 'Tạo tài khoản'}
      </button>
      <SocialDivider />
      <p className="register-link">
        Đã có tài khoản?{" "}
        <button type="button" onClick={handleLogin}>
          Đăng nhập
        </button>
      </p>
    </form>
  );
}

export default RegisterForm;
