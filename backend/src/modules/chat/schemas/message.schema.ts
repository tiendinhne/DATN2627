import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { MessageType } from '@datn/shared';

@Schema({ timestamps: true, collection: 'messages' })
export class Message {
  @Prop({ type: Types.ObjectId, ref: 'Meeting', required: true })
  meetingId: Types.ObjectId;

  /** denormalize để export theo room không cần join qua meetings */
  @Prop({ type: Types.ObjectId, ref: 'Room', required: true })
  roomId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  senderId: Types.ObjectId;

  /** SNAPSHOT tên lúc gửi — tin nhắn cũ giữ tên cũ, và tránh populate N+1 khi load 50 tin */
  @Prop({ required: true, maxlength: 60 })
  senderName: string;

  @Prop({ type: String, enum: MessageType, default: MessageType.TEXT })
  type: MessageType;

  @Prop({ default: '', maxlength: 2000 })
  content: string;

  @Prop({ type: Types.ObjectId, ref: 'File', default: null })
  fileId: Types.ObjectId | null;

  /** do client sinh -> chống gửi trùng khi reconnect */
  @Prop({ required: true })
  clientMsgId: string;

  @Prop({ type: Date, default: null })
  deletedAt: Date | null;
}

export type MessageDocument = HydratedDocument<Message>;
export const MessageSchema = SchemaFactory.createForClass(Message);

MessageSchema.index({ meetingId: 1, createdAt: -1 });
/** idempotent ở TẦNG DB: không cần viết logic dedupe trong application */
MessageSchema.index({ meetingId: 1, clientMsgId: 1 }, { unique: true });
MessageSchema.index({ roomId: 1, createdAt: -1 });
