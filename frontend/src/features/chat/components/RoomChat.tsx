"use client";

import { Fragment, useEffect, useRef, useState, type FormEvent } from "react";
import { Paperclip, Search, Send, Video } from "lucide-react";
import { useRoomChat } from "../hooks/useRoomChat";
import {
  CHAT_FILE_ACCEPT,
  validateChatFile,
} from "../services/chat.service";
import { ChatFileAttachment } from "./ChatFileAttachment";
import { ChatPendingAttachment } from "./ChatPendingAttachment";

interface RoomChatProps {
  roomId: string;
  token: string | null;
  currentUserId?: string;
}

export function RoomChat({ roomId, token, currentUserId }: RoomChatProps) {
  const [inputText, setInputText] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messageListRef = useRef<HTMLDivElement>(null);
  const {
    messages,
    error,
    connectionState,
    isUploading,
    sendMessage,
    sendFile,
  } = useRoomChat({
    roomId,
    token,
    currentUserId,
  });

  useEffect(() => {
    const messageList = messageListRef.current;
    if (messageList) messageList.scrollTop = messageList.scrollHeight;
  }, [messages]);

  const handleSendMessage = async (event: FormEvent) => {
    event.preventDefault();
    const text = inputText.trim();
    if (selectedFile) {
      if (await sendFile(selectedFile, text)) {
        setSelectedFile(null);
        setInputText("");
        setFileError("");
      }
      return;
    }
    if (text && sendMessage(text)) setInputText("");
  };

  return (
    <section className="panel-card room-chat-card">
      <div className="room-chat-header">
        <div>
          <h2>Trò chuyện trong phòng</h2>
          <p>
            {connectionState === "connected"
              ? "Đã kết nối · Tin nhắn được lưu lại sau cuộc họp"
              : connectionState === "connecting"
                ? "Đang kết nối..."
                : "Chưa kết nối chat"}
          </p>
        </div>
        <button className="icon-button" aria-label="Tìm tin nhắn" type="button">
          <Search size={17} />
        </button>
      </div>
      {(error || fileError) && (
        <p className="px-4 text-sm text-red-400" role="alert">
          {fileError || error}
        </p>
      )}
      <div className="room-chat-list" ref={messageListRef}>
        {messages.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-400">
            Chưa có tin nhắn trong phòng.
          </p>
        ) : (
          messages.map((message, index) => {
            const previousMessage = messages[index - 1];
            const timeSincePrevious = previousMessage
              ? new Date(message.createdAt).getTime() -
                new Date(previousMessage.createdAt).getTime()
              : Infinity;
            const startsNewDay =
              !previousMessage ||
              new Date(message.createdAt).toDateString() !==
                new Date(previousMessage.createdAt).toDateString();
            const isFollowUp =
              previousMessage?.senderId === message.senderId &&
              timeSincePrevious >= 0 &&
              timeSincePrevious <= 2 * 60 * 1000;

            return (
              <Fragment key={message.id}>
                {startsNewDay && (
                  <div className="chat-day">
                    <span>
                      {new Date(message.createdAt).toLocaleDateString(
                        "vi-VN",
                        {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        }
                      )}
                    </span>
                  </div>
                )}
                <article
                  className={`room-message${message.isOwn ? " own" : ""}${isFollowUp ? " follow-up" : ""}`}
                >
                  {!message.isOwn && !isFollowUp && (
                    <span className={`room-message-avatar ${message.color}`}>
                      {message.initials}
                    </span>
                  )}
                  <div>
                    {!message.isOwn && !isFollowUp && (
                      <p>
                        <strong>{message.name}</strong>
                      </p>
                    )}
                    {message.meeting && (
                      <span className="meeting-message-badge">
                        <Video size={12} /> Trong cuộc họp: {message.meeting}
                      </span>
                    )}
                    <div
                      className={`room-message-bubble${message.file && !message.text ? " file-only" : ""}`}
                    >
                      {message.text && (
                        <span className="chat-message-text">{message.text}</span>
                      )}
                      {message.file && (
                        <ChatFileAttachment
                          token={token}
                          roomId={roomId}
                          file={message.file}
                        />
                      )}
                      <time className="chat-message-time">{message.time}</time>
                    </div>
                  </div>
                </article>
              </Fragment>
            );
          })
        )}
      </div>
      <form className="room-chat-input" onSubmit={handleSendMessage}>
        <input
          ref={fileInputRef}
          type="file"
          accept={CHAT_FILE_ACCEPT}
          hidden
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            event.currentTarget.value = "";
            if (!file) return;
            try {
              validateChatFile(file);
              setSelectedFile(file);
              setFileError("");
            } catch (validationError) {
              setFileError(
                validationError instanceof Error
                  ? validationError.message
                  : "File không hợp lệ."
              );
            }
          }}
        />
        <button
          className="chat-attach-button"
          type="button"
          aria-label="Đính kèm file hoặc hình ảnh"
          title="Đính kèm file hoặc hình ảnh (tối đa 20 MiB)"
          onClick={() => fileInputRef.current?.click()}
          disabled={connectionState !== "connected" || isUploading}
        >
          <Paperclip size={17} />
        </button>
        <div
          className={`room-chat-compose${selectedFile ? " has-pending-file" : ""}`}
        >
          {selectedFile && (
            <ChatPendingAttachment
              file={selectedFile}
              disabled={isUploading}
              onRemove={() => setSelectedFile(null)}
            />
          )}
          <input
            placeholder="Nhập tin nhắn cho phòng..."
            aria-label="Tin nhắn"
            value={inputText}
            onChange={(event) => setInputText(event.target.value)}
            disabled={connectionState !== "connected"}
            maxLength={2000}
          />
        </div>
        {isUploading && <span className="chat-upload-status">Đang tải file...</span>}
        <button
          className="button primary"
          aria-label="Gửi tin nhắn"
          type="submit"
          disabled={
            connectionState !== "connected" ||
            isUploading ||
            (!inputText.trim() && !selectedFile)
          }
        >
          <Send size={17} />
        </button>
      </form>
    </section>
  );
}

export default RoomChat;
