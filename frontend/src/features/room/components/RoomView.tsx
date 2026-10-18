"use client";

import { useEffect, useState } from "react";
import { Check, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth.context";
import { RoomChat } from "@/features/chat";
import {
  addMember,
  dissolveRoom,
  getRoom,
  kickMember,
  leaveRoom,
  listMembers,
  updateRoom,
} from "@/services/room.service";
import { endMeeting, listMeetings, startMeeting } from "@/services/meeting.service";
import type { Meeting as BackendMeeting, Room as BackendRoom } from "@/types/backend";
import type { Meeting } from "@/types";
import type { RoomDialogType, RoomMember, RoomRole } from "../types";
import { mapBackendMember } from "../services/room.service";
import { mapBackendMeeting } from "@/features/meeting/services/meeting.service";
import { ConfirmDialog } from "./ConfirmDialog";
import { EditRoomDialog } from "./EditRoomDialog";
import { InviteDialog } from "./InviteDialog";
import { MeetingsTab } from "./MeetingsTab";
import { MembersTab } from "./MembersTab";
import { RoomHero } from "./RoomHero";
import { RoomOverviewTab } from "./RoomOverviewTab";
import { RoomSettingsDialog } from "./RoomSettingsDialog";
import { StartMeetingDialog } from "./StartMeetingDialog";

const tabs = ["Tổng quan", "Trò chuyện", "Cuộc họp", "Thành viên"];

interface RoomViewProps {
  roomId?: string;
  onNavigate?: (page: string) => void;
}

export function RoomView({
  roomId = "software-engineering",
  onNavigate,
}: RoomViewProps) {
  const router = useRouter();
  const { token, isLoading: isAuthLoading } = useAuth();

  const [tab, setTab] = useState("Tổng quan");
  const [backendRoom, setBackendRoom] = useState<BackendRoom | null>(null);
  const [roomName, setRoomName] = useState("Software Engineering");
  const [description, setDescription] = useState(
    "Không gian làm việc cho đồ án tốt nghiệp · Nhóm 05"
  );
  const [role, setRole] = useState<RoomRole>("owner");
  const [joinCode, setJoinCode] = useState("STUDY-6X2P");
  const [ownerName, setOwnerName] = useState("Chủ phòng");
  const [memberCount, setMemberCount] = useState(1);
  const [members, setMembers] = useState<RoomMember[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [activeBackendMeeting, setActiveBackendMeeting] = useState<BackendMeeting | null>(null);

  const [actionsOpen, setActionsOpen] = useState(false);
  const [dialog, setDialog] = useState<RoomDialogType>(null);
  const [removeTarget, setRemoveTarget] = useState<{ name: string; userId?: string }>({ name: "" });
  const [removedMembers, setRemovedMembers] = useState<string[]>([]);
  const [toast, setToast] = useState("");
  const [copied, setCopied] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const reload = () => setReloadKey((k) => k + 1);

  const notify = (message: string) => {
    setDialog(null);
    setActionsOpen(false);
    setToast(message);
    window.setTimeout(() => setToast(""), 2800);
  };

  const handleBackToDashboard = () => {
    if (onNavigate) {
      onNavigate("dashboard");
    } else {
      router.push("/dashboard");
    }
  };

  // Fetch dữ liệu phòng, thành viên, và cuộc họp từ backend
  useEffect(() => {
    if (!token || !roomId) return;

    // Lấy thông tin phòng
    getRoom(token, roomId)
      .then((roomData) => {
        setBackendRoom(roomData);
        setRoomName(roomData.name);
        setDescription(roomData.description || "");
        setJoinCode(roomData.joinCode);
        setRole(roomData.myRole === "HOST" ? "owner" : "member");
        setMemberCount(roomData.memberCount || 1);
      })
      .catch((err) => {
        console.warn("Không tải được chi tiết phòng từ backend:", err.message);
      });

    // Lấy thành viên
    listMembers(token, roomId)
      .then((memberData) => {
        const mapped = memberData.map(mapBackendMember);
        setMembers(mapped);
        const host = mapped.find((m) => m.role === "Chủ phòng");
        if (host) setOwnerName(host.name);
      })
      .catch((err) => {
        console.warn("Không tải được thành viên từ backend:", err.message);
      });

    // Lấy cuộc họp
    listMeetings(token, roomId)
      .then((meetingList) => {
        const mapped = meetingList.items.map(mapBackendMeeting);
        setMeetings(mapped);
        const active = meetingList.items.find((m) => m.status === "ACTIVE");
        setActiveBackendMeeting(active || null);
      })
      .catch((err) => {
        console.warn("Không tải được cuộc họp từ backend:", err.message);
      });
  }, [token, roomId, reloadKey]);

  // Bắt đầu cuộc họp mới
  const handleStartMeeting = async (titleInput?: string) => {
    setDialog(null);
    const meetingTitle = titleInput || `Họp tiến độ ${new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}`;

    if (token && roomId && backendRoom) {
      try {
        const newMeeting = await startMeeting(token, roomId, meetingTitle);
        router.push(`/meetings/${newMeeting.id}?roomId=${encodeURIComponent(roomId)}`);
        return;
      } catch (err) {
        notify(err instanceof Error ? err.message : "Không thể bắt đầu cuộc họp");
        reload();
        return;
      }
    }

    if (onNavigate) {
      onNavigate("meeting");
    } else {
      router.push("/meetings/sprint-review-05");
    }
  };

  // Tham gia cuộc họp đã có
  const handleJoinExistingMeeting = (meetingId?: string) => {
    if (meetingId) {
      router.push(`/meetings/${meetingId}?roomId=${encodeURIComponent(roomId)}`);
    } else if (activeBackendMeeting) {
      router.push(`/meetings/${activeBackendMeeting.id}?roomId=${encodeURIComponent(roomId)}`);
    } else {
      setDialog("start");
    }
  };

  // Cập nhật thông tin phòng
  const handleSaveRoom = async (name: string, details: string) => {
    if (token && roomId && backendRoom) {
      try {
        await updateRoom(token, roomId, { name, description: details });
        setRoomName(name);
        setDescription(details);
        notify("Phòng đã được cập nhật thành công.");
        reload();
        return;
      } catch (err) {
        notify(err instanceof Error ? err.message : "Lỗi khi lưu thông tin phòng");
        return;
      }
    }
    setRoomName(name);
    setDescription(details);
    notify("Phòng đã được cập nhật thành công.");
  };

  // Mời thành viên bằng email
  const handleInviteMember = async (email?: string) => {
    if (token && roomId && email) {
      try {
        await addMember(token, roomId, email);
        notify(`Đã thêm thành viên ${email} vào phòng.`);
        reload();
        return;
      } catch (err) {
        notify(err instanceof Error ? err.message : "Không thể thêm thành viên");
        return;
      }
    }
    notify("Đã gửi lời mời thành công.");
  };

  // Kick thành viên
  const handleRemoveMember = async () => {
    const { name, userId } = removeTarget;
    if (token && roomId && userId) {
      try {
        await kickMember(token, roomId, userId);
        setRemovedMembers((current) => [...current, name, userId]);
        notify(`${name} đã được xóa khỏi phòng.`);
        reload();
        return;
      } catch (err) {
        notify(err instanceof Error ? err.message : "Lỗi khi xóa thành viên");
        return;
      }
    }
    setRemovedMembers((current) => [...current, name]);
    notify(`${name} đã được xóa khỏi phòng.`);
  };

  // Kết thúc cuộc họp
  const handleEndMeeting = async () => {
    if (token && activeBackendMeeting) {
      try {
        await endMeeting(token, activeBackendMeeting.id);
        notify("Cuộc họp đã kết thúc. Bảng vẽ đã được lưu.");
        setActiveBackendMeeting(null);
        reload();
        return;
      } catch (err) {
        notify(err instanceof Error ? err.message : "Lỗi khi kết thúc cuộc họp");
        return;
      }
    }
    notify("Cuộc họp đã kết thúc. Bảng vẽ đã được lưu.");
  };

  // Xóa / giải tán phòng
  const handleDeleteRoom = async () => {
    if (token && roomId && backendRoom) {
      try {
        await dissolveRoom(token, roomId);
        handleBackToDashboard();
        return;
      } catch (err) {
        notify(err instanceof Error ? err.message : "Lỗi khi giải tán phòng");
        return;
      }
    }
    handleBackToDashboard();
  };

  // Rời phòng
  const handleLeaveRoom = async () => {
    if (token && roomId && backendRoom) {
      try {
        await leaveRoom(token, roomId);
        handleBackToDashboard();
        return;
      } catch (err) {
        notify(err instanceof Error ? err.message : "Lỗi khi rời phòng");
        return;
      }
    }
    handleBackToDashboard();
  };

  return (
    <div className="content-wrap room-page">
      <RoomHero
        roomName={roomName}
        description={description}
        role={role}
        actionsOpen={actionsOpen}
        onToggleActions={() => setActionsOpen(!actionsOpen)}
        onInvite={() => setDialog("invite")}
        onStartMeeting={() => setDialog("start")}
        onEdit={() => setDialog("edit")}
        onSettings={() => setDialog("settings")}
        onDelete={() => setDialog("delete")}
        onLeave={() => setDialog("leave")}
        onBack={handleBackToDashboard}
      />

      <nav className="tabs">
        {tabs.map((item) => (
          <button
            key={item}
            className={tab === item ? "active" : ""}
            onClick={() => setTab(item)}
            type="button"
          >
            {item}
          </button>
        ))}
      </nav>

      {tab === "Tổng quan" && (
        <RoomOverviewTab
          role={role}
          roomInfo={{
            joinCode,
            ownerName,
            memberCount,
            createdAt: backendRoom ? new Date(backendRoom.createdAt).toLocaleDateString("vi-VN") : "02/06/2026",
          }}
          activeMeeting={
            activeBackendMeeting
              ? {
                  id: activeBackendMeeting.id,
                  title: activeBackendMeeting.title,
                  participantCount: activeBackendMeeting.totalParticipants,
                }
              : null
          }
          recentMeetings={meetings}
          onJoinMeeting={handleJoinExistingMeeting}
          onEndMeeting={() => setDialog("end")}
        />
      )}

      {tab === "Trò chuyện" && <RoomChat />}

      {tab === "Cuộc họp" && (
        <MeetingsTab
          meetings={meetings}
          onMeeting={handleJoinExistingMeeting}
          onStartMeeting={() => setDialog("start")}
          isHost={role === "owner"}
          onEndMeeting={() => setDialog("end")}
        />
      )}

      {tab === "Thành viên" && (
        <MembersTab
          members={members}
          removedMembers={removedMembers}
          canManage={role === "owner"}
          onInvite={() => setDialog("invite")}
          onRemove={(name, userId) => {
            setRemoveTarget({ name, userId });
            setDialog("remove");
          }}
        />
      )}

      {dialog === "edit" && (
        <EditRoomDialog
          roomName={roomName}
          description={description}
          onClose={() => setDialog(null)}
          onSave={handleSaveRoom}
        />
      )}

      {dialog === "settings" && (
        <RoomSettingsDialog
          roomName={roomName}
          description={description}
          onClose={() => setDialog(null)}
          onSave={handleSaveRoom}
          onDelete={() => setDialog("delete")}
        />
      )}

      {dialog === "invite" && (
        <InviteDialog
          copied={copied}
          joinCode={joinCode}
          roomId={roomId}
          onCopy={() => {
            navigator.clipboard?.writeText(joinCode);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1800);
          }}
          onClose={() => setDialog(null)}
          onInvite={handleInviteMember}
        />
      )}

      {dialog === "start" && (
        <StartMeetingDialog
          onClose={() => setDialog(null)}
          onStart={handleStartMeeting}
        />
      )}

      {dialog === "end" && (
        <ConfirmDialog
          title="Kết thúc cuộc họp?"
          description={`Bạn có chắc muốn kết thúc "${activeBackendMeeting?.title || "Cuộc họp"}" cho tất cả người tham gia?`}
          notes={[
            "Bảng vẽ sẽ được lưu tự động.",
            "Lịch sử chat vẫn còn trong Room Chat.",
            "Room tiếp tục hoạt động bình thường.",
          ]}
          action="Kết thúc cuộc họp"
          onClose={() => setDialog(null)}
          onConfirm={handleEndMeeting}
        />
      )}

      {dialog === "remove" && (
        <ConfirmDialog
          title="Xóa thành viên?"
          description={`Bạn có chắc muốn xóa ${removeTarget.name} khỏi phòng này?`}
          notes={[
            "Thành viên sẽ không thể truy cập phòng, cuộc họp và tài nguyên.",
            "Bạn có thể mời lại họ sau.",
          ]}
          action="Xóa thành viên"
          onClose={() => setDialog(null)}
          onConfirm={handleRemoveMember}
        />
      )}

      {dialog === "delete" && (
        <ConfirmDialog
          title="Xóa phòng vĩnh viễn?"
          description={`Bạn đang xóa "${roomName}". Hành động này không thể hoàn tác.`}
          notes={[
            "Toàn bộ thành viên sẽ mất quyền truy cập.",
            "Lịch sử chat, cuộc họp và bảng vẽ sẽ bị xóa.",
            "Đây không phải là kết thúc một cuộc họp.",
          ]}
          action="Xóa phòng"
          onClose={() => setDialog(null)}
          onConfirm={handleDeleteRoom}
        />
      )}

      {dialog === "leave" && (
        <ConfirmDialog
          title="Rời khỏi phòng?"
          description={`Bạn có chắc muốn rời "${roomName}"?`}
          notes={[
            "Bạn sẽ không còn truy cập được cuộc họp, chat và tài nguyên.",
            "Chủ phòng có thể mời bạn tham gia lại sau.",
          ]}
          action="Rời khỏi phòng"
          onClose={() => setDialog(null)}
          onConfirm={handleLeaveRoom}
        />
      )}

      {toast && (
        <div className="room-toast">
          <span>
            <Check size={16} />
          </span>
          {toast}
          <button onClick={() => setToast("")} type="button" aria-label="Đóng">
            <X size={15} />
          </button>
        </div>
      )}
    </div>
  );
}

export default RoomView;
