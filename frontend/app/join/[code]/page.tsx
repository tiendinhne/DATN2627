'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth.context';
import { joinRoom } from '@/services/room.service';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

// Vào phòng bằng đường dẫn chia sẻ. Chưa đăng nhập → sang /login, xong quay lại đây (§4)
export default function JoinByLinkPage() {
  const { code } = useParams<{ code: string }>();
  const { token, isLoading } = useAuth();
  const router = useRouter();
  const [error, setError] = useState('');

  useEffect(() => {
    if (isLoading) return;
    if (!token) {
      router.replace(`/login?returnUrl=${encodeURIComponent(`/join/${code}`)}`);
      return;
    }
    // API idempotent: đã là thành viên thì vẫn trả phòng
    joinRoom(token, code)
      .then((room) => router.replace(`/rooms/${room.id}`))
      .catch((err: Error) => setError(err.message));
  }, [isLoading, token, code, router]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      <Card className="w-full max-w-sm">
        <CardContent className="space-y-4 text-center">
          {error ? (
            <>
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
              <Button asChild variant="link">
                <Link href="/rooms">← Về danh sách phòng</Link>
              </Button>
            </>
          ) : (
            <p className="text-lg text-muted-foreground">Đang vào phòng...</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
