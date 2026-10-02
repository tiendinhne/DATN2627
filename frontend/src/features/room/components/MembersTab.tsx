"use client";

import { useState } from "react";
import { MoreHorizontal, ShieldCheck, Trash2, UserRound, Users } from "lucide-react";
import type { RoomMember } from "../types";

const defaultMembers: RoomMember[] = [
  { name: "An Nguyễn", email: "an.nguyen@example.com", initials: "AN", role: "Chủ phòng", online: true, color: "#6372e8" },
  { name: "Minh Anh", email: "minhanh@example.com", initials: "MA", role: "Thành viên", online: true, color: "#df7d58" },
  { name: "Quang Huy", email: "quanghuy@example.com", initials: "QH", role: "Thành viên", online: true, color: "#349775" },
  { name: "Thu Hà", email: "thuha@example.com", initials: "TH", role: "Thành viên", online: false, color: "#9b65bd" },
  { name: "Đức Minh", email: "ducminh@example.com", initials: "ĐM", role: "Thành viên", online: false, color: "#4b90bd" },
];

interface MembersTabProps {
  removedMembers: string[];
  canManage: boolean;
  onInvite: () => void;
  onRemove: (name: string) => void;
}

export function MembersTab({
  removedMembers,
  canManage,
  onInvite,
  onRemove,
}: MembersTabProps) {
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  const activeMembers = defaultMembers.filter(
    (member) => !removedMembers.includes(member.name)
  );

  return (
    <section className="panel-card members-card">
      <div className="section-heading">
        <div>
          <h2>Thành viên phòng</h2>
          <p>
            {activeMembers.length} thành viên · 3 đang trực tuyến
          </p>
        </div>
        {canManage && (
          <button className="button primary" onClick={onInvite} type="button">
            <Users size={16} /> Mời thành viên
          </button>
        )}
      </div>
      <div className="member-list">
        {activeMembers.map((member) => (
          <div className="member-row" key={member.email}>
            <div
              className="member-avatar"
              style={{ background: member.color }}
            >
              {member.initials}
              <i className={member.online ? "online" : ""} />
            </div>
            <div className="member-info">
              <strong>{member.name}</strong>
              <span>{member.email}</span>
            </div>
            <span
              className={
                member.role === "Chủ phòng" ? "owner-badge" : "member-role"
              }
            >
              {member.role === "Chủ phòng" && <ShieldCheck size={13} />}
              {member.role}
            </span>
            <span className={`presence ${member.online ? "online" : ""}`}>
              <i />
              {member.online ? "Trực tuyến" : "Ngoại tuyến"}
            </span>
            <span className="joined-date">Tham gia 02/06/2026</span>
            {canManage && member.role !== "Chủ phòng" ? (
              <div className="member-menu-wrap">
                <button
                  className="icon-button remove-member"
                  onClick={() =>
                    setOpenMenu(openMenu === member.name ? null : member.name)
                  }
                  aria-label={`Thao tác với ${member.name}`}
                  type="button"
                >
                  <MoreHorizontal size={16} />
                </button>
                {openMenu === member.name && (
                  <div className="member-actions-popover">
                    <p>THAO TÁC THÀNH VIÊN</p>
                    <button onClick={() => setOpenMenu(null)} type="button">
                      <UserRound size={14} /> Xem hồ sơ
                    </button>
                    <button
                      className="destructive"
                      onClick={() => {
                        setOpenMenu(null);
                        onRemove(member.name);
                      }}
                      type="button"
                    >
                      <Trash2 size={14} /> Xóa khỏi phòng
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <span className="member-action-space" />
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

export default MembersTab;
