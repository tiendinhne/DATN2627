"use client";

import { Trash2 } from "lucide-react";
import { Modal } from "@/components/common/Modal";

interface ConfirmDialogProps {
  title: string;
  description: string;
  notes: string[];
  action: string;
  onClose: () => void;
  onConfirm: () => void;
}

export function ConfirmDialog({
  title,
  description,
  notes,
  action,
  onClose,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <Modal title={title} subtitle={description} onClose={onClose}>
      <div className="confirm-content">
        <div className="danger-icon">
          <Trash2 size={21} />
        </div>
        <ul>
          {notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
        <div className="dialog-actions">
          <button className="button secondary" onClick={onClose} type="button">
            Hủy
          </button>
          <button
            className="button destructive-button"
            onClick={onConfirm}
            type="button"
          >
            {action}
          </button>
        </div>
      </div>
    </Modal>
  );
}

export default ConfirmDialog;
