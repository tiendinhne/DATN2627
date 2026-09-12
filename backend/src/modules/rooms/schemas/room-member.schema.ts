import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { RoomRole } from '@datn/shared';

/**
 * Collection riêng chứ không embed vào rooms: query "các room của user X"
 * là query chạy nhiều nhất ở trang chủ. Embed thì phải scan toàn bộ rooms.
 */
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

/** nền tảng cho import idempotent: import trùng email -> duplicate key -> bỏ qua */
RoomMemberSchema.index({ roomId: 1, userId: 1 }, { unique: true });
RoomMemberSchema.index({ userId: 1, joinedAt: -1 });
RoomMemberSchema.index({ roomId: 1, role: 1 });
