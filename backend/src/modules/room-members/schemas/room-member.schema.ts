import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { RoomRole } from '../../../shared/enums.js';

export type RoomMemberDocument = RoomMember & Document;

@Schema({ timestamps: true, collection: 'room_members' })
export class RoomMember {
  @Prop({ type: Types.ObjectId, ref: 'Room', required: true, index: true })
  roomId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId!: Types.ObjectId;

  @Prop({ type: String, enum: RoomRole, default: RoomRole.MEMBER })
  role!: RoomRole;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  invitedBy?: Types.ObjectId | null;

  @Prop({ default: () => new Date() })
  joinedAt?: Date;
}

export const RoomMemberSchema = SchemaFactory.createForClass(RoomMember);

RoomMemberSchema.index({ roomId: 1, userId: 1 }, { unique: true });
RoomMemberSchema.index({ userId: 1, joinedAt: -1 });
RoomMemberSchema.index({ roomId: 1, role: 1 });
