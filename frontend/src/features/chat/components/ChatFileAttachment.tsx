"use client";

import { useEffect, useState } from "react";
import {
  CheckCircle2,
  Download,
  FileText,
  FolderOpen,
  Image as ImageIcon,
} from "lucide-react";
import Image from "next/image";
import { chatService } from "../services/chat.service";

export function ChatFileAttachment({
  token,
  roomId,
  file,
}: {
  token: string | null;
  roomId: string;
  file: { id: string; originalName: string; mimeType: string; sizeBytes: number };
}) {
  const isImage = file.mimeType.startsWith("image/");
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isImage || !token) return;
    let cancelled = false;
    chatService
      .getDownloadUrl(token, roomId, file.id)
      .then((downloadUrl) => {
        if (!cancelled) setUrl(downloadUrl);
      })
      .catch((downloadError: unknown) => {
        if (!cancelled) {
          setError(
            downloadError instanceof Error
              ? downloadError.message
              : "Không thể tải ảnh."
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, [token, roomId, file.id, isImage]);

  const openFile = async () => {
    if (!token) {
      setError("Phiên đăng nhập không hợp lệ.");
      return;
    }

    const newWindow = window.open("about:blank", "_blank");
    if (!newWindow) {
      setError("Cho phép cửa sổ bật lên để mở hoặc tải file.");
      return;
    }

    try {
      const downloadUrl = await chatService.getDownloadUrl(
        token,
        roomId,
        file.id
      );
      newWindow.location.href = downloadUrl;
      setError("");
    } catch (downloadError: unknown) {
      newWindow.close();
      setError(
        downloadError instanceof Error
          ? downloadError.message
          : "Không thể tải file."
      );
    }
  };

  const downloadFile = async () => {
    if (!token) {
      setError("Phiên đăng nhập không hợp lệ.");
      return;
    }

    try {
      const downloadUrl = await chatService.getDownloadUrl(
        token,
        roomId,
        file.id
      );
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = file.originalName;
      link.rel = "noreferrer";
      document.body.appendChild(link);
      link.click();
      link.remove();
      setError("");
    } catch (downloadError: unknown) {
      setError(
        downloadError instanceof Error
          ? downloadError.message
          : "Không thể tải file."
      );
    }
  };

  return (
    <section className="chat-file-attachment">
      {isImage && url ? (
        <button
          className="chat-image-preview"
          type="button"
          onClick={openFile}
          aria-label={`Mở ảnh ${file.originalName}`}
        >
          <Image
            src={url}
            alt={file.originalName}
            width={240}
            height={180}
            unoptimized
            onError={() => {
              setUrl("");
              setError("Không tải được ảnh xem trước. Hãy bấm để mở lại.");
            }}
          />
        </button>
      ) : (
        <div className="chat-file-card">
          <div className="chat-file-card-icon">
            {isImage ? <ImageIcon size={22} /> : <FileText size={22} />}
          </div>
          <div className="chat-file-card-info">
            <strong title={file.originalName}>{file.originalName}</strong>
            <span>
              {(file.sizeBytes / 1024 / 1024).toFixed(2)} MB
            </span>
          </div>
          <div className="chat-file-card-actions">
            <button
              type="button"
              onClick={downloadFile}
              aria-label={`Tải xuống ${file.originalName}`}
              title="Tải xuống"
            >
              <Download size={17} />
            </button>
          </div>
        </div>
      )}
      {error && <span className="chat-file-error" role="alert">{error}</span>}
    </section>
  );
}
