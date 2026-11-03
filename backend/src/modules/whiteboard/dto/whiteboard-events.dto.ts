import { IsArray, IsMongoId, IsNumber, Max, Min } from 'class-validator';

// meeting:join, meeting:leave
export class MeetingIdDto {
  @IsMongoId()
  meetingId!: string;
}

// wb:ops — từng element kiểm bằng validateElementsBatch (không dùng DTO lồng: whitelist sẽ xoá field của Excalidraw)
export class WbOpsDto {
  @IsMongoId()
  meetingId!: string;

  @IsArray()
  elements!: unknown[];
}

// wb:pointer — toạ độ canvas, số hữu hạn trong ±1e7
export class WbPointerDto {
  @IsMongoId()
  meetingId!: string;

  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(-1e7)
  @Max(1e7)
  x!: number;

  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(-1e7)
  @Max(1e7)
  y!: number;
}
