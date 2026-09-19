'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/auth.context';

export default function DashboardPage() {
  const { user, token, isLoading, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !token) {
      router.push('/login?redirect=dashboard');
    }
  }, [token, isLoading, router]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-lg text-gray-600">Đang tải...</p>
      </div>
    );
  }

  if (!user || !token) {
    return null;
  }

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <nav className="bg-white shadow-md">
        <div className="max-w-4xl mx-auto px-6 py-4 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-900">DATN Demo</h2>
          <button
            onClick={handleLogout}
            className="bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-lg transition duration-200"
          >
            Đăng Xuất
          </button>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="flex items-center gap-6 mb-8">
            <div className="w-20 h-20 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center text-white text-3xl font-bold">
              {user.displayName?.charAt(0)?.toUpperCase() || user.username?.charAt(0)?.toUpperCase() || 'U'}
            </div>
            <div>
              <h1 className="text-4xl font-bold text-gray-900">
                {user.displayName || user.username}
              </h1>
              <p className="text-gray-600 text-lg">{user.email}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
              <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide">ID Người Dùng</h3>
              <p className="text-xl font-mono text-gray-900 mt-2 break-all">{user.id}</p>
            </div>

            <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
              <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide">Tên Đăng Nhập</h3>
              <p className="text-xl font-semibold text-gray-900 mt-2">{user.username}</p>
            </div>

            <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
              <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide">Email</h3>
              <p className="text-xl text-gray-900 mt-2">{user.email}</p>
            </div>

            <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
              <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide">Tên Hiển Thị</h3>
              <p className="text-xl text-gray-900 mt-2">{user.displayName || 'Chưa cập nhật'}</p>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8">
            <h3 className="text-sm font-medium text-blue-900 uppercase tracking-wide mb-4">Access Token</h3>
            <div className="bg-white rounded p-4 font-mono text-sm text-gray-700 break-all max-h-32 overflow-y-auto border border-blue-100">
              {token}
            </div>
            <p className="text-xs text-blue-600 mt-2">
              💡 Token này được lưu trong localStorage để tự động xác thực các request
            </p>
          </div>

          <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-8">
            <h3 className="font-semibold text-green-900 mb-4">✓ Đăng Nhập Thành Công</h3>
            <p className="text-green-800">
              Bạn đã đăng nhập thành công! Hệ thống đã lưu token của bạn và có thể tự động xác thực các request tiếp theo.
            </p>
          </div>

          <div className="flex gap-4">
            <button
              onClick={handleLogout}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold py-3 px-6 rounded-lg transition duration-200"
            >
              Đăng Xuất
            </button>
            <Link
              href="/"
              className="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-semibold py-3 px-6 rounded-lg transition duration-200 text-center"
            >
              Về Trang Chủ
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
