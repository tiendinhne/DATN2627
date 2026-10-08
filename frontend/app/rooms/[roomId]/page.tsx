'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth.context';
import { useProtectedRoute } from '@/hooks/useProtectedRoute';
import {
  addMember,
  dissolveRoom,
  getRoom,
  kickMember,
  leaveRoom,
  listMembers,
  updateRoom,
} from '@/services/room.service';
import type { Room, RoomMember } from '@/types/room';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { MeetingSection } from '@/features/meetings/meeting-section';

// Chi tiết phòng. Nút của HOST chỉ ẩn/hiện theo myRole — backend mới là nơi kiểm quyền.
export default function RoomDetailPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const { token } = useAuth();
  const { isLoading } = useProtectedRoute();
  const router = useRouter();

  const [room, setRoom] = useState<Room | null>(null);
  const [members, setMembers] = useState<RoomMember[]>([]);
  const [error, setError] = useState('');
  // Tăng lên để tải lại phòng + thành viên sau mỗi thao tác
  const [reloadKey, setReloadKey] = useState(0);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [newEmail, setNewEmail] = useState('');

  useEffect(() => {
    if (!token) return;
    Promise.all([getRoom(token, roomId), listMembers(token, roomId)])
      .then(([roomData, memberData]) => {
        setRoom(roomData);
        setMembers(memberData);
      })
      .catch((err: Error) => setError(err.message));
  }, [token, roomId, reloadKey]);

  // Chạy một thao tác; lỗi thì hiện thông báo, thành công thì gọi after()
  const run = async (action: () => Promise<unknown>, after: () => void) => {
    setError('');
    try {
      await action();
      after();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Có lỗi xảy ra');
    }
  };
  const reload = () => setReloadKey((k) => k + 1);

  if (isLoading || !token) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-lg text-muted-foreground">Đang tải...</p>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 p-6">
        {error ? (
          <Alert variant="destructive" className="max-w-sm">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : (
          <p className="text-lg text-muted-foreground">Đang tải...</p>
        )}
        <Button asChild variant="link">
          <Link href="/rooms">← Về danh sách phòng</Link>
        </Button>
      </div>
    );
  }

  const isHost = room.myRole === 'HOST';
  const joinLink = `${window.location.origin}/join/${room.joinCode}`;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        <Button asChild variant="link" className="px-0">
          <Link href="/rooms">← Phòng của tôi</Link>
        </Button>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Thông tin phòng + sửa (HOST) */}
        <Card>
          <CardContent className="space-y-3">
            {editing ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  run(() => updateRoom(token, roomId, { name, description }), () => {
                    setEditing(false);
                    reload();
                  });
                }}
                className="space-y-3"
              >
                <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={100} required />
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  maxLength={500}
                  rows={2}
                />
                <div className="flex gap-3">
                  <Button type="submit">Lưu</Button>
                  <Button type="button" variant="ghost" onClick={() => setEditing(false)}>
                    Huỷ
                  </Button>
                </div>
              </form>
            ) : (
              <>
                <div className="flex justify-between items-start">
                  <h1 className="text-3xl font-bold">{room.name}</h1>
                  {isHost && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        setName(room.name);
                        setDescription(room.description);
                        setEditing(true);
                      }}
                    >
                      Sửa
                    </Button>
                  )}
                </div>
                {room.description && <p className="text-muted-foreground">{room.description}</p>}
              </>
            )}
          </CardContent>
        </Card>

        {/* Chia sẻ mã / đường dẫn */}
        <Card>
          <CardHeader>
            <CardTitle>Mời người khác vào phòng</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3">
              <span className="font-mono text-2xl tracking-widest">{room.joinCode}</span>
              <Button variant="outline" size="sm" onClick={() => navigator.clipboard.writeText(room.joinCode)}>
                Sao chép mã
              </Button>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground break-all">{joinLink}</span>
              <Button
                variant="outline"
                size="sm"
                className="shrink-0"
                onClick={() => navigator.clipboard.writeText(joinLink)}
              >
                Sao chép link
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Buổi học: bắt đầu / tham gia / kết thúc / lịch sử */}
        <MeetingSection roomId={roomId} token={token} isHost={isHost} />

        {/* Thành viên */}
        <Card>
          <CardHeader>
            <CardTitle>Thành viên ({members.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* HOST thêm người đã có tài khoản bằng email */}
            {isHost && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  run(() => addMember(token, roomId, newEmail), () => {
                    setNewEmail('');
                    reload();
                  });
                }}
                className="flex gap-3"
              >
                <Input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="Email người muốn thêm"
                  required
                />
                <Button type="submit">Thêm</Button>
              </form>
            )}
            <ul className="divide-y">
              {members.map((m) => (
                <li key={m.userId} className="flex justify-between items-center py-3">
                  <div>
                    <p className="font-semibold">{m.displayName}</p>
                    <p className="text-sm text-muted-foreground">
                      Vào phòng {new Date(m.joinedAt).toLocaleDateString('vi-VN')}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {m.role === 'HOST' && <Badge variant="secondary">HOST</Badge>}
                    {/* Phòng chỉ có 1 HOST là mình → HOST thấy nút kick ở mọi MEMBER */}
                    {isHost && m.role === 'MEMBER' && (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() =>
                          confirm(`Mời ${m.displayName} ra khỏi phòng?`) &&
                          run(() => kickMember(token, roomId, m.userId), reload)
                        }
                      >
                        Mời ra
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* Rời / giải tán */}
        <div className="flex justify-end">
          {isHost ? (
            <Button
              variant="destructive"
              onClick={() =>
                confirm('Giải tán phòng? Không ai vào lại được phòng này nữa.') &&
                run(() => dissolveRoom(token, roomId), () => router.push('/rooms'))
              }
            >
              Giải tán phòng
            </Button>
          ) : (
            <Button
              variant="destructive"
              onClick={() =>
                confirm('Rời khỏi phòng này?') && run(() => leaveRoom(token, roomId), () => router.push('/rooms'))
              }
            >
              Rời phòng
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
