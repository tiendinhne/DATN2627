import {
  IsMongoId,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class ChatSendDto {
  @IsMongoId()
  roomId!: string;

  @IsUUID()
  clientMsgId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  content?: string;

  @IsOptional()
  @IsMongoId()
  fileId?: string;

  @IsOptional()
  @IsMongoId()
  meetingId?: string;
}
