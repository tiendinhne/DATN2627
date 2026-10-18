"use client";

import { ArrowRight, Bot, PenTool, Video } from "lucide-react";
import { useRouter } from "next/navigation";

export function HeroSection({
  onNavigate,
}: {
  onNavigate?: (page: string) => void;
}) {
  const router = useRouter();

  const handleStart = () => {
    if (onNavigate) {
      onNavigate("dashboard");
    } else {
      router.push("/dashboard");
    }
  };

  const handleLogin = () => {
    if (onNavigate) {
      onNavigate("login");
    } else {
      router.push("/login");
    }
  };

  return (
    <section className="landing-hero">
      <div className="hero-copy">
        <div className="hero-badge">
          <span /> Không gian học tập thế hệ mới
        </div>
        <h1>
          Learn together.
          <br />
          <em>Create together.</em>
        </h1>
        <p>
          Một không gian học nhóm trực tuyến với video meeting, cộng tác realtime và
          bảng vẽ thông minh.
        </p>
        <div className="hero-actions">
          <button className="button primary large" onClick={handleStart} type="button">
            Bắt đầu miễn phí <ArrowRight size={18} />
          </button>
          <button className="button secondary large" onClick={handleLogin} type="button">
            Đăng nhập
          </button>
        </div>
        <div className="hero-proof">
          <div>
            <span>AN</span>
            <span>MA</span>
            <span>QH</span>
          </div>
          <p>
            <strong>200+ sinh viên</strong> đang cùng học tập
          </p>
        </div>
      </div>

      <div className="hero-visual">
        <div className="mock-window">
          <div className="mock-top">
            <i />
            <i />
            <i />
            <span>Họp tiến độ tuần 5</span>
          </div>
          <div className="mock-body">
            <div className="mock-video">
              <span>MA</span>
              <small>Minh Anh</small>
            </div>
            <div className="mock-board">
              <div>Ý tưởng</div>
              <i />
              <div>Thiết kế</div>
              <i />
              <div>Sản phẩm</div>
            </div>
          </div>
          <div className="mock-controls">
            <span>
              <Video size={16} />
            </span>
            <span>
              <Video size={16} />
            </span>
            <span>
              <PenTool size={16} />
            </span>
          </div>
        </div>
        <div className="floating-card">
          <Bot size={18} />
          <p>
            <strong>AI đã tạo flowchart</strong>
            <small>Sẵn sàng thêm vào bảng vẽ</small>
          </p>
        </div>
      </div>
    </section>
  );
}

export default HeroSection;
