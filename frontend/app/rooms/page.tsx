'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth.context';
import { useProtectedRoute } from '@/hooks/useProtectedRoute';
import { createRoom, joinRoom, listMyRooms } from '@/services/room.service';
import type { Room } from '@/types/room';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

// Trang "Phòng của tôi": tạo phòng, nhập mã tham gia, danh sách phòng
export default function RoomsPage() {
  const { token } = useAuth();
  const { isLoading } = useProtectedRoute();
  const router = useRouter();

  const [rooms, setRooms] = useState<Room[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) return;
    listMyRooms(token, page)
      .then((res) => {
        setRooms(res.items);
        setHasMore(res.hasMore);
      })
      .catch((err: Error) => setError(err.message));
  }, [token, page]);

  // Tạo phòng / nhập mã xong thì chuyển sang trang chi tiết phòng
  const run = async (action: () => Promise<Room>) => {
    setError('');
    setBusy(true);
    try {
      const room = await action();
      router.push(`/rooms/${room.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Có lỗi xảy ra');
      setBusy(false);
    }
  };

  if (isLoading || !token) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-lg text-muted-foreground">Đang tải...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">Phòng của tôi</h1>
          <Button asChild variant="link">
            <Link href="/dashboard">Tài khoản</Link>
          </Button>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Tạo phòng mới</CardTitle>
            </CardHeader>
            <CardContent>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  run(() => createRoom(token, { name, description: description || undefined }));
                }}
                className="space-y-3"
              >
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Tên phòng"
                  maxLength={100}
                  required
                />
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Mô tả (không bắt buộc)"
                  maxLength={500}
                  rows={2}
                />
                <Button type="submit" disabled={busy}>
                  Tạo phòng
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Tham gia bằng mã</CardTitle>
            </CardHeader>
            <CardContent>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  run(() => joinRoom(token, code));
                }}
                className="space-y-3"
              >
                <Input
                  className="font-mono tracking-widest uppercase"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="VD: ABCD2345"
                  maxLength={8}
                  required
                />
                <Button type="submit" disabled={busy}>
                  Tham gia
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardContent>
            {rooms.length === 0 ? (
              <p className="text-muted-foreground">Bạn chưa ở trong phòng nào.</p>
            ) : (
              <ul className="divide-y">
                {rooms.map((room) => (
                  <li key={room.id}>
                    <Link
                      href={`/rooms/${room.id}`}
                      className="flex justify-between items-center py-3 px-2 rounded-md hover:bg-muted"
                    >
                      <div>
                        <p className="font-semibold">{room.name}</p>
                        <p className="text-sm text-muted-foreground">{room.memberCount} thành viên</p>
                      </div>
                      {room.myRole === 'HOST' && <Badge variant="secondary">HOST</Badge>}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex justify-between mt-4">
              <Button variant="ghost" disabled={page === 1} onClick={() => setPage(page - 1)}>
                ← Trang trước
              </Button>
              <Button variant="ghost" disabled={!hasMore} onClick={() => setPage(page + 1)}>
                Trang sau →
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
