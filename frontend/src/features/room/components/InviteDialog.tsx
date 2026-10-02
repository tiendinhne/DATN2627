"use client";

import { useState } from "react";
import { Check, Copy, Link2, Search, Users } from "lucide-react";
import { Modal } from "@/components/common/Modal";

interface InviteDialogProps {
  copied: boolean;
  onCopy: () => void;
  onClose: () => void;
  onInvite: () => void;
}

export function InviteDialog({
  copied,
  onCopy,
  onClose,
  onInvite,
}: InviteDialogProps) {
  const [selected, setSelected] = useState("Nguyễn Hoàng");

  return (
    <Modal
      title="Mời thành viên"
      subtitle="Mời bạn học tham gia không gian này."
      onClose={onClose}
    >
      <div className="invite-dialog">
        <label className="invite-search">
          <Search size={16} />
          <input placeholder="Tìm theo tên hoặc email..." />
        </label>
        <p className="dialog-eyebrow">GỢI Ý</p>
        <button
          className={`invite-result ${selected === "Nguyễn Hoàng" ? "selected" : ""}`}
          onClick={() => setSelected("Nguyễn Hoàng")}
          type="button"
        >
          <span>NH</span>
          <p>
            <strong>Nguyễn Hoàng</strong>
            <small>hoang.nguyen@example.com</small>
          </p>
          <i>{selected === "Nguyễn Hoàng" && <Check size={13} />}</i>
        </button>
        <button
          className={`invite-result ${selected === "Lan Chi" ? "selected" : ""}`}
          onClick={() => setSelected("Lan Chi")}
          type="button"
        >
          <span className="purple">LC</span>
          <p>
            <strong>Lan Chi</strong>
            <small>lanchi@example.com</small>
          </p>
          <i>{selected === "Lan Chi" && <Check size={13} />}</i>
        </button>
        <div className="invite-divider">
          <span>hoặc chia sẻ mã phòng</span>
        </div>
        <div className="invite-code">
          <span>
            <Link2 size={16} />
            <p>
              <small>MÃ PHÒNG</small>
              <strong>STUDY-6X2P</strong>
            </p>
          </span>
          <button onClick={onCopy} type="button">
            {copied ? <Check size={15} /> : <Copy size={15} />}
            {copied ? "Đã sao chép" : "Sao chép"}
          </button>
        </div>
        <div className="dialog-actions">
          <button className="button secondary" onClick={onClose} type="button">
            Hủy
          </button>
          <button className="button primary" onClick={onInvite} type="button">
            <Users size={16} /> Gửi lời mời
          </button>
        </div>
      </div>
    </Modal>
  );
}

export default InviteDialog;
