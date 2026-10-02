"use client";

import {
  ArrowLeft,
  Edit3,
  MoreHorizontal,
  Settings,
  Trash2,
  Users,
  Video,
} from "lucide-react";
import type { RoomRole } from "../types";

interface RoomHeroProps {
  roomName: string;
  description: string;
  role: RoomRole;
  actionsOpen: boolean;
  onRoleChange: (role: RoomRole) => void;
  onToggleActions: () => void;
  onInvite: () => void;
  onStartMeeting: () => void;
  onEdit: () => void;
  onSettings: () => void;
  onDelete: () => void;
  onLeave: () => void;
  onBack: () => void;
}

export function RoomHero({
  roomName,
  description,
  role,
  actionsOpen,
  onRoleChange,
  onToggleActions,
  onInvite,
  onStartMeeting,
  onEdit,
  onSettings,
  onDelete,
  onLeave,
  onBack,
}: RoomHeroProps) {
  return (
    <>
      <button className="back-link" onClick={onBack} type="button">
        <ArrowLeft size={16} /> Quay lại tổng quan
      </button>

      <section className="room-hero">
        <div className="room-symbol">SE</div>
        <div className="min-w-0">
          <div className="room-role-line">
            <p className="eyebrow">
              PHÒNG HỌC · {role === "owner" ? "BẠN LÀ CHỦ PHÒNG" : "BẠN LÀ THÀNH VIÊN"}
            </p>
            <label className="role-preview">
              Xem quyền
              <select
                value={role}
                onChange={(event) => onRoleChange(event.target.value as RoomRole)}
              >
                <option value="owner">Owner</option>
                <option value="member">Member</option>
              </select>
            </label>
          </div>
          <h1>{roomName}</h1>
          <p>{description}</p>
        </div>

        <div className="room-owner-actions">
          {role === "owner" && (
            <button className="button secondary" onClick={onInvite} type="button">
              <Users size={17} /> Mời thành viên
            </button>
          )}
          <button className="button primary" onClick={onStartMeeting} type="button">
            <Video size={17} /> Bắt đầu cuộc họp
          </button>
          <div className="actions-menu-wrap">
            <button
              className="icon-button"
              onClick={onToggleActions}
              aria-label="Thao tác phòng"
              type="button"
            >
              <MoreHorizontal size={19} />
            </button>
            {actionsOpen && (
              <div className="room-actions-menu">
                <p>THAO TÁC PHÒNG</p>
                {role === "owner" ? (
                  <>
                    <button onClick={onEdit} type="button">
                      <Edit3 size={16} /> Chỉnh sửa phòng
                    </button>
                    <button onClick={onInvite} type="button">
                      <Users size={16} /> Mời thành viên
                    </button>
                    <button onClick={onSettings} type="button">
                      <Settings size={16} /> Cài đặt phòng
                    </button>
                    <span />
                    <button className="destructive" onClick={onDelete} type="button">
                      <Trash2 size={16} /> Xóa phòng
                    </button>
                  </>
                ) : (
                  <button className="destructive" onClick={onLeave} type="button">
                    <ArrowLeft size={16} /> Rời khỏi phòng
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </section>
    </>
  );
}

export default RoomHero;
