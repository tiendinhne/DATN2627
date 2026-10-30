"use client";

import { Fragment, useEffect, useRef, useState, type FormEvent } from "react";
import { MessageSquare, Paperclip, Send, Smile } from "lucide-react";
import { useRoomChat } from "../hooks/useRoomChat";
import {
  CHAT_FILE_ACCEPT,
  validateChatFile,
} from "../services/chat.service";
import { ChatFileAttachment } from "./ChatFileAttachment";
import { ChatPendingAttachment } from "./ChatPendingAttachment";

interface MeetingChatProps {
  roomId?: string;
  meetingId?: string;
  token: string | null;
  currentUserId?: string;
}

export function MeetingChat({
  roomId,
  meetingId,
  token,
  currentUserId,
}: MeetingChatProps) {
  const [input, setInput] = useState("");
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
    meetingId,
    token,
    currentUserId,
  });

  useEffect(() => {
    const messageList = messageListRef.current;
    if (messageList) messageList.scrollTop = messageList.scrollHeight;
  }, [messages]);

  const handleSend = async (event: FormEvent) => {
    event.preventDefault();
    const text = input.trim();
    if (selectedFile) {
      if (await sendFile(selectedFile, text)) {
        setSelectedFile(null);
        setInput("");
        setFileError("");
      }
      return;
    }
    if (text && sendMessage(text)) setInput("");
  };

  return (
    <div className="chat-panel">
      <div className="chat-context">
        <MessageSquare size={16} />
        <p>
          Tin nhắn này cũng sẽ xuất hiện trong <strong>Room Chat</strong>.
        </p>
      </div>
      <p className="px-3 text-xs text-slate-400" role="status">
        {connectionState === "connected"
          ? "Đã kết nối"
          : connectionState === "connecting"
            ? "Đang kết nối..."
            : "Chưa kết nối chat"}
      </p>
      {(error || fileError) && (
        <p className="px-3 text-xs text-red-400" role="alert">
          {fileError || error}
        </p>
      )}
      <div className="chat-messages" ref={messageListRef}>
        {messages.length === 0 ? (
          <p className="py-6 text-center text-xs text-slate-400">
            Chưa có tin nhắn trong cuộc họp.
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
                <div
                  className={`message${message.isOwn ? " own" : ""}${isFollowUp ? " follow-up" : ""}`}
                >
                  {!message.isOwn && !isFollowUp && (
                    <span className={`message-avatar ${message.color}`}>
                      {message.initials}
                    </span>
                  )}
                  <div>
                    {!message.isOwn && !isFollowUp && (
                      <p>
                        <strong>{message.name}</strong>
                      </p>
                    )}
                    <div
                      className={`chat-message-bubble${message.file && !message.text ? " file-only" : ""}`}
                    >
                      {message.text && (
                        <span className="chat-message-text">{message.text}</span>
                      )}
                      {message.file && roomId && (
                        <ChatFileAttachment
                          token={token}
                          roomId={roomId}
                          file={message.file}
                        />
                      )}
                      <time className="chat-message-time">{message.time}</time>
                    </div>
                  </div>
                </div>
              </Fragment>
            );
          })
        )}
      </div>
      <form className="chat-input" onSubmit={handleSend}>
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
        <div>
          <button
            type="button"
            className="chat-attach-button"
            aria-label="Đính kèm file hoặc hình ảnh"
            title="Đính kèm file hoặc hình ảnh (tối đa 20 MiB)"
            onClick={() => fileInputRef.current?.click()}
            disabled={connectionState !== "connected" || isUploading}
          >
            <Paperclip size={17} />
          </button>
          <input
            placeholder="Nhập tin nhắn..."
            value={input}
            onChange={(event) => setInput(event.target.value)}
            disabled={connectionState !== "connected"}
            maxLength={2000}
          />
          <button type="button" aria-label="Emoji">
            <Smile size={17} />
          </button>
          {selectedFile && (
            <ChatPendingAttachment
              file={selectedFile}
              disabled={isUploading}
              onRemove={() => setSelectedFile(null)}
            />
          )}
        </div>
        {isUploading && <span className="chat-upload-status">Đang tải file...</span>}
        <button
          className="send"
          type="submit"
          aria-label="Gửi"
          disabled={
            connectionState !== "connected" ||
            isUploading ||
            (!input.trim() && !selectedFile)
          }
        >
          <Send size={17} />
        </button>
      </form>
    </div>
  );
}

export default MeetingChat;
