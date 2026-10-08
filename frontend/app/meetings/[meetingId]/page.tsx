'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { LiveKitRoom } from '@livekit/components-react';
import { DisconnectReason, MediaDeviceFailure, VideoPresets, type RoomOptions } from 'livekit-client';
import '@livekit/components-styles';
import { useAuth } from '@/context/auth.context';
import { useProtectedRoute } from '@/hooks/useProtectedRoute';
import { endMeeting, joinMeeting } from '@/services/meeting.service';
import type { JoinMeetingResponse } from '@/types/meeting';
import { MeetingStage } from '@/features/meetings/meeting-stage';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

// Hằng số cấp module (config bất biến) → prop `options` không đổi giữa các lần render (spec §11.3, §11.4)
const ROOM_OPTIONS: RoomOptions = {
  adaptiveStream: true, // nhận đúng layer theo kích thước ô, dừng video ô không hiển thị
  dynacast: true, // ngừng gửi layer không ai xem
  videoCaptureDefaults: { resolution: VideoPresets.h360.resolution }, // mặc định h720; mục tiêu webrtc.md §6 là 360p
};

// Thông báo khi bị ngắt — lý do khác → "Mất kết nối" + nút Vào lại (spec §11.3)
const DISCONNECT_MESSAGE: Partial<Record<DisconnectReason, string>> = {
  [DisconnectReason.ROOM_DELETED]: 'Buổi học đã kết thúc',
  [DisconnectReason.PARTICIPANT_REMOVED]: 'Bạn đã bị mời ra khỏi buổi học',
  [DisconnectReason.DUPLICATE_IDENTITY]: 'Bạn đã vào buổi học từ tab khác',
};

const DEVICE_MESSAGE: Record<MediaDeviceFailure, string> = {
  [MediaDeviceFailure.PermissionDenied]: 'trình duyệt chưa được cấp quyền',
  [MediaDeviceFailure.NotFound]: 'không tìm thấy thiết bị',
  [MediaDeviceFailure.DeviceInUse]: 'thiết bị đang được ứng dụng khác dùng',
  [MediaDeviceFailure.Other]: 'lỗi không xác định',
};

// Khung giữa màn hình cho các trạng thái chờ / lỗi / đã kết thúc
function Screen({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">{children}</div>;
}

export default function MeetingPage() {
  const { meetingId } = useParams<{ meetingId: string }>();
  const { token } = useAuth();
  const { isLoading } = useProtectedRoute();
  const router = useRouter();

  const [join, setJoin] = useState<JoinMeetingResponse | null>(null);
  const [joinError, setJoinError] = useState('');
  // Đã bị ngắt: thông báo + có cho "Vào lại" không
  const [ended, setEnded] = useState<{ message: string; canRetry: boolean } | null>(null);
  const [deviceWarning, setDeviceWarning] = useState('');
  const [actionError, setActionError] = useState('');
  // Tăng lên để gọi lại API vào meeting (nút "Vào lại")
  const [attempt, setAttempt] = useState(0);
  // Cờ "đã kết nối" để trong ref, không trong state → onError có deps [] (spec §11.4)
  const connectedRef = useRef(false);

  // Cờ huỷ: Strict Mode chạy effect 2 lần → API bị gọi 2 lần nhưng chỉ 1 token tới <LiveKitRoom> (spec §11.4)
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    joinMeeting(token, meetingId)
      .then((res) => {
        if (!cancelled) setJoin(res);
      })
      .catch((err: Error) => {
        if (!cancelled) setJoinError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [token, meetingId, attempt]);

  const roomId = join?.meeting.roomId;

  // Mọi callback truyền cho <LiveKitRoom> bọc useCallback với deps không đổi: effect kết nối của nó
  // có onError trong deps và gọi lại room.connect mỗi khi deps đổi — kể cả lúc đang Reconnecting (spec §11.4)
  const onConnected = useCallback(() => {
    connectedRef.current = true;
  }, []);

  const onDisconnected = useCallback(
    (reason?: DisconnectReason) => {
      // Tự bấm Rời ở thanh điều khiển → về trang phòng
      if (reason === DisconnectReason.CLIENT_INITIATED) {
        router.push(roomId ? `/rooms/${roomId}` : '/rooms');
        return;
      }
      const message = reason !== undefined ? DISCONNECT_MESSAGE[reason] : undefined;
      setEnded(message ? { message, canRetry: false } : { message: 'Mất kết nối tới buổi học', canRetry: true });
    },
    [router, roomId],
  );

  // Chỉ chặn khi CHƯA kết nối được (token sai, room không tồn tại…); sau đó lỗi thiết bị do banner lo
  const onError = useCallback((err: Error) => {
    // Lỗi bật cam / mic (getUserMedia → DOMException: NotAllowedError, NotFoundError…) cũng tới đây:
    // useLiveKitRoom bật thiết bị ngay khi signal xong — TRƯỚC Connected — và báo lỗi qua cả
    // onMediaDeviceFailure lẫn onError → bỏ qua, banner lo (spec §11.5)
    if (err instanceof DOMException) return;
    if (!connectedRef.current) {
      setEnded({ message: `Không kết nối được buổi học: ${err.message}`, canRetry: true });
    }
  }, []);

  // Lỗi camera / micro không chặn cuộc gọi — vẫn nghe và xem được mọi người (spec §11.5)
  const onMediaDeviceFailure = useCallback((failure?: MediaDeviceFailure, kind?: MediaDeviceKind) => {
    const device = kind === 'audioinput' ? 'micro' : 'camera';
    setDeviceWarning(
      `Không bật được ${device}: ${DEVICE_MESSAGE[failure ?? MediaDeviceFailure.Other]}. ` +
        'Bạn vẫn nghe và xem được mọi người; có thể bật lại ở thanh điều khiển.',
    );
  }, []);

  const retry = () => {
    connectedRef.current = false;
    setJoin(null);
    setJoinError('');
    setEnded(null);
    setAttempt((a) => a + 1);
  };

  // HOST kết thúc cho mọi người → LiveKit ngắt tất cả với ROOM_DELETED → màn hình "Buổi học đã kết thúc"
  const endForAll = async () => {
    if (!token || !confirm('Kết thúc buổi học cho mọi người?')) return;
    setActionError('');
    try {
      await endMeeting(token, meetingId);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Có lỗi xảy ra');
    }
  };

  const backHref = roomId ? `/rooms/${roomId}` : '/rooms';

  if (isLoading || !token) {
    return (
      <Screen>
        <p className="text-lg text-muted-foreground">Đang tải...</p>
      </Screen>
    );
  }

  if (joinError) {
    return (
      <Screen>
        <Alert variant="destructive" className="max-w-sm">
          <AlertDescription>{joinError}</AlertDescription>
        </Alert>
        <Button asChild variant="link">
          <Link href="/rooms">← Về danh sách phòng</Link>
        </Button>
      </Screen>
    );
  }

  if (ended) {
    return (
      <Screen>
        <p className="text-lg font-semibold">{ended.message}</p>
        {ended.canRetry && <Button onClick={retry}>Vào lại</Button>}
        <Button asChild variant="link">
          <Link href={backHref}>← Về phòng</Link>
        </Button>
      </Screen>
    );
  }

  if (!join) {
    return (
      <Screen>
        <p className="text-lg text-muted-foreground">Đang vào buổi học...</p>
      </Screen>
    );
  }

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center justify-between gap-3 px-4 py-2">
        <h1 className="font-semibold">{join.meeting.title}</h1>
        {/* Chỉ ẩn/hiện — backend kiểm quyền HOST */}
        {join.myRole === 'HOST' && (
          <Button variant="destructive" size="sm" onClick={endForAll}>
            Kết thúc buổi học
          </Button>
        )}
      </header>
      {(deviceWarning || actionError) && (
        <Alert variant={actionError ? 'destructive' : 'default'} className="mx-4 w-auto">
          <AlertDescription>{actionError || deviceWarning}</AlertDescription>
        </Alert>
      )}
      {/* Chỉ render khi đã có token → token / serverUrl đặt một lần, không đổi.
          data-lk-theme đặt ở đây, không ở div ngoài: theme đổi chữ thành màu trắng → tên buổi học ở header sẽ trắng trên nền trắng */}
      <LiveKitRoom
        data-lk-theme="default"
        serverUrl={join.livekitUrl}
        token={join.token}
        connect
        audio
        video
        options={ROOM_OPTIONS}
        onConnected={onConnected}
        onDisconnected={onDisconnected}
        onError={onError}
        onMediaDeviceFailure={onMediaDeviceFailure}
        className="min-h-0 flex-1"
      >
        <MeetingStage />
      </LiveKitRoom>
    </div>
  );
}
