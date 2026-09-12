import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { RoomStatus } from '@datn/shared';

@Schema({ timestamps: true, collection: 'rooms' })
export class Room {
  @Prop({ required: true, trim: true, maxlength: 100 })
  name: string;

  @Prop({ default: '', maxlength: 500 })
  description: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  ownerId: Types.ObjectId;

  /** 8 ký tự base32, ngẫu nhiên, KHÔNG tuần tự (chống dò) */
  @Prop({ required: true, unique: true, uppercase: true })
  joinCode: string;

  @Prop({ type: String, enum: RoomStatus, default: RoomStatus.ACTIVE })
  status: RoomStatus;

  /** thay đổi không thường xuyên -> denormalize an toàn bằng $inc (atomic) */
  @Prop({ default: 0 })
  memberCount: number;

  @Prop({ default: 0 })
  meetingCount: number;

  @Prop({ type: Date, default: null })
  dissolvedAt: Date | null;

  @Prop({ type: Date, default: null })
  deletedAt: Date | null;
}

export type RoomDocument = HydratedDocument<Room>;
export const RoomSchema = SchemaFactory.createForClass(Room);

RoomSchema.index({ ownerId: 1, status: 1 });
RoomSchema.index({ status: 1, updatedAt: -1 });
