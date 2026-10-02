"use client";

import { MessageSquare, PhoneOff, Save } from "lucide-react";
import { Modal } from "@/components/common/Modal";

interface EndMeetingModalProps {
  onClose: () => void;
  onConfirm: () => void;
}

export function EndMeetingModal({ onClose, onConfirm }: EndMeetingModalProps) {
  return (
    <Modal
      title="Kết thúc cuộc họp?"
      subtitle='Cuộc họp "Họp tiến độ tuần 5" sẽ kết thúc với tất cả người tham gia.'
      onClose={onClose}
    >
      <div className="meeting-end-summary">
        <div>
          <Save size={18} />
          <p>
            <strong>Bảng vẽ sẽ được lưu</strong>
            <span>Bạn có thể xem lại trong lịch sử cuộc họp.</span>
          </p>
        </div>
        <div>
          <MessageSquare size={18} />
          <p>
            <strong>Chat không bị xóa</strong>
            <span>Tin nhắn vẫn hiển thị trong Room Chat.</span>
          </p>
        </div>
        <div className="meeting-end-actions">
          <button
            className="button secondary"
            onClick={onClose}
            type="button"
          >
            Tiếp tục cuộc họp
          </button>
          <button
            className="button destructive-button"
            onClick={onConfirm}
            type="button"
          >
            <PhoneOff size={16} /> Kết thúc cuộc họp
          </button>
        </div>
      </div>
    </Modal>
  );
}

export default EndMeetingModal;
