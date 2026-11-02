import { Transform } from 'class-transformer';
import { IsString, MaxLength, MinLength } from 'class-validator';

// PATCH /users/me — cùng luật displayName với lúc đăng ký (RegisterDto: 1–20 ký tự)
export class UpdateProfileDto {
  // Trim trước khi kiểm → toàn dấu cách bị chặn bởi MinLength
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1, { message: 'Display name không được để trống' })
  @MaxLength(20, { message: 'Display name tối đa 20 ký tự' })
  displayName!: string;
}
