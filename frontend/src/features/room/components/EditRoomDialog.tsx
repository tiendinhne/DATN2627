"use client";

import { useState } from "react";
import { Modal } from "@/components/common/Modal";

interface EditRoomDialogProps {
  roomName: string;
  description: string;
  onClose: () => void;
  onSave: (name: string, description: string) => void;
}

export function EditRoomDialog({
  roomName,
  description,
  onClose,
  onSave,
}: EditRoomDialogProps) {
  const [name, setName] = useState(roomName);
  const [details, setDetails] = useState(description);

  return (
    <Modal
      title="Chỉnh sửa phòng"
      subtitle="Cập nhật thông tin hiển thị với các thành viên."
      onClose={onClose}
    >
      <form
        className="modal-form"
        onSubmit={(event) => {
          event.preventDefault();
          onSave(name, details);
        }}
      >
        <label>
          Tên phòng
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            autoFocus
          />
        </label>
        <label>
          Mô tả
          <textarea
            value={details}
            onChange={(event) => setDetails(event.target.value)}
            required
          />
        </label>
        <div className="dialog-actions">
          <button
            type="button"
            className="button secondary"
            onClick={onClose}
          >
            Hủy
          </button>
          <button className="button primary" type="submit">
            Lưu thay đổi
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default EditRoomDialog;
