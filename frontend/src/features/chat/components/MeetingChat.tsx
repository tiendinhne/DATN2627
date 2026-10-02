"use client";

import { useState } from "react";
import { MessageSquare, Send, Smile } from "lucide-react";

export function MeetingChat() {
  const [messages, setMessages] = useState([
    {
      id: "1",
      sender: "Minh Anh",
      avatar: "MA",
      color: "orange",
      time: "14:23",
      text: "Phần sơ đồ này mình nghĩ nên thêm bước xác thực email.",
      isOwn: false,
    },
    {
      id: "2",
      sender: "Quang Huy",
      avatar: "QH",
      color: "green",
      time: "14:25",
      text: "Đồng ý, mình sẽ cập nhật ở backend nhé.",
      isOwn: false,
    },
    {
      id: "3",
      sender: "Bạn",
      avatar: "AN",
      color: "blue",
      time: "14:26",
      text: "Okay, để mình thêm vào flow luôn.",
      isOwn: true,
    },
  ]);
  const [input, setInput] = useState("");

  const handleSend = () => {
    if (!input.trim()) return;
    setMessages((prev) => [
      ...prev,
      {
        id: String(Date.now()),
        sender: "Bạn",
        avatar: "AN",
        color: "blue",
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        text: input.trim(),
        isOwn: true,
      },
    ]);
    setInput("");
  };

  return (
    <div className="chat-panel">
      <div className="chat-context">
        <MessageSquare size={16} />
        <p>
          Tin nhắn này cũng sẽ xuất hiện trong <strong>Room Chat</strong>.
        </p>
      </div>
      <div className="chat-messages">
        {messages.map((msg) =>
          msg.isOwn ? (
            <div className="message own" key={msg.id}>
              <div>
                <p>
                  <strong>{msg.sender}</strong>
                  <time>{msg.time}</time>
                </p>
                <div>{msg.text}</div>
              </div>
            </div>
          ) : (
            <div className="message" key={msg.id}>
              <span className={`message-avatar ${msg.color}`}>{msg.avatar}</span>
              <div>
                <p>
                  <strong>{msg.sender}</strong>
                  <time>{msg.time}</time>
                </p>
                <div>{msg.text}</div>
              </div>
            </div>
          )
        )}
      </div>
      <div className="chat-input">
        <div>
          <input
            placeholder="Nhập tin nhắn..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleSend();
              }
            }}
          />
          <button type="button" aria-label="Emoji">
            <Smile size={17} />
          </button>
        </div>
        <button className="send" onClick={handleSend} type="button" aria-label="Gửi">
          <Send size={17} />
        </button>
      </div>
    </div>
  );
}

export default MeetingChat;
