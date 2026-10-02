'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { safeReturnUrl } from '@/lib/return-url';

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    // Đọc query trực tiếp thay vì useSearchParams → không cần bọc Suspense khi build
    const token = new URLSearchParams(window.location.search).get('token');
    if (token) {
      localStorage.setItem('accessToken', token);
      // returnUrl do trang login cất trước khi chuyển sang Google.
      // Không removeItem: dev Strict Mode chạy effect 2 lần, lần 2 đọc null sẽ ghi đè bằng /dashboard.
      // Để lại vô hại: nút Google ở /login luôn ghi đè trước mỗi lần đăng nhập.
      const returnUrl = safeReturnUrl(sessionStorage.getItem('returnUrl'));
      // Tải lại cả trang: AuthProvider chỉ đọc token từ localStorage lúc khởi tạo,
      // router.replace (chuyển trang phía client) sẽ giữ token = null
      window.location.replace(returnUrl);
    } else {
      router.replace('/login?error=google_auth_failed');
    }
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-center">
        <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600" />

        <h2 className="text-lg font-semibold text-slate-900">
          Đang đăng nhập
        </h2>

        <p className="mt-1 text-sm text-slate-500">
          Vui lòng chờ trong giây lát...
        </p>
      </div>
    </div>
  );
}
