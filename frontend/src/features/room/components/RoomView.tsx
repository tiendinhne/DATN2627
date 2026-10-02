"use client";

import { useState } from "react";
import { Check, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { RoomChat } from "@/features/chat";
import type { RoomDialogType, RoomRole } from "../types";
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

  const [tab, setTab] = useState("Tổng quan");
  const [roomName, setRoomName] = useState("Software Engineering");
  const [description, setDescription] = useState(
    "Không gian làm việc cho đồ án tốt nghiệp · Nhóm 05"
  );
  const [role, setRole] = useState<RoomRole>("owner");
  const [actionsOpen, setActionsOpen] = useState(false);
  const [dialog, setDialog] = useState<RoomDialogType>(null);
  const [removeName, setRemoveName] = useState("");
  const [removedMembers, setRemovedMembers] = useState<string[]>([]);
  const [toast, setToast] = useState("");
  const [copied, setCopied] = useState(false);

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

  const handleStartMeeting = () => {
    setDialog(null);
    if (onNavigate) {
      onNavigate("meeting");
    } else {
      router.push("/meetings/sprint-review-05");
    }
  };

  return (
    <div className="content-wrap room-page">
      <RoomHero
        roomName={roomName}
        description={description}
        role={role}
        actionsOpen={actionsOpen}
        onRoleChange={setRole}
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
          onJoinMeeting={handleStartMeeting}
          onEndMeeting={() => setDialog("end")}
        />
      )}

      {tab === "Trò chuyện" && <RoomChat />}

      {tab === "Cuộc họp" && <MeetingsTab onMeeting={handleStartMeeting} />}

      {tab === "Thành viên" && (
        <MembersTab
          removedMembers={removedMembers}
          canManage={role === "owner"}
          onInvite={() => setDialog("invite")}
          onRemove={(name) => {
            setRemoveName(name);
            setDialog("remove");
          }}
        />
      )}

      {dialog === "edit" && (
        <EditRoomDialog
          roomName={roomName}
          description={description}
          onClose={() => setDialog(null)}
          onSave={(name, details) => {
            setRoomName(name);
            setDescription(details);
            notify("Phòng đã được cập nhật thành công.");
          }}
        />
      )}

      {dialog === "settings" && (
        <RoomSettingsDialog
          roomName={roomName}
          description={description}
          onClose={() => setDialog(null)}
          onSave={(name, details) => {
            setRoomName(name);
            setDescription(details);
            notify("Đã lưu cài đặt phòng.");
          }}
          onDelete={() => setDialog("delete")}
        />
      )}

      {dialog === "invite" && (
        <InviteDialog
          copied={copied}
          onCopy={() => {
            navigator.clipboard?.writeText("STUDY-6X2P");
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1800);
          }}
          onClose={() => setDialog(null)}
          onInvite={() => notify("Đã gửi lời mời thành công.")}
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
          description='Bạn có chắc muốn kết thúc "Họp tiến độ tuần 5" cho tất cả người tham gia?'
          notes={[
            "Bảng vẽ sẽ được lưu tự động.",
            "Lịch sử chat vẫn còn trong Room Chat.",
            "Room tiếp tục hoạt động bình thường.",
          ]}
          action="Kết thúc cuộc họp"
          onClose={() => setDialog(null)}
          onConfirm={() =>
            notify("Cuộc họp đã kết thúc. Bảng vẽ đã được lưu.")
          }
        />
      )}

      {dialog === "remove" && (
        <ConfirmDialog
          title="Xóa thành viên?"
          description={`Bạn có chắc muốn xóa ${removeName} khỏi phòng này?`}
          notes={[
            "Thành viên sẽ không thể truy cập phòng, cuộc họp và tài nguyên.",
            "Bạn có thể mời lại họ sau.",
          ]}
          action="Xóa thành viên"
          onClose={() => setDialog(null)}
          onConfirm={() => {
            setRemovedMembers((current) => [...current, removeName]);
            notify(`${removeName} đã được xóa khỏi phòng.`);
          }}
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
          onConfirm={handleBackToDashboard}
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
          onConfirm={handleBackToDashboard}
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
