import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsMongoId,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export const MAX_CHAT_FILE_SIZE_BYTES = 20 * 1024 * 1024;
export const CHAT_FILE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
  'text/plain',
  'text/csv',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
] as const;

export class CreateUploadDto {
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  originalName!: string;

  @IsString()
  @IsIn(CHAT_FILE_MIME_TYPES)
  mimeType!: (typeof CHAT_FILE_MIME_TYPES)[number];

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_CHAT_FILE_SIZE_BYTES)
  sizeBytes!: number;

  @IsOptional()
  @IsMongoId()
  meetingId?: string;
}
