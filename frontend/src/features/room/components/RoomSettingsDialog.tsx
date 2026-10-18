"use client";

import { useState } from "react";
import { Settings, Trash2, Users } from "lucide-react";
import { Modal } from "@/components/common/Modal";

interface RoomSettingsDialogProps {
  roomName: string;
  description: string;
  onClose: () => void;
  onSave: (name: string, description: string) => void;
  onDelete: () => void;
}

export function RoomSettingsDialog({
  roomName,
  description,
  onClose,
  onSave,
  onDelete,
}: RoomSettingsDialogProps) {
  const [name, setName] = useState(roomName);
  const [details, setDetails] = useState(description);

  return (
    <Modal
      title="Cài đặt phòng"
      subtitle="Quản lý thông tin, thành viên và dữ liệu Room."
      onClose={onClose}
    >
      <form
        className="room-settings-form"
        onSubmit={(event) => {
          event.preventDefault();
          onSave(name, details);
        }}
      >
        <section>
          <div className="settings-dialog-title">
            <Settings size={17} />
            <div>
              <strong>Thông tin chung</strong>
              <small>Thông tin hiển thị của phòng</small>
            </div>
          </div>
          <label>
            Tên phòng
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
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
          <button className="button primary" type="submit">
            Lưu thay đổi
          </button>
        </section>

        <section>
          <div className="settings-dialog-title">
            <Users size={17} />
            <div>
              <strong>Thành viên</strong>
              <small>Mời và quản lý quyền truy cập</small>
            </div>
          </div>
          <div className="settings-members-summary">
            <span className="avatar-stack">
              <span>AN</span>
              <span>MA</span>
              <span>QH</span>
            </span>
            <p>
              <strong>5 thành viên</strong>
              <small>3 người đang trực tuyến</small>
            </p>
          </div>
        </section>

        <section className="danger-zone">
          <div className="settings-dialog-title">
            <Trash2 size={17} />
            <div>
              <strong>Vùng nguy hiểm</strong>
              <small>Thao tác này không thể hoàn tác</small>
            </div>
          </div>
          <div>
            <p>
              <strong>Xóa Room này</strong>
              <span>Xóa thành viên, chat, meetings và whiteboards.</span>
            </p>
            <button
              type="button"
              className="button destructive-outline"
              onClick={onDelete}
            >
              Xóa phòng
            </button>
          </div>
        </section>
      </form>
    </Modal>
  );
}

export default RoomSettingsDialog;
