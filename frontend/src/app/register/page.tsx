import type { Metadata } from "next";
import { AuthLayout, RegisterForm } from "@/features/auth";

export const metadata: Metadata = {
  title: "Đăng ký tài khoản — RusSra",
  description: "Tạo tài khoản mới trên RusSra để bắt đầu học nhóm và cộng tác thông minh.",
};

export default function RegisterPage() {
  return (
    <AuthLayout mode="register">
      <RegisterForm />
    </AuthLayout>
  );
}
