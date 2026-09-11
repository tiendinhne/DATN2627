// Sau khi backend redirect về đây kèm ?token=xxx, trang này lưu token và chuyển hướng vào app

'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function AuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const token = searchParams.get('token');
    if (token) {
      // Đồ án có thể thay bằng cookie httpOnly (an toàn hơn) nếu có thời gian làm thêm
      localStorage.setItem('accessToken', token);
      router.replace('/dashboard');
    } else {
      router.replace('/login?error=google_auth_failed');
    }
  }, [router, searchParams]);

  return <p>Đang đăng nhập...</p>;
}
