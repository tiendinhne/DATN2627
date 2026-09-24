import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { AiRequestKind, AiRequestStatus } from '../../../shared/enums.js';

export type AiRequestDocument = AiRequest & Document;

// Log mỗi lần gọi AI. Chỉ insert một lần khi request kết thúc, không update.
@Schema({ timestamps: { createdAt: true, updatedAt: false }, collection: 'ai_requests' })
export class AiRequest {
  // Do client sinh trong ai:generate — chống ghi trùng khi gửi lại
  @Prop({ required: true, maxlength: 64 })
  requestId!: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Room', required: true })
  roomId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Meeting', required: true })
  meetingId!: Types.ObjectId;

  @Prop({ type: String, enum: AiRequestKind, required: true })
  kind!: AiRequestKind;

  // Service cắt còn 1000 ký tự trước khi lưu
  @Prop({ required: true, maxlength: 1000 })
  prompt!: string;

  @Prop({ type: String, enum: AiRequestStatus, required: true })
  status!: AiRequestStatus;

  // Mã lỗi ngắn, không lưu stack trace
  @Prop({ type: String, default: null, maxlength: 64 })
  errorCode?: string | null;

  @Prop({ required: true, min: 0 })
  latencyMs!: number;

  @Prop({ required: true })
  model!: string;

  // null nếu provider không trả số token
  @Prop({ type: Number, default: null })
  inputTokens?: number | null;

  @Prop({ type: Number, default: null })
  outputTokens?: number | null;

  // Số element sinh ra; 0 nếu thất bại
  @Prop({ default: 0, min: 0 })
  elementCount?: number;
}

export const AiRequestSchema = SchemaFactory.createForClass(AiRequest);

AiRequestSchema.index({ createdAt: -1 });
AiRequestSchema.index({ meetingId: 1, createdAt: -1 });
AiRequestSchema.index({ status: 1, createdAt: -1 });
AiRequestSchema.index({ userId: 1, requestId: 1 }, { unique: true });
