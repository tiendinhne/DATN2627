import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { EndReason, MeetingMode, MeetingStatus } from '@datn/shared';

/** LiveKit room name = meeting._id.toString(). Không tạo field riêng, tránh lệch dữ liệu. */
@Schema({ timestamps: true, collection: 'meetings' })
export class Meeting {
  @Prop({ type: Types.ObjectId, ref: 'Room', required: true })
  roomId: Types.ObjectId;

  @Prop({ required: true, trim: true, maxlength: 100 })
  title: string;

  @Prop({ type: String, enum: MeetingStatus, default: MeetingStatus.ACTIVE })
  status: MeetingStatus;

  @Prop({ type: String, enum: MeetingMode, default: MeetingMode.DISCUSSION })
  mode: MeetingMode;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  createdBy: Types.ObjectId;

  @Prop({ type: Date, default: Date.now })
  startedAt: Date;

  @Prop({ type: Date, default: null })
  endedAt: Date | null;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  endedBy: Types.ObjectId | null;

  @Prop({ type: String, enum: EndReason, default: null })
  endReason: EndReason | null;

  // --- thống kê: chỉ ghi MỘT LẦN khi meeting kết thúc.
  // Số người đang online thay đổi liên tục -> nằm ở Redis, không ở đây.
  @Prop({ default: 0 }) peakParticipants: number;
  @Prop({ default: 0 }) totalParticipants: number;
  @Prop({ default: 0 }) messageCount: number;
  @Prop({ default: 0 }) durationSeconds: number;
}

export type MeetingDocument = HydratedDocument<Meeting>;
export const MeetingSchema = SchemaFactory.createForClass(Meeting);

MeetingSchema.index({ roomId: 1, startedAt: -1 });
MeetingSchema.index({ status: 1, startedAt: 1 });

/**
 * Enforce "1 room chỉ có 1 meeting ACTIVE" ở TẦNG DB.
 * Application logic không đảm bảo được điều này khi chạy nhiều instance.
 */
MeetingSchema.index(
  { roomId: 1 },
  { unique: true, partialFilterExpression: { status: MeetingStatus.ACTIVE } },
);
