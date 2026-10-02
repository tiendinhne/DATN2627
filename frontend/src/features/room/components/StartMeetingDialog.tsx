"use client";

import { Video } from "lucide-react";
import { Modal } from "@/components/common/Modal";

interface StartMeetingDialogProps {
  onClose: () => void;
  onStart: () => void;
}

export function StartMeetingDialog({
  onClose,
  onStart,
}: StartMeetingDialogProps) {
  return (
    <Modal
      title="Bắt đầu cuộc họp"
      subtitle="Tạo một phiên học mới bên trong Room."
      onClose={onClose}
    >
      <form
        className="modal-form"
        onSubmit={(event) => {
          event.preventDefault();
          onStart();
        }}
      >
        <label>
          Tên cuộc họp
          <input defaultValue="Họp tiến độ tuần 5" required autoFocus />
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
