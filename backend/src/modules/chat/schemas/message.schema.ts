import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { MessageType } from '../../../shared/enums.js';

export type MessageDocument = Message & Document;

@Schema({ timestamps: true, collection: 'messages' })
export class Message {
  // Chat thuộc về room — đây là khoá sở hữu chính
  @Prop({ type: Types.ObjectId, ref: 'Room', required: true })
  roomId!: Types.ObjectId;

  // Tag meeting: chỉ server gắn khi tin được gửi từ khung chat trong họp, còn lại null
  @Prop({ type: Types.ObjectId, ref: 'Meeting', default: null })
  meetingId?: Types.ObjectId | null;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  senderId!: Types.ObjectId;

  @Prop({ required: true, maxlength: 60 })
  senderName!: string;

  @Prop({ type: String, enum: MessageType, default: MessageType.TEXT })
  type!: MessageType;

  @Prop({ default: '', maxlength: 2000 })
  content?: string;

  @Prop({ type: Types.ObjectId, ref: 'File', default: null })
  fileId?: Types.ObjectId | null;

  @Prop({ required: true })
  clientMsgId!: string;

  @Prop({ type: Date, required: false, default: null })
  deletedAt?: Date | null;
}

export const MessageSchema = SchemaFactory.createForClass(Message);

// Luồng chat của room — query dùng nhiều nhất
MessageSchema.index({ roomId: 1, createdAt: -1 });
// Chống gửi trùng khi client reconnect gửi lại
MessageSchema.index({ roomId: 1, clientMsgId: 1 }, { unique: true });
// Khung chat trong meeting — chỉ index tin có tag meeting
MessageSchema.index(
  { meetingId: 1, createdAt: -1 },
  { partialFilterExpression: { meetingId: { $type: 'objectId' } } },
);
