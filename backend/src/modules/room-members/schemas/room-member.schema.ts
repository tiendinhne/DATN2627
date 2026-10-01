import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
// Field tham chiếu dùng SchemaTypes.ObjectId: Types.ObjectId bị @nestjs/mongoose biến thành Mixed (không ép kiểu)
import { Document, SchemaTypes, Types } from 'mongoose';
import { RoomRole } from '../../../shared/enums.js';

export type RoomMemberDocument = RoomMember & Document;

@Schema({ timestamps: true, collection: 'room_members' })
export class RoomMember {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'Room', required: true, index: true })
  roomId!: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: true, index: true })
  userId!: Types.ObjectId;

  @Prop({ type: String, enum: RoomRole, default: RoomRole.MEMBER })
  role!: RoomRole;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', default: null })
  invitedBy?: Types.ObjectId | null;

  @Prop({ default: () => new Date() })
  joinedAt?: Date;
}

export const RoomMemberSchema = SchemaFactory.createForClass(RoomMember);

RoomMemberSchema.index({ roomId: 1, userId: 1 }, { unique: true });
RoomMemberSchema.index({ userId: 1, joinedAt: -1 });
RoomMemberSchema.index({ roomId: 1, role: 1 });
