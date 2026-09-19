import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { RoomStatus } from '../../../shared/enums.js';

export type RoomDocument = Room & Document;

@Schema({ timestamps: true, collection: 'rooms' })
export class Room {
  @Prop({ required: true, trim: true, maxlength: 100 })
  name!: string;

  @Prop({ default: '', maxlength: 500 })
  description?: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  ownerId!: Types.ObjectId;

  @Prop({ required: true, unique: true, uppercase: true })
  joinCode!: string;

  @Prop({ type: String, enum: RoomStatus, default: RoomStatus.ACTIVE, index: true })
  status!: RoomStatus;

  @Prop({ default: 0 })
  memberCount?: number;

  @Prop({ default: 0 })
  meetingCount?: number;

  @Prop({ type: Date, required: false, default: null })
  dissolvedAt?: Date | null;

  @Prop({ type: Date, required: false, default: null })
  deletedAt?: Date | null;
}

export const RoomSchema = SchemaFactory.createForClass(Room);

RoomSchema.index({ ownerId: 1, status: 1 });
RoomSchema.index({ status: 1, updatedAt: -1 });
