"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { FileText, X } from "lucide-react";

export function ChatPendingAttachment({
  file,
  disabled,
  onRemove,
}: {
  file: File;
  disabled: boolean;
  onRemove: () => void;
}) {
  const [previewUrl, setPreviewUrl] = useState("");
  const isImage = file.type.startsWith("image/");

  useEffect(() => {
    if (!isImage) {
      setPreviewUrl("");
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file, isImage]);

  return (
    <div
      className={`chat-pending-file in-input${isImage ? " image" : ""}`}
    >
      {isImage && previewUrl ? (
        <Image
          className="chat-pending-image-preview"
          src={previewUrl}
          alt={`Xem trước ${file.name}`}
          width={72}
          height={72}
          unoptimized
        />
      ) : (
        <FileText size={16} />
      )}
      <span>{file.name}</span>
      <small>{(file.size / 1024 / 1024).toFixed(2)} MB</small>
      <button
        type="button"
        aria-label="Bỏ file đang chọn"
        onClick={onRemove}
        disabled={disabled}
      >
        <X size={15} />
      </button>
    </div>
  );
}
