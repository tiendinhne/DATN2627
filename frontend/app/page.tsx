'use client';

import Link from 'next/link';
import { useAuth } from '@/context/auth.context';
import { useRouter } from 'next/navigation';

export default function Home() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-indigo-100">
      <nav className="bg-white shadow-md">
        <div className="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">DATN 2627</h1>
          <div className="flex gap-4">
            {!isLoading && user ? (
              <>
                <Link
                  href="/dashboard"
                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition duration-200"
                >
                  Dashboard
                </Link>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition duration-200"
                >
                  Đăng Nhập
                </Link>
                <Link
                  href="/register"
                  className="bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 px-4 rounded-lg transition duration-200"
                >
                  Đăng Ký
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-6 py-16">
        <div className="text-center mb-16">
          <h2 className="text-5xl font-bold text-gray-900 mb-4">
            Chào mừng đến DATN 2627
          </h2>
          <p className="text-xl text-gray-600 mb-8">
            Demo ứng dụng xác thực hoàn chỉnh với Next.js & NestJS
          </p>

          {!isLoading && user ? (
            <div className="inline-block bg-green-50 border-2 border-green-200 rounded-lg p-6 mb-8">
              <p className="text-green-800">
                ✓ Xin chào, <span className="font-bold">{user.displayName || user.username}</span>!
              </p>
            </div>
          ) : (
            <div className="flex gap-4 justify-center">
              <Link
                href="/login"
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-8 rounded-lg transition duration-200 text-lg"
              >
                Đăng Nhập
              </Link>
              <Link
                href="/register"
                className="bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 px-8 rounded-lg transition duration-200 text-lg"
              >
                Đăng Ký
              </Link>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="bg-white rounded-lg shadow-lg p-8">
            <div className="text-4xl mb-4">🔐</div>
            <h3 className="text-xl font-bold text-gray-900 mb-4">Xác Thực An Toàn</h3>
            <p className="text-gray-600">
              Sử dụng JWT và Passport.js để xác thực người dùng một cách an toàn và đáng tin cậy.
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-lg p-8">
            <div className="text-4xl mb-4">🔑</div>
            <h3 className="text-xl font-bold text-gray-900 mb-4">Google OAuth</h3>
            <p className="text-gray-600">
              Đăng nhập nhanh chóng với tài khoản Google của bạn.
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-lg p-8">
            <div className="text-4xl mb-4">📱</div>
            <h3 className="text-xl font-bold text-gray-900 mb-4">Responsive Design</h3>
            <p className="text-gray-600">
              Giao diện đẹp và thân thiện với mọi thiết bị.
            </p>
          </div>
        </div>

        <div className="mt-16 bg-white rounded-lg shadow-lg p-8">
          <h3 className="text-2xl font-bold text-gray-900 mb-6">Các Tính Năng Demo</h3>
          <ul className="space-y-4 text-gray-700">
            <li className="flex items-start gap-3">
              <span className="text-blue-600 font-bold">✓</span>
              <span><strong>Đăng Ký:</strong> Tạo tài khoản mới với email, tên đăng nhập và mật khẩu</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-blue-600 font-bold">✓</span>
              <span><strong>Đăng Nhập:</strong> Đăng nhập với email/tên đăng nhập và mật khẩu</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-blue-600 font-bold">✓</span>
              <span><strong>Google OAuth:</strong> Đăng nhập nhanh với Google</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-blue-600 font-bold">✓</span>
              <span><strong>Dashboard:</strong> Xem thông tin cá nhân sau khi đăng nhập</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-blue-600 font-bold">✓</span>
              <span><strong>Quản Lý Token:</strong> Token được lưu tự động và gửi kèm mỗi request</span>
            </li>
          </ul>
        </div>

        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-8 text-center">
          <p className="text-blue-900 mb-4">
            💡 <strong>Gợi ý:</strong> Sử dụng tài khoản test của bạn hoặc đăng ký một tài khoản mới để khám phá các tính năng.
          </p>
          <p className="text-blue-700 text-sm">
            Backend API chạy trên: <code className="bg-white px-2 py-1 rounded">http://localhost:3001</code>
          </p>
        </div>
      </main>
    </div>
  );
}
