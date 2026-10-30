import { Type } from 'class-transformer';
import { IsInt, IsMongoId, IsOptional, Max, Min } from 'class-validator';

export class ListMessagesQueryDto {
  @IsOptional()
  @IsMongoId()
  before?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 50;

  @IsOptional()
  @IsMongoId()
  meetingId?: string;
}
