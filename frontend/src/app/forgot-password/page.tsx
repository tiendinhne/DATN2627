import type { Metadata } from "next";
import { AuthLayout, ForgotPasswordForm } from "@/features/auth";

export const metadata: Metadata = {
  title: "Khôi phục mật khẩu — RusSra",
  description: "Khôi phục mật khẩu tài khoản RusSra của bạn.",
};

export default function ForgotPasswordPage() {
  return (
    <AuthLayout mode="forgot-password">
      <ForgotPasswordForm />
    </AuthLayout>
  );
}
