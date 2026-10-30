"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import { chatService, toChatMessage } from "../services/chat.service";
import type { BackendChatMessage, ChatMessage } from "../types";

type ConnectionState = "connecting" | "connected" | "disconnected" | "unavailable";

interface ChatEnvelope {
  roomId: string;
  data: { message: BackendChatMessage };
}

function isChatFileMetadata(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const file = value as Partial<NonNullable<BackendChatMessage["file"]>>;
  return (
    typeof file.id === "string" &&
    typeof file.originalName === "string" &&
    typeof file.mimeType === "string" &&
    typeof file.sizeBytes === "number"
  );
}

function isBackendChatMessage(value: unknown): value is BackendChatMessage {
  if (!value || typeof value !== "object") return false;
  const message = value as Partial<BackendChatMessage>;
  return (
    typeof message.id === "string" &&
    typeof message.roomId === "string" &&
    typeof message.senderId === "string" &&
    typeof message.senderName === "string" &&
    typeof message.content === "string" &&
    typeof message.createdAt === "string" &&
    (message.file === null || isChatFileMetadata(message.file))
  );
}

function getErrorMessage(error: unknown): string {
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "message" in error) {
    const message = error.message;
    if (typeof message === "string") return message;
    if (Array.isArray(message)) return message.join(", ");
  }
  return "Không thể kết nối hoặc gửi tin nhắn.";
}

function mergeMessages(
  current: ChatMessage[],
  incoming: ChatMessage[]
): ChatMessage[] {
  const messages = new Map(current.map((message) => [message.id, message]));
  for (const message of incoming) messages.set(message.id, message);
  return [...messages.values()].sort(
    (left, right) =>
      new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()
  );
}

export function useRoomChat({
  token,
  roomId,
  currentUserId,
  meetingId,
}: {
  token: string | null;
  roomId?: string;
  currentUserId?: string;
  meetingId?: string;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [error, setError] = useState("");
  const [connectionState, setConnectionState] =
    useState<ConnectionState>("unavailable");
  const [isUploading, setIsUploading] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const uploadInProgressRef = useRef(false);

  useEffect(() => {
    if (!token || !roomId || !/^[a-f\d]{24}$/i.test(roomId)) {
      setMessages([]);
      setError("");
      setConnectionState("unavailable");
      return;
    }

    let cancelled = false;
    setMessages([]);
    setError("");
    setConnectionState("connecting");

    const socket = chatService.connect(token);
    socketRef.current = socket;

    const loadHistory = () => {
      chatService
        .getRoomMessages(token, roomId, currentUserId ?? "", meetingId)
        .then((history) => {
          if (!cancelled) {
            setMessages((current) => mergeMessages(current, history));
          }
        })
        .catch((historyError: unknown) => {
          if (!cancelled) setError(getErrorMessage(historyError));
        });
    };

    socket.on("connect", () => {
      socket.emit("room:subscribe", { roomId });
      setConnectionState("connected");
      loadHistory();
    });
    socket.on("disconnect", () => setConnectionState("disconnected"));
    socket.on("connect_error", (connectError: unknown) => {
      setConnectionState("disconnected");
      setError(getErrorMessage(connectError));
    });
    socket.on("error", (socketError: unknown) => {
      setError(getErrorMessage(socketError));
    });
    socket.on("chat:new", (event: unknown) => {
      if (!event || typeof event !== "object") return;
      const envelope = event as Partial<ChatEnvelope>;
      const message = envelope.data?.message;
      if (
        envelope.roomId !== roomId ||
        !isBackendChatMessage(message) ||
        message.roomId !== roomId ||
        (meetingId !== undefined && message.meetingId !== meetingId)
      ) {
        return;
      }

      setMessages((current) =>
        mergeMessages(current, [
          toChatMessage(message, currentUserId ?? ""),
        ])
      );
    });

    loadHistory();

    return () => {
      cancelled = true;
      if (socket.connected) socket.emit("room:unsubscribe", { roomId });
      socket.disconnect();
      if (socketRef.current === socket) socketRef.current = null;
    };
  }, [token, roomId, currentUserId, meetingId]);

  const sendMessage = useCallback(
    (content: string) => {
      const socket = socketRef.current;
      if (!socket?.connected || !roomId) {
        setError("Chat chưa kết nối. Vui lòng thử lại.");
        return false;
      }

      setError("");
      chatService.sendMessage(socket, {
        roomId,
        content,
        ...(meetingId ? { meetingId } : {}),
      });
      return true;
    },
    [roomId, meetingId]
  );

  const sendFile = useCallback(
    async (file: File, content = "") => {
      if (!token || !roomId || !socketRef.current?.connected) {
        setError("Chat chưa kết nối. Vui lòng thử lại.");
        return false;
      }
      if (uploadInProgressRef.current) return false;

      uploadInProgressRef.current = true;
      setIsUploading(true);
      setError("");
      try {
        const uploadedFile = await chatService.uploadFile(
          token,
          roomId,
          file,
          meetingId
        );
        const socket = socketRef.current;
        if (!socket?.connected) {
          throw new Error("File đã tải lên nhưng chat bị ngắt kết nối. Hãy gửi lại.");
        }

        chatService.sendMessage(socket, {
          roomId,
          content: content.trim(),
          fileId: uploadedFile.id,
          ...(meetingId ? { meetingId } : {}),
        });
        return true;
      } catch (uploadError: unknown) {
        setError(getErrorMessage(uploadError));
        return false;
      } finally {
        uploadInProgressRef.current = false;
        setIsUploading(false);
      }
    },
    [token, roomId, meetingId]
  );

  return {
    messages,
    error,
    connectionState,
    isUploading,
    sendMessage,
    sendFile,
  };
}
