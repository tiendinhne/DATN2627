import { io, type Socket } from "socket.io-client";
import { API_BASE_URL, request } from "@/services/api";
import type {
  BackendChatMessage,
  ChatFileMetadata,
  ChatMessage,
  SendMessageDto,
} from "../types";

export const MAX_CHAT_FILE_SIZE_BYTES = 20 * 1024 * 1024;
export const CHAT_FILE_ACCEPT =
  ".jpg,.jpeg,.png,.webp,.gif,.pdf,.txt,.csv,.doc,.docx,.xls,.xlsx,.ppt,.pptx";
export const CHAT_FILE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
  "text/plain",
  "text/csv",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
] as const;

export function validateChatFile(file: File): void {
  if (!(CHAT_FILE_MIME_TYPES as readonly string[]).includes(file.type)) {
    throw new Error("Định dạng file không được hỗ trợ.");
  }
  if (file.size < 1 || file.size > MAX_CHAT_FILE_SIZE_BYTES) {
    throw new Error("File phải có dung lượng từ 1 byte đến 20 MiB.");
  }
}

export const chatService = {
  async getRoomMessages(
    token: string,
    roomId: string,
    currentUserId: string,
    meetingId?: string
  ): Promise<ChatMessage[]> {
    const query = new URLSearchParams({ limit: "50" });
    if (meetingId) query.set("meetingId", meetingId);

    const response = await request<{
      items: BackendChatMessage[];
      nextCursor: string | null;
    }>(token, `/rooms/${encodeURIComponent(roomId)}/messages?${query}`);

    return response.items
      .reverse()
      .map((message) => toChatMessage(message, currentUserId));
  },

  connect(token: string): Socket {
    return io(`${API_BASE_URL}/meeting`, {
      auth: { token },
      transports: ["websocket"],
    });
  },

  sendMessage(socket: Socket, data: SendMessageDto) {
    socket.emit("chat:send", {
      ...data,
      clientMsgId: crypto.randomUUID(),
    });
  },

  async uploadFile(
    token: string,
    roomId: string,
    file: File,
    meetingId?: string
  ): Promise<ChatFileMetadata> {
    validateChatFile(file);

    const upload = await request<{
      file: ChatFileMetadata;
      upload: {
        method: "PUT";
        url: string;
        headers: Record<string, string>;
      };
    }>(token, `/rooms/${encodeURIComponent(roomId)}/uploads`, {
      method: "POST",
      body: JSON.stringify({
        originalName: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
        ...(meetingId ? { meetingId } : {}),
      }),
    });

    const response = await fetch(upload.upload.url, {
      method: upload.upload.method,
      headers: upload.upload.headers,
      body: file,
    });
    if (!response.ok) {
      throw new Error(`Tải file lên kho lưu trữ thất bại (${response.status}).`);
    }

    await request(
      token,
      `/rooms/${encodeURIComponent(roomId)}/uploads/${encodeURIComponent(upload.file.id)}/complete`,
      { method: "POST" }
    );

    return upload.file;
  },

  async getDownloadUrl(
    token: string,
    roomId: string,
    fileId: string
  ): Promise<string> {
    const response = await request<{ url: string }>(
      token,
      `/rooms/${encodeURIComponent(roomId)}/files/${encodeURIComponent(fileId)}/download-url`
    );
    return response.url;
  },
};

export function toChatMessage(
  message: BackendChatMessage,
  currentUserId: string
): ChatMessage {
  const colors = ["orange", "green", "blue"];
  const colorIndex = [...message.senderId].reduce(
    (total, character) => total + character.charCodeAt(0),
    0
  ) % colors.length;

  return {
    id: message.id,
    senderId: message.senderId,
    name: message.senderName,
    initials: message.senderName
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toLocaleUpperCase() ?? "")
      .join(""),
    time: new Date(message.createdAt).toLocaleTimeString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
    }),
    text: message.content,
    color: colors[colorIndex],
    ...(message.meetingTitle ? { meeting: message.meetingTitle } : {}),
    ...(message.file ? { file: message.file } : {}),
    isOwn: message.senderId === currentUserId,
    createdAt: message.createdAt,
  };
}
