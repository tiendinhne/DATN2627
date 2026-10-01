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
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
        <p className="text-lg text-gray-700">Đang xử lý đăng nhập...</p>
      </div>
    </div>
  );
}
