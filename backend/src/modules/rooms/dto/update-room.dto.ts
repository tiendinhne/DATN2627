import { Transform } from 'class-transformer';
import { IsString, MaxLength, MinLength, ValidateIf } from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

// Gửi field nào sửa field đó; phải có ít nhất 1 field (kiểm trong service).
// Không dùng @IsOptional vì nó bỏ qua cả null → findOneAndUpdate ghi null vào DB.
export class UpdateRoomDto {
  // Chỉ bỏ qua khi không gửi field; gửi null vẫn phải qua IsString → 400
  @ValidateIf((_, value) => value !== undefined)
  @Transform(trim)
  @IsString()
  @MinLength(1, { message: 'Tên phòng không được để trống' })
  @MaxLength(100, { message: 'Tên phòng tối đa 100 ký tự' })
  name?: string;

  @ValidateIf((_, value) => value !== undefined)
  @Transform(trim)
  @IsString()
  @MaxLength(500, { message: 'Mô tả tối đa 500 ký tự' })
  description?: string;
}
