'use client';

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

export interface User {
  id: string;
  email: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
}

export interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  updateDisplayName: (displayName: string) => Promise<void>;
  login: (identifier: string, password: string) => Promise<void>;
  register: (email: string, username: string, displayName: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  loginWithGoogle: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// Làm mới access token trước khi hết hạn 60 giây
const REFRESH_BEFORE_MS = 60_000;

// Thời điểm hết hạn (ms) đọc từ payload của JWT — chỉ để hẹn giờ làm mới, không dùng để xác thực
function tokenExpiresAt(token: string): number {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return payload.exp * 1000;
  } catch {
    return 0;
  }
}

type Session = { accessToken: string; user: User };

// Đổi cookie refresh lấy access token mới. Thất bại (không có cookie, hết hạn, bị thu hồi) → null
async function requestRefresh(): Promise<Session | null> {
  try {
    const res = await fetch(`${API_URL}/auth/refresh`, { method: 'POST', credentials: 'include' });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

// Access token (15 phút) chỉ giữ trong memory (ADR-023, PROJECT_CONTEXT §5), không localStorage.
// Refresh token nằm trong cookie httpOnly do backend đặt → mọi request auth phải gửi kèm cookie.
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Áp kết quả làm mới vào state; null → coi như chưa đăng nhập
  const applySession = useCallback((session: Session | null) => {
    setToken(session?.accessToken ?? null);
    setUser(session?.user ?? null);
  }, []);

  const updateDisplayName = async (displayName: string) => {
    if (!token) {
      throw new Error('Phiên đăng nhập không hợp lệ');
    }

    const response = await fetch(`${API_URL}/auth/me`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      credentials: 'include',
      body: JSON.stringify({ displayName }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      const message = Array.isArray(error.message) ? error.message.join(', ') : error.message;
      throw new Error(message || 'Không thể cập nhật tên hiển thị');
    }

    const updatedUser: User = await response.json();
    setUser(updatedUser);
  };

  const updateDisplayName = async (displayName: string) => {
    if (!token) {
      throw new Error('Phiên đăng nhập không hợp lệ');
    }

    const response = await fetch(`${API_URL}/auth/me`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      credentials: 'include',
      body: JSON.stringify({ displayName }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      const message = Array.isArray(error.message) ? error.message.join(', ') : error.message;
      throw new Error(message || 'Không thể cập nhật tên hiển thị');
    }

    const updatedUser: User = await response.json();
    setUser(updatedUser);
  };

  // Mỗi lần tải trang (kể cả F5) lấy access token từ cookie refresh.
  // Dev Strict Mode gọi 2 lần cùng một cookie → backend cho lần sau đi qua nhờ ân hạn 10 giây.
  useEffect(() => {
    requestRefresh()
      .then(applySession)
      .finally(() => setIsLoading(false));
  }, [applySession]);

  // Hẹn giờ làm mới trước khi hết hạn. Khi tab được mở lại thì kiểm ngay
  useEffect(() => {
    if (!token) return;
    const expiresAt = tokenExpiresAt(token);
    if (!expiresAt) return;
    const refresh = () => requestRefresh().then(applySession);
    const timer = setTimeout(refresh, Math.max(expiresAt - Date.now() - REFRESH_BEFORE_MS, 0));
    const onVisible = () => {
      if (document.visibilityState === 'visible' && expiresAt - Date.now() < REFRESH_BEFORE_MS) refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [token, applySession]);

  const login = async (identifier: string, password: string) => {
    const res = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include', // nhận cookie refresh
      body: JSON.stringify({ identifier, password }),
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      const message = Array.isArray(error.message) ? error.message.join(', ') : error.message;
      throw new Error(message || 'Sai tài khoản hoặc mật khẩu');
    }
    const { accessToken, user } = await res.json();
    setToken(accessToken);
    setUser(user);
  };

  const register = async (email: string, username: string, displayName: string, password: string) => {
    const res = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include', // nhận cookie refresh
      body: JSON.stringify({ email, username, displayName, password }),
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      const message = Array.isArray(error.message) ? error.message.join(', ') : error.message;
      throw new Error(message || 'Đăng ký thất bại');
    }
    const { accessToken, user } = await res.json();
    setToken(accessToken);
    setUser(user);
  };

  // Backend thu hồi refresh token + xoá cookie (JS không xoá được cookie httpOnly).
  // Lỗi mạng vẫn đăng xuất phía trình duyệt.
  const logout = async () => {
    await fetch(`${API_URL}/auth/logout`, { method: 'POST', credentials: 'include' }).catch(() => {});
    setToken(null);
    setUser(null);
  };

  const loginWithGoogle = () => {
    window.location.href = `${API_URL}/auth/google`;
  };

  return (
    <AuthContext.Provider
      value={{ user, token, isLoading, updateDisplayName, login, register, logout, loginWithGoogle }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}