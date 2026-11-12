import { Transform } from 'class-transformer';
import { IsEnum, IsMongoId, IsString, Length, Matches } from 'class-validator';
import { AiRequestKind } from '../../../shared/enums.js';
import { AI_PROMPT_MAX_LENGTH, AI_PROMPT_MIN_LENGTH } from '../../../shared/ai.js';

// ai:generate (spec AI §3.1) — validatePayload của gateway bật whitelist + forbidNonWhitelisted
export class AiGenerateDto {
  @IsMongoId()
  meetingId!: string;

  // Client sinh bằng crypto.randomUUID() — chống ghi trùng ai_requests (unique userId + requestId)
  @IsString()
  @Matches(/^[A-Za-z0-9-]{8,64}$/)
  requestId!: string;

  // Cắt khoảng trắng hai đầu TRƯỚC khi đếm độ dài
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(AI_PROMPT_MIN_LENGTH, AI_PROMPT_MAX_LENGTH)
  prompt!: string;

  @IsEnum(AiRequestKind)
  kind!: AiRequestKind;
}
