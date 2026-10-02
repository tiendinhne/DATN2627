"use client";

import { GraduationCap } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export function LandingNav({
  onNavigate,
}: {
  onNavigate?: (page: string) => void;
}) {
  const router = useRouter();

  const handleLogin = () => {
    if (onNavigate) {
      onNavigate("login");
    } else {
      router.push("/login");
    }
  };

  const handleStart = () => {
    if (onNavigate) {
      onNavigate("dashboard");
    } else {
      router.push("/dashboard");
    }
  };

  return (
    <nav className="landing-nav">
      <div className="brand">
        <span className="brand-mark">
          <GraduationCap size={23} />
        </span>
        <span>RusSra</span>
      </div>
      <div className="landing-links">
        <a href="#features">Tính năng</a>
        <a href="#how">Cách hoạt động</a>
        <button className="button ghost" onClick={handleLogin} type="button">
          Đăng nhập
        </button>
        <button className="button primary" onClick={handleStart} type="button">
          Bắt đầu ngay
        </button>
      </div>
    </nav>
  );
}

export default LandingNav;
