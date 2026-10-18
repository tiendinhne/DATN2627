'use client';

import { useEffect } from 'react';
import { safeReturnUrl } from '@/lib/return-url';

export default function AuthCallbackPage() {
  useEffect(() => {
    // Backend đã đặt cookie refresh rồi chuyển về đây — không còn token trên query (PROJECT_CONTEXT §16).
    // returnUrl do trang login cất trước khi chuyển sang Google.
    // Không removeItem: dev Strict Mode chạy effect 2 lần, lần 2 đọc null sẽ ghi đè bằng /dashboard.
    const token = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('token') : null;
    if (token) {
      localStorage.setItem('accessToken', token);
    }
    const returnUrl = safeReturnUrl(sessionStorage.getItem('returnUrl'));
    // Tải lại cả trang tới returnUrl → AuthProvider gọi /auth/refresh lấy access token từ cookie.
    window.location.replace(returnUrl);
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-center">
        <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600" />
        <h2 className="text-lg font-semibold text-slate-900">
          Đang xử lý đăng nhập...
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Vui lòng chờ trong giây lát...
        </p>
      </div>
    </div>
  );
}
