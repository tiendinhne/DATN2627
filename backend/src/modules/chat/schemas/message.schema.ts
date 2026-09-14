import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

enum MessageType {
  TEXT = 'TEXT',
  FILE = 'FILE',
  SYSTEM = 'SYSTEM',
}

@Schema({ timestamps: true, collection: 'messages' })
export class Message {
  @Prop({ type: Types.ObjectId, ref: 'Meeting', required: true })
  meetingId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Room', required: true })
  roomId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  senderId: Types.ObjectId;

  @Prop({ required: true, maxlength: 60 })
  senderName: string;

  @Prop({ type: String, enum: MessageType, default: MessageType.TEXT })
  type: MessageType;

  @Prop({ default: '', maxlength: 2000 })
  content: string;

  @Prop({ type: Types.ObjectId, ref: 'File', default: null })
  fileId: Types.ObjectId | null;

  @Prop({ required: true })
  clientMsgId: string;

  @Prop({ type: Date, default: null })
  deletedAt: Date | null;
}

export type MessageDocument = HydratedDocument<Message>;
export const MessageSchema = SchemaFactory.createForClass(Message);

MessageSchema.index({ meetingId: 1, createdAt: -1 });
MessageSchema.index({ meetingId: 1, clientMsgId: 1 }, { unique: true });
MessageSchema.index({ roomId: 1, createdAt: -1 });
