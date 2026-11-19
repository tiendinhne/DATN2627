"use client";

import { ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth.context";

const steps = [
  { step: "Tạo phòng", detail: "Thiết lập không gian học" },
  { step: "Mời thành viên", detail: "Chia sẻ mã phòng" },
  { step: "Bắt đầu họp", detail: "Kết nối video realtime" },
  { step: "Cùng cộng tác", detail: "Chat và bảng vẽ thông minh" },
  { step: "Lưu kết quả", detail: "Xem lại bất cứ lúc nào" },
];

export function HowSection({
  onNavigate,
}: {
  onNavigate?: (page: string) => void;
}) {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  const handleStart = () => {
    if (isLoading) return;

    const targetPage = user ? "dashboard" : "login";

    if (onNavigate) {
      onNavigate(targetPage);
    } else {
      router.push(user ? "/dashboard" : "/login");
    }
  };

  return (
    <section className="how-section" id="how">
      <div className="section-intro">
        <p className="eyebrow">BẮT ĐẦU THẬT DỄ DÀNG</p>
        <h2>Từ ý tưởng đến kết quả trong một luồng</h2>
      </div>
      <div className="how-flow">
        {steps.map((item, index) => (
          <div className="how-step" key={item.step}>
            <span>{index + 1}</span>
            <strong>{item.step}</strong>
            <small>{item.detail}</small>
          </div>
        ))}
      </div>
      <button
        className="button primary large"
        onClick={handleStart}
        type="button"
        disabled={isLoading}
      >
        Tạo phòng đầu tiên <ArrowRight size={18} />
      </button>
    </section>
  );
}

export default HowSection;
