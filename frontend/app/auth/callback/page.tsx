'use client';

import { useEffect } from 'react';
import { safeReturnUrl } from '@/lib/return-url';

export default function AuthCallbackPage() {
  useEffect(() => {
    // Backend đã đặt cookie refresh rồi chuyển về đây — không còn token trên query (PROJECT_CONTEXT §16).
    // returnUrl do trang login cất trước khi chuyển sang Google.
    // Không removeItem: dev Strict Mode chạy effect 2 lần, lần 2 đọc null sẽ ghi đè bằng /dashboard.
    // Để lại vô hại: nút Google ở /login luôn ghi đè trước mỗi lần đăng nhập.
    const returnUrl = safeReturnUrl(sessionStorage.getItem('returnUrl'));
    // Tải lại cả trang tới returnUrl → AuthProvider gọi /auth/refresh lấy access token từ cookie.
    // Không có cookie (đăng nhập Google lỗi) → trang cần đăng nhập tự đưa về /login.
    window.location.replace(returnUrl);
  }, []);

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
        <p className="text-lg text-gray-700">Đang xử lý đăng nhập...</p>
      </div>
    </div>
  );
}
