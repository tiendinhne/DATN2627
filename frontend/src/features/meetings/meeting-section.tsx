'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { endMeeting, listMeetings, startMeeting } from '@/services/meeting.service';
import type { EndReason, Meeting } from '@/types/meeting';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

const END_REASON_LABEL: Record<EndReason, string> = {
  HOST_ENDED: 'Host kết thúc',
  AUTO_EMPTY: 'Tự kết thúc',
  ROOM_DISSOLVED: 'Phòng giải tán',
};

// "Buổi học 05/10 14:30" theo giờ trình duyệt — backend không xử lý múi giờ (spec §5.2)
function defaultTitle() {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `Buổi học ${pad(now.getDate())}/${pad(now.getMonth() + 1)} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  return minutes >= 60 ? `${Math.floor(minutes / 60)} giờ ${minutes % 60} phút` : `${minutes} phút`;
}

// Khu "Buổi học" ở trang phòng. Nút của HOST chỉ ẩn/hiện — backend mới kiểm quyền.
// Chưa tự cập nhật khi buổi học bắt đầu / kết thúc (chờ bước Realtime gateway) — tải lại trang để thấy.
export function MeetingSection({ roomId, token, isHost }: { roomId: string; token: string; isHost: boolean }) {
  const router = useRouter();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [error, setError] = useState('');
  // Tên riêng, không bắt buộc. Bỏ trống → tính tên theo giờ LÚC BẤM Bắt đầu (không phải lúc mở trang)
  const [title, setTitle] = useState('');
  // Tăng lên để tải lại danh sách sau mỗi thao tác
  const [reloadKey, setReloadKey] = useState(0);
  const reload = () => setReloadKey((k) => k + 1);

  useEffect(() => {
    listMeetings(token, roomId)
      .then((res) => setMeetings(res.items))
      .catch((err: Error) => setError(err.message));
  }, [token, roomId, reloadKey]);

  // Mới nhất đứng đầu → buổi đang diễn ra (nếu có) là items[0]
  const active = meetings[0]?.status === 'ACTIVE' ? meetings[0] : null;
  const history = active ? meetings.slice(1) : meetings;

  const start = async () => {
    setError('');
    try {
      const meeting = await startMeeting(token, roomId, title.trim() || defaultTitle());
      router.push(`/meetings/${meeting.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Có lỗi xảy ra');
      // 409: đang có buổi học diễn ra → tải lại để thấy và vào
      reload();
    }
  };

  const end = async (meetingId: string) => {
    if (!confirm('Kết thúc buổi học? Mọi người trong cuộc gọi sẽ bị ngắt.')) return;
    setError('');
    try {
      await endMeeting(token, meetingId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Có lỗi xảy ra');
    }
    reload();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Buổi học</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {active ? (
          <div className="flex items-center justify-between gap-3 rounded-md border p-3">
            <div>
              <p className="font-semibold">{active.title}</p>
              <p className="text-sm text-muted-foreground">
                Đang diễn ra từ {new Date(active.startedAt).toLocaleTimeString('vi-VN')}
              </p>
            </div>
            <div className="flex gap-2">
              <Button asChild>
                <Link href={`/meetings/${active.id}`}>Tham gia</Link>
              </Button>
              {/* Kết thúc dùng được cả khi buổi học bị kẹt (API idempotent) */}
              {isHost && (
                <Button variant="destructive" onClick={() => end(active.id)}>
                  Kết thúc
                </Button>
              )}
            </div>
          </div>
        ) : isHost ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              start();
            }}
            className="flex gap-3"
          >
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Tên buổi học (bỏ trống: Buổi học + ngày giờ bắt đầu)"
              maxLength={100}
            />
            <Button type="submit">Bắt đầu</Button>
          </form>
        ) : (
          <p className="text-sm text-muted-foreground">Chưa có buổi học nào đang diễn ra.</p>
        )}

        {history.length > 0 && (
          <ul className="divide-y">
            {history.map((m) => (
              <li key={m.id} className="flex justify-between items-center py-2 gap-3">
                <div>
                  <p className="font-medium">{m.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {new Date(m.startedAt).toLocaleString('vi-VN')} · {formatDuration(m.durationSeconds)} · tối đa{' '}
                    {m.peakParticipants} / tổng {m.totalParticipants} người
                  </p>
                </div>
                {m.endReason && <Badge variant="secondary">{END_REASON_LABEL[m.endReason]}</Badge>}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
