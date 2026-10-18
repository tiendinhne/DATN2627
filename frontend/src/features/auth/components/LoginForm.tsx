"use client";

import { Eye } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { SocialDivider } from "./SocialDivider";
import { useAuth } from "@/context/auth.context";
import { safeReturnUrl } from '@/lib/return-url';

export function LoginForm({
  onNavigate,
}: {
  onNavigate?: (page: string) => void;
}) {
  const router = useRouter();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const [showPassword, setShowPassword] = useState(false);

  const getReturnUrl = () => safeReturnUrl(new URLSearchParams(window.location.search).get('returnUrl'));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await login(identifier, password);
      router.push(getReturnUrl());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Đăng nhập thất bại');
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = () => {
    if (onNavigate) {
      onNavigate("forgot-password");
    } else {
      router.push("/forgot-password");
    }
  };

  const handleRegister = () => {
    if (onNavigate) {
      onNavigate("register");
    } else {
      router.push("/register");
    }
  };

  return (
    <form className="auth-form" onSubmit={handleSubmit}>
      <p className="eyebrow">CHÀO MỪNG TRỞ LẠI</p>
      <h1>Đăng nhập vào tài khoản</h1>
      <p>Tiếp tục hành trình học tập cùng nhóm của bạn.</p>
      {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        )}
      <label>
        Email hoặc tên đăng nhập
        <input
              id="identifier"
              type="text"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              disabled={isLoading}
              placeholder="Nhập email hoặc tên đăng nhập"
              required
            />
      </label>
      <label>
        Mật khẩu
        <div className="password-input">
          <input
            type={showPassword ? "text" : "password"}
            placeholder="Nhập mật khẩu"
            required
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isLoading}
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
      <div className="form-options">
        <button type="button" onClick={handleForgotPassword}>
          Quên mật khẩu?
        </button>
      </div>
      <button className="button primary large w-full" type="submit" disabled={isLoading}>
        {isLoading ? 'Đang đăng nhập...' : 'Đăng nhập'}
      </button>
      <SocialDivider />
      <p className="register-link">
        Chưa có tài khoản?{" "}
        <button type="button" onClick={handleRegister}>
          Đăng ký ngay
        </button>
      </p>
    </form>
  );
}

export default LoginForm;
