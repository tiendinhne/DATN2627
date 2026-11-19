"use client";

import { Fragment, useEffect, useRef, useState, type FormEvent } from "react";
import { AlertCircle, Paperclip, Search, Send, Video, X } from "lucide-react";
import { useRoomChat } from "../hooks/useRoomChat";
import {
  chatService,
  CHAT_FILE_ACCEPT,
  validateChatFile,
} from "../services/chat.service";
import type { ChatSearchResult } from "../types";
import { ChatFileAttachment } from "./ChatFileAttachment";
import { ChatPendingAttachment } from "./ChatPendingAttachment";

interface RoomChatProps {
  roomId: string;
  token: string | null;
  currentUserId?: string;
}

type RoomChatFilter = "all" | "room" | "meeting";

export function RoomChat({ roomId, token, currentUserId }: RoomChatProps) {
  const [inputText, setInputText] = useState("");
  const [messageFilter, setMessageFilter] = useState<RoomChatFilter>("all");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState("");
  const [showError, setShowError] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ChatSearchResult[]>([]);
  const [searchCursor, setSearchCursor] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messageListRef = useRef<HTMLDivElement>(null);
  const pendingJumpIdRef = useRef<string | null>(null);
  const searchRequestIdRef = useRef(0);
  const {
    messages,
    error,
    connectionState,
    isUploading,
    sendMessage,
    sendFile,
    loadMessagesAround,
  } = useRoomChat({
    roomId,
    token,
    currentUserId,
  });
  const visibleMessages = messages.filter((message) => {
    if (messageFilter === "all") return true;
    return messageFilter === "meeting"
      ? message.meetingId !== null
      : message.meetingId === null;
  });

  useEffect(() => {
    const messageList = messageListRef.current;
    if (!messageList) return;

    if (pendingJumpIdRef.current) {
      const target = messageList.querySelector<HTMLElement>(
        `[data-message-id="${pendingJumpIdRef.current}"]`,
      );
      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "center" });
        pendingJumpIdRef.current = null;
        return;
      }
    }

    messageList.scrollTop = messageList.scrollHeight;
  }, [messages]);

  useEffect(() => {
    const requestId = ++searchRequestIdRef.current;
    const query = searchQuery.trim();
    if (!searchOpen || !token || !query) {
      setSearchResults([]);
      setSearchCursor(null);
      setSearchError("");
      setIsSearching(false);
      return;
    }

    setSearchResults([]);
    setSearchCursor(null);
    setSearchError("");
    setIsSearching(true);
    const timer = setTimeout(() => {
      chatService
        .searchRoomMessages(token, roomId, query, undefined, messageFilter)
        .then((page) => {
          if (requestId !== searchRequestIdRef.current) return;
          setSearchResults(page.items);
          setSearchCursor(page.nextCursor);
        })
        .catch((searchFailure: unknown) => {
          if (requestId !== searchRequestIdRef.current) return;
          setSearchError(
            searchFailure instanceof Error
              ? searchFailure.message
              : "Không thể tìm tin nhắn.",
          );
        })
        .finally(() => {
          if (requestId === searchRequestIdRef.current) {
            setIsSearching(false);
          }
        });
    }, 300);

    return () => {
      clearTimeout(timer);
      if (requestId === searchRequestIdRef.current) {
        searchRequestIdRef.current += 1;
      }
    };
  }, [searchOpen, searchQuery, token, roomId, messageFilter]);

  useEffect(() => {
    if (!error && !fileError) {
      setShowError(false);
      return;
    }

    setShowError(true);

    const timer = setTimeout(() => {
      setShowError(false);
      setFileError("");
    }, 3000);

    return () => clearTimeout(timer);
  }, [error, fileError]);

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

  const handleLoadMoreSearchResults = async () => {
    const query = searchQuery.trim();
    if (!token || !query || !searchCursor || isSearching) return;

    const requestId = ++searchRequestIdRef.current;
    setIsSearching(true);
    setSearchError("");
    try {
      const page = await chatService.searchRoomMessages(
        token,
        roomId,
        query,
        searchCursor,
        messageFilter,
      );
      if (requestId !== searchRequestIdRef.current) return;
      setSearchResults((current) => [...current, ...page.items]);
      setSearchCursor(page.nextCursor);
    } catch (searchFailure: unknown) {
      if (requestId === searchRequestIdRef.current) {
        setSearchError(
          searchFailure instanceof Error
            ? searchFailure.message
            : "Không thể tìm tin nhắn.",
        );
      }
    } finally {
      if (requestId === searchRequestIdRef.current) {
        setIsSearching(false);
      }
    }
  };

  const handleOpenSearchResult = async (result: ChatSearchResult) => {
    pendingJumpIdRef.current = result.id;
    setHighlightedMessageId(result.id);
    try {
      await loadMessagesAround(result.id);
      setSearchOpen(false);
      setSearchQuery("");
    } catch (searchFailure: unknown) {
      pendingJumpIdRef.current = null;
      setSearchError(
        searchFailure instanceof Error
          ? searchFailure.message
          : "Không thể mở tin nhắn.",
      );
    }
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
        <button
          className="icon-button"
          aria-label={searchOpen ? "Đóng tìm kiếm" : "Tìm tin nhắn"}
          type="button"
          onClick={() => {
            setSearchOpen((open) => !open);
            setSearchQuery("");
            setSearchError("");
          }}
        >
          {searchOpen ? <X size={17} /> : <Search size={17} />}
        </button>
      </div>
      {searchOpen && (
        <div className="room-chat-search">
          <Search size={16} aria-hidden="true" />
          <input
            type="search"
            autoFocus
            aria-label="Tìm trong tin nhắn của phòng"
            placeholder="Tìm tin nhắn trong phòng..."
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
          />
          {searchQuery.trim() && (
            <div className="room-chat-search-results">
              {isSearching && (
                <p className="room-chat-search-status">Đang tìm tin nhắn...</p>
              )}
              {searchError && (
                <p className="room-chat-search-status error">{searchError}</p>
              )}
              {!isSearching &&
                !searchError &&
                searchResults.length === 0 &&
                searchQuery.trim().length > 0 && (
                  <p className="room-chat-search-status">
                    Không tìm thấy tin nhắn phù hợp.
                  </p>
                )}
              {searchResults.map((result) => (
                <button
                  className="room-chat-search-result"
                  key={result.id}
                  type="button"
                  onClick={() => void handleOpenSearchResult(result)}
                >
                  <span>
                    <strong>{result.senderName}</strong>
                    <time>
                      {new Date(result.createdAt).toLocaleString("vi-VN", {
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </time>
                  </span>
                  <small>{result.content}</small>
                </button>
              ))}
              {searchCursor && !isSearching && (
                <button
                  className="room-chat-search-more"
                  type="button"
                  onClick={() => void handleLoadMoreSearchResults()}
                >
                  Tải thêm kết quả
                </button>
              )}
            </div>
          )}
        </div>
      )}
      <div className="room-chat-filters" role="group" aria-label="Lọc tin nhắn">
        {(
          [
            ["all", "Tất cả"],
            ["room", "Chat phòng"],
            ["meeting", "Cuộc họp"],
          ] as const
        ).map(([filter, label]) => (
          <button
            key={filter}
            className={`room-chat-filter${messageFilter === filter ? " active" : ""}`}
            type="button"
            aria-pressed={messageFilter === filter}
            onClick={() => setMessageFilter(filter)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="room-chat-list" ref={messageListRef}>
        {visibleMessages.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-400">
            {messages.length === 0
              ? "Chưa có tin nhắn trong phòng."
              : "Không có tin nhắn phù hợp với bộ lọc."}
          </p>
        ) : (
          visibleMessages.map((message, index) => {
            const previousMessage = visibleMessages[index - 1];
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
                  data-message-id={message.id}
                  className={`room-message${message.isOwn ? " own" : ""}${isFollowUp ? " follow-up" : ""}${message.id === highlightedMessageId ? " search-hit" : ""}`}
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
      {showError && (error || fileError) && (
        <div
          role="alert"
          className="mx-4 mb-2 flex items-center gap-2 rounded-lg border border-red-100 bg-red-50 px-3 py-2"
        >
          <AlertCircle size={16} className="shrink-0 text-red-500" />
          <p className="min-w-0 flex-1 text-xs font-medium text-red-700">
            {fileError || error}
          </p>
        </div>
      )}
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
