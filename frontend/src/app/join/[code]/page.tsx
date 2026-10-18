'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth.context';
import { joinRoom } from '@/services/room.service';

export default function JoinByLinkPage() {
  const params = useParams<{ code: string }>();
  const code = params?.code || '';
  const { token, isLoading } = useAuth();
  const router = useRouter();
  const [error, setError] = useState('');

  useEffect(() => {
    if (isLoading) return;
    if (!token) {
      router.replace(`/login?returnUrl=${encodeURIComponent(`/join/${code}`)}`);
      return;
    }
    if (!code) return;

    joinRoom(token, code)
      .then((room) => router.replace(`/rooms/${room.id}`))
      .catch((err: Error) => setError(err.message));
  }, [isLoading, token, code, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm">
        {error ? (
          <>
            <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">
              {error}
            </div>
            <Link
              href="/dashboard"
              className="inline-block text-sm font-medium text-blue-600 hover:underline"
            >
              ← Về trang tổng quan
            </Link>
          </>
        ) : (
          <div className="space-y-3">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600" />
            <p className="text-sm text-slate-500">Đang tham gia phòng...</p>
          </div>
        )}
      </div>
    </div>
  );
}
