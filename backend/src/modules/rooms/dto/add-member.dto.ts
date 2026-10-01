import { Transform } from 'class-transformer';
import { IsEmail } from 'class-validator';

export class AddMemberDto {
  // Email trong DB lưu chữ thường (user.schema lowercase) → chuẩn hoá trước khi tìm
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail({}, { message: 'Email không hợp lệ' })
  email!: string;
}
