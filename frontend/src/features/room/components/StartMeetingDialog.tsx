"use client";

import { useState } from "react";
import { Video } from "lucide-react";
import { Modal } from "@/components/common/Modal";
import { defaultMeetingTitle } from "@/features/meeting/services/meeting.service";

interface StartMeetingDialogProps {
  onClose: () => void;
  onStart: (title?: string) => void;
}

export function StartMeetingDialog({
  onClose,
  onStart,
}: StartMeetingDialogProps) {
  const [title, setTitle] = useState("");

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const finalTitle = title.trim() || defaultMeetingTitle();
    onStart(finalTitle);
  };

  return (
    <Modal
      title="Bắt đầu cuộc họp"
      subtitle="Tạo một phiên học mới bên trong Room."
      onClose={onClose}
    >
      <form
        className="modal-form"
        onSubmit={handleSubmit}
      >
        <label>
          Tên cuộc họp
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Tên buổi học (bỏ trống: Buổi học + ngày giờ bắt đầu)"
            maxLength={100}
            autoFocus
          />
        </label>
        <div className="meeting-relationship-note">
          <Video size={18} />
          <p>
            <strong>Một bảng vẽ mới sẽ được tạo</strong>
            <span>Chat của phiên học vẫn được lưu trong Room Chat.</span>
          </p>
        </div>
        <div className="dialog-actions">
          <button
            type="button"
            className="button secondary"
            onClick={onClose}
          >
            Hủy
          </button>
          <button className="button primary" type="submit">
            <Video size={16} /> Bắt đầu ngay
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default StartMeetingDialog;
