'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function Home() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('accessToken');
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const res = await fetch('http://localhost:3001/auth/me', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          setUser(await res.json());
        } else {
          localStorage.removeItem('accessToken');
        }
      } catch (error) {
        console.error('Auth check failed:', error);
      }
      setLoading(false);
    };

    checkAuth();
  }, []);

  const logout = () => {
    localStorage.removeItem('accessToken');
    setUser(null);
  };

  if (loading) return <div className="p-4">Loading...</div>;

  if (user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
        <div className="max-w-md mx-auto bg-white rounded-lg shadow-lg p-6">
          <h1 className="text-2xl font-bold text-gray-800 mb-4">Welcome 👋</h1>
          <div className="bg-gray-100 p-4 rounded mb-6">
            <p className="text-sm text-gray-600">Email</p>
            <p className="font-semibold text-gray-800">{user.email}</p>
            <p className="text-sm text-gray-600 mt-3">Username</p>
            <p className="font-semibold text-gray-800">{user.username}</p>
            <p className="text-sm text-gray-600 mt-3">Provider</p>
            <p className="font-semibold text-gray-800">{user.providers?.join(', ')}</p>
          </div>
          <button
            onClick={logout}
            className="w-full bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded"
          >
            Logout
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl p-8 w-full max-w-md">
        <h1 className="text-3xl font-bold text-center text-gray-800 mb-8">Online Learning</h1>
        <div className="space-y-4">
          <Link
            href="/auth/login"
            className="block text-center bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-4 rounded-lg transition"
          >
            Login
          </Link>
          <Link
            href="/auth/register"
            className="block text-center bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-4 rounded-lg transition"
          >
            Register
          </Link>
        </div>
        <p className="text-center text-gray-600 text-sm mt-6">
          Demo: test@example.com / Password123
        </p>
      </div>
    </div>
  );
}
