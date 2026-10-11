import { Transform } from 'class-transformer';
import { IsString, MaxLength, MinLength } from 'class-validator';

// Bỏ khoảng trắng 2 đầu trước khi validate (tên toàn dấu cách = rỗng)
const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class StartMeetingDto {
  // Bắt buộc. HOST bỏ trống thì frontend gửi "Buổi học dd/MM HH:mm" theo giờ trình duyệt → backend không xử lý múi giờ (spec §5.2)
  @Transform(trim)
  @IsString()
  @MinLength(1, { message: 'Tên buổi học không được để trống' })
  @MaxLength(100, { message: 'Tên buổi học tối đa 100 ký tự' })
  title!: string;
}
