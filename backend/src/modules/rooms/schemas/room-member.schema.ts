import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

enum RoomRole {
  HOST = 'HOST',
  CO_HOST = 'CO_HOST',
  MEMBER = 'MEMBER',
  VIEWER = 'VIEWER',
}

@Schema({ timestamps: true, collection: 'room_members' })
export class RoomMember {
  @Prop({ type: Types.ObjectId, ref: 'Room', required: true })
  roomId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ type: String, enum: RoomRole, default: RoomRole.MEMBER })
  role: RoomRole;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  invitedBy: Types.ObjectId | null;

  @Prop({ default: false })
  isBanned: boolean;

  @Prop({ type: Date, default: Date.now })
  joinedAt: Date;
}

export type RoomMemberDocument = HydratedDocument<RoomMember>;
export const RoomMemberSchema = SchemaFactory.createForClass(RoomMember);

RoomMemberSchema.index({ roomId: 1, userId: 1 }, { unique: true });
RoomMemberSchema.index({ userId: 1, joinedAt: -1 });
RoomMemberSchema.index({ roomId: 1, role: 1 });
