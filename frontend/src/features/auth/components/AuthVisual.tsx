"use client";

import { GraduationCap, LockKeyhole, PenTool, Video } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { AuthMode } from "../types";

export function AuthVisual({
  mode,
  onNavigate,
}: {
  mode: AuthMode;
  onNavigate?: (page: string) => void;
}) {
  const router = useRouter();

  const heading =
    mode === "register"
      ? "Mỗi hành trình học tập đều tuyệt vời hơn khi có đồng đội."
      : mode === "forgot-password"
        ? "Đừng để một mật khẩu làm gián đoạn buổi học của bạn."
        : "Ý tưởng tuyệt vời bắt đầu từ việc cùng nhau chia sẻ.";

  const handleBrandClick = () => {
    if (onNavigate) {
      onNavigate("landing");
    } else {
      router.push("/");
    }
  };

  return (
    <section className="auth-visual">
      <button className="brand" onClick={handleBrandClick} type="button">
        <span className="brand-mark">
          <GraduationCap size={23} />
        </span>
        <span>RusSra</span>
      </button>
      <div className="auth-quote">
        <span>
          {mode === "forgot-password" ? (
            <LockKeyhole size={24} />
          ) : (
            <PenTool size={24} />
          )}
        </span>
        <h2>{heading}</h2>
        <p>Học, cộng tác và sáng tạo trong cùng một không gian.</p>
      </div>
      <div className="auth-mini">
        <div>
          <span>
            <Video size={17} />
          </span>
          <p>
            <strong>Họp nhóm trực tuyến</strong>
            <small>Kết nối mọi lúc, mọi nơi</small>
          </p>
        </div>
        <div>
          <span>
            <PenTool size={17} />
          </span>
          <p>
            <strong>Bảng vẽ thông minh</strong>
            <small>Cùng biến ý tưởng thành hiện thực</small>
          </p>
        </div>
      </div>
    </section>
  );
}

export default AuthVisual;
