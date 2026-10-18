"use client";

import { FcGoogle } from "react-icons/fc";
import { useAuth } from "@/context/auth.context";
import { safeReturnUrl } from '@/lib/return-url';

export function SocialDivider() {
  const getReturnUrl = () => safeReturnUrl(new URLSearchParams(window.location.search).get('returnUrl'));
  const { loginWithGoogle } = useAuth();
  
  const handleGoogleLogin = () => {
    // Google redirect đi rồi quay về /auth/callback → cất returnUrl lại để callback đọc
    sessionStorage.setItem('returnUrl', getReturnUrl());
    loginWithGoogle();
  };

  return (
    <>
      <div className="divider">
        <span>hoặc tiếp tục với</span>
      </div>
      <button type="button" className="button secondary large w-full" onClick={handleGoogleLogin}>
        <FcGoogle /> Đăng nhập với Google
      </button>
    </>
  );
}

export default SocialDivider;
