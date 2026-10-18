import type { Metadata } from "next";
import { AuthLayout, LoginForm } from "@/features/auth";

export const metadata: Metadata = {
  title: "Đăng nhập — RusSra",
  description: "Đăng nhập vào tài khoản RusSra để tham gia phòng học nhóm và cuộc họp trực tuyến.",
};

export default function LoginPage() {
  return (
    <AuthLayout mode="login">
      <LoginForm />
    </AuthLayout>
  );
}
