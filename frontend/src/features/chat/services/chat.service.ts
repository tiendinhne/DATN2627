import type { ChatMessage, SendMessageDto } from "../types";

export const chatService = {
  async getRoomMessages(roomId: string): Promise<ChatMessage[]> {
    return [
      { name: "Minh Anh", initials: "MA", time: "14:23", text: "Mọi người xem giúp mình phần flow đăng nhập nhé.", color: "orange" },
      { name: "Quang Huy", initials: "QH", time: "14:25", text: "Mình đã hoàn thành phần API cho module phòng học.", color: "green", meeting: "Họp tiến độ tuần 5" },
      { name: "An Nguyễn", initials: "AN", time: "14:27", text: "Tuyệt vời, chiều nay mình cùng review trong cuộc họp.", color: "blue" },
    ];
  },

  async sendMessage(data: SendMessageDto): Promise<ChatMessage> {
    return {
      name: "Bạn",
      initials: "AN",
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      text: data.text,
      isOwn: true,
    };
  },
};

export default chatService;
