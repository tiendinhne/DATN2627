import { IsOptional, IsString, MinLength } from 'class-validator';

// POST /auth/password — đổi mật khẩu, hoặc đặt lần đầu cho tài khoản chỉ dùng Google
export class ChangePasswordDto {
  // Bắt buộc khi tài khoản đã có mật khẩu (service kiểm); tài khoản Google chưa có thì bỏ trống
  @IsOptional()
  @IsString()
  currentPassword?: string;

  // Cùng luật với lúc đăng ký (RegisterDto)
  @IsString()
  @MinLength(6, { message: 'Mật khẩu phải có ít nhất 6 ký tự' })
  newPassword!: string;
}
