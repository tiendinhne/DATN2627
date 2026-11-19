import { Transform, Type } from 'class-transformer';
import {
  IsInt,
  IsMongoId,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

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

  @IsOptional()
  @IsMongoId()
  around?: string;
}

export class SearchMessagesQueryDto {
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  q!: string;

  @IsOptional()
  @IsMongoId()
  before?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit = 20;
}
