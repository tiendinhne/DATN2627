import { Transform } from 'class-transformer';
import { IsString, Matches } from 'class-validator';

export class JoinRoomDto {
  // Cho phép người dùng gõ chữ thường / thừa dấu cách
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @IsString()
  @Matches(/^[A-Z2-7]{8}$/, { message: 'Mã phòng gồm 8 ký tự (A–Z, 2–7)' })
  code!: string;
}
