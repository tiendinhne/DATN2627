import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

// Bỏ khoảng trắng 2 đầu trước khi validate (tên toàn dấu cách = rỗng)
const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class CreateRoomDto {
  @Transform(trim)
  @IsString()
  @MinLength(1, { message: 'Tên phòng không được để trống' })
  @MaxLength(100, { message: 'Tên phòng tối đa 100 ký tự' })
  name!: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(500, { message: 'Mô tả tối đa 500 ký tự' })
  description?: string;
}
