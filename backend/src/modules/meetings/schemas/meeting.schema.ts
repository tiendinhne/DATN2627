import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { MeetingStatus, MeetingMode, EndReason } from '../../../shared/enums.js';

export type MeetingDocument = Meeting & Document;

@Schema({ timestamps: true, collection: 'meetings' })
export class Meeting {
  @Prop({ type: Types.ObjectId, ref: 'Room', required: true })
  roomId!: Types.ObjectId;

  @Prop({ required: true, trim: true, maxlength: 100 })
  title!: string;

  @Prop({ type: String, enum: MeetingStatus, default: MeetingStatus.ACTIVE })
  status!: MeetingStatus;

  @Prop({ type: String, enum: MeetingMode, default: MeetingMode.DISCUSSION })
  mode!: MeetingMode;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  createdBy!: Types.ObjectId;

  @Prop({ default: () => new Date() })
  startedAt?: Date;

  @Prop({ type: Date, required: false, default: null })
  endedAt?: Date | null;

  @Prop({ type: Types.ObjectId, ref: 'User', required: false, default: null })
  endedBy?: Types.ObjectId | null;

  @Prop({ type: String, enum: EndReason, required: false, default: null })
  endReason?: EndReason | null;

  @Prop({ default: 0 })
  peakParticipants?: number;

  @Prop({ default: 0 })
  totalParticipants?: number;

  @Prop({ default: 0 })
  messageCount?: number;

  @Prop({ default: 0 })
  durationSeconds?: number;
}

export const MeetingSchema = SchemaFactory.createForClass(Meeting);

MeetingSchema.index({ roomId: 1, startedAt: -1 });
MeetingSchema.index(
  { roomId: 1 },
  { unique: true, partialFilterExpression: { status: MeetingStatus.ACTIVE } },
);
MeetingSchema.index({ status: 1, startedAt: 1 });
