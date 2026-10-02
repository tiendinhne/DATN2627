"use client";

import { Check, Mail } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export function ForgotPasswordForm({
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

  return (
    <form
      className="auth-form forgot-form"
      onSubmit={(event) => {
        event.preventDefault();
        event.currentTarget.classList.add("submitted");
      }}
    >
      <div className="forgot-icon">
        <Mail size={25} />
      </div>
      <p className="eyebrow">KHÔI PHỤC TÀI KHOẢN</p>
      <h1>Quên mật khẩu?</h1>
      <p>
        Nhập email đã đăng ký. Chúng tôi sẽ gửi cho bạn liên kết đặt lại mật khẩu.
      </p>
      <div className="forgot-fields">
        <label>
          Địa chỉ email
          <input type="email" placeholder="an.nguyen@example.com" required />
        </label>
        <button className="button primary large w-full" type="submit">
          Gửi liên kết khôi phục
        </button>
      </div>
      <div className="forgot-success">
        <span>
          <Check size={20} />
        </span>
        <div>
          <strong>Kiểm tra hộp thư của bạn</strong>
          <p>
            Liên kết khôi phục đã được gửi. Liên kết có hiệu lực trong 15 phút.
          </p>
        </div>
      </div>
      <p className="register-link">
        Đã nhớ mật khẩu?{" "}
        <button type="button" onClick={handleLogin}>
          Đăng nhập
        </button>
      </p>
    </form>
  );
}

export default ForgotPasswordForm;
