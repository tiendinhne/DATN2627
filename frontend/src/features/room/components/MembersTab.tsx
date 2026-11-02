"use client";

import { useState } from "react";
import { MoreHorizontal, ShieldCheck, Trash2, UserRound, Users } from "lucide-react";
import type { RoomMember } from "../types";

interface MembersTabProps {
  members?: RoomMember[];
  removedMembers: string[];
  canManage: boolean;
  onInvite: () => void;
  onRemove: (name: string, userId?: string) => void;
}

export function MembersTab({
  members,
  removedMembers,
  canManage,
  onInvite,
  onRemove,
}: MembersTabProps) {
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  const sourceMembers = members ?? [];
  const activeMembers = sourceMembers.filter(
    (member) => !removedMembers.includes(member.name) && (!member.userId || !removedMembers.includes(member.userId))
  );

  return (
    <section className="panel-card members-card">
      <div className="section-heading">
        <div>
          <h2>Thành viên phòng</h2>
          <p>
            {activeMembers.length} thành viên
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
          <div className="member-row" key={member.userId || member.email || member.name}>
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
            {/* Chưa biết trạng thái online thì hiện "—", không đoán */}
            <span className={`presence ${member.online ? "online" : ""}`}>
              {member.online === undefined ? "—" : <><i />{member.online ? "Trực tuyến" : "Ngoại tuyến"}</>}
            </span>
            <span className="joined-date">
              {member.joinedDate ? `Tham gia ${member.joinedDate}` : "—"}
            </span>
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
                        onRemove(member.name, member.userId);
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
