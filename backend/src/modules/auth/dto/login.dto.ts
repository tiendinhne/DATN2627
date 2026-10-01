import { IsString } from 'class-validator';

export class LoginDto {
  // identifier có thể là email hoặc username, giống GitHub cho phép login bằng cả 2
  @IsString()
  identifier!: string;

  @IsString()
  password!: string;
}
