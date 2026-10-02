import { Bot, MessageSquare, PenTool, Users, Video } from "lucide-react";

const featuresData = [
  [Video, "Video & Audio realtime", "Kết nối ổn định cho mọi buổi học nhóm."],
  [PenTool, "Bảng vẽ cộng tác", "Cùng phác thảo, ghi chú và phát triển ý tưởng."],
  [MessageSquare, "Trò chuyện liền mạch", "Tin nhắn cuộc họp được lưu lại trong phòng."],
  [Bot, "AI hỗ trợ trực quan", "Tạo sơ đồ và mind map ngay trên bảng vẽ."],
  [Users, "Phòng học có tổ chức", "Quản lý cuộc họp, thành viên và lịch sử dễ dàng."],
] as const;

export function FeatureSection() {
  return (
    <section className="features" id="features">
      <div className="section-intro">
        <p className="eyebrow">MỌI THỨ TRONG MỘT KHÔNG GIAN</p>
        <h2>Học nhóm hiệu quả hơn, cùng nhau</h2>
      </div>
      <div className="feature-grid">
        {featuresData.map(([Icon, title, text]) => (
          <article key={title}>
            <span>
              <Icon size={22} />
            </span>
            <h3>{title}</h3>
            <p>{text}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

export default FeatureSection;
