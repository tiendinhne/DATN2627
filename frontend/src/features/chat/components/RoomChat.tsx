"use client";

import { useState } from "react";
import { Search, Send, Video } from "lucide-react";
import type { ChatMessage } from "../types";

export const initialRoomMessages: ChatMessage[] = [
  {
    name: "Minh Anh",
    initials: "MA",
    time: "14:23",
    text: "Mọi người xem giúp mình phần flow đăng nhập nhé.",
    color: "orange",
  },
  {
    name: "Quang Huy",
    initials: "QH",
    time: "14:25",
    text: "Mình đã hoàn thành phần API cho module phòng học.",
    color: "green",
    meeting: "Họp tiến độ tuần 5",
  },
  {
    name: "An Nguyễn",
    initials: "AN",
    time: "14:27",
    text: "Tuyệt vời, chiều nay mình cùng review trong cuộc họp.",
    color: "blue",
  },
];

export function RoomChat() {
  const [messages, setMessages] = useState<ChatMessage[]>(initialRoomMessages);
  const [inputText, setInputText] = useState("");

  const handleSendMessage = (event: React.FormEvent) => {
    event.preventDefault();
    if (!inputText.trim()) return;

    const newMessage: ChatMessage = {
      name: "An Nguyễn",
      initials: "AN",
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      text: inputText.trim(),
      color: "blue",
    };

    setMessages((prev) => [...prev, newMessage]);
    setInputText("");
  };

  return (
    <section className="panel-card room-chat-card">
      <div className="room-chat-header">
        <div>
          <h2>Trò chuyện trong phòng</h2>
          <p>8 thành viên · Tin nhắn được lưu lại sau cuộc họp</p>
        </div>
        <button className="icon-button" aria-label="Tìm tin nhắn" type="button">
          <Search size={17} />
        </button>
      </div>
      <div className="room-chat-list">
        <div className="chat-day">
          <span>Hôm nay</span>
        </div>
        {messages.map((message) => (
          <article
            className="room-message"
            key={`${message.name}-${message.time}-${message.text.substring(0, 10)}`}
          >
            <span className={`room-message-avatar ${message.color || "blue"}`}>
              {message.initials}
            </span>
            <div>
              <p>
                <strong>{message.name}</strong>
                <time>{message.time}</time>
              </p>
              {message.meeting && (
                <span className="meeting-message-badge">
                  <Video size={12} /> Trong cuộc họp: {message.meeting}
                </span>
              )}
              <div className="room-message-bubble">{message.text}</div>
            </div>
          </article>
        ))}
      </div>
      <form className="room-chat-input" onSubmit={handleSendMessage}>
        <span className="mini-avatar">AN</span>
        <input
          placeholder="Nhập tin nhắn cho phòng..."
          aria-label="Tin nhắn"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
        />
        <button className="button primary" aria-label="Gửi tin nhắn" type="submit">
          <Send size={17} />
        </button>
      </form>
    </section>
  );
}

export default RoomChat;
