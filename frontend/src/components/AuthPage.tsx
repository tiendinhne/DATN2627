"use client";

import { AuthLayout, ForgotPasswordForm, LoginForm, RegisterForm } from "@/features/auth";

export function AuthPage({
  mode,
  onNavigate,
}: {
  mode: "login" | "register" | "forgot-password";
  onNavigate?: (page: any) => void;
}) {
  return (
    <AuthLayout mode={mode} onNavigate={onNavigate}>
      {mode === "login" && <LoginForm onNavigate={onNavigate} />}
      {mode === "register" && <RegisterForm onNavigate={onNavigate} />}
      {mode === "forgot-password" && <ForgotPasswordForm onNavigate={onNavigate} />}
    </AuthLayout>
  );
}

export default AuthPage;
