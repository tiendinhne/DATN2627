import { Transform } from 'class-transformer';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateProfileDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1, { message: 'Tên hiển thị không được để trống' })
  @MaxLength(20, { message: 'Tên hiển thị tối đa 20 ký tự' })
  displayName!: string;
}
