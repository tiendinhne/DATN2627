"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import type { AuthMode } from "../types";
import { AuthVisual } from "./AuthVisual";

interface AuthLayoutProps {
  mode: AuthMode;
  children: ReactNode;
  onNavigate?: (page: string) => void;
}

export function AuthLayout({ mode, children, onNavigate }: AuthLayoutProps) {
  const router = useRouter();

  const handleBack = () => {
    if (onNavigate) {
      onNavigate(mode === "login" ? "landing" : "login");
    } else {
      router.push(mode === "login" ? "/" : "/login");
    }
  };

  return (
    <div className="auth-page">
      <AuthVisual mode={mode} onNavigate={onNavigate} />
      <main className="auth-form-wrap">
        <button className="back-link" onClick={handleBack} type="button">
          <ArrowLeft size={16} />{" "}
          {mode === "login" ? "Về trang chủ" : "Quay lại đăng nhập"}
        </button>
        {children}
      </main>
    </div>
  );
}

export default AuthLayout;
