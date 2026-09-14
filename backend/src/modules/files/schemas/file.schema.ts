import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

enum FilePurpose {
  CHAT_ATTACHMENT = 'CHAT_ATTACHMENT',
  AVATAR = 'AVATAR',
  WHITEBOARD_IMAGE = 'WHITEBOARD_IMAGE',
}

@Schema({ timestamps: true, collection: 'files' })
export class File {
  @Prop({ required: true, unique: true })
  storageKey: string;

  @Prop({ required: true, maxlength: 255 })
  originalName: string;

  @Prop({ required: true })
  mimeType: string;

  @Prop({ required: true })
  sizeBytes: number;

  @Prop({ type: String, enum: FilePurpose, required: true })
  purpose: FilePurpose;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  uploaderId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Meeting', default: null })
  meetingId: Types.ObjectId | null;

  @Prop({ type: Types.ObjectId, ref: 'Room', default: null })
  roomId: Types.ObjectId | null;

  @Prop({ type: Date, default: null })
  deletedAt: Date | null;
}

export type FileDocument = HydratedDocument<File>;
export const FileSchema = SchemaFactory.createForClass(File);

FileSchema.index({ meetingId: 1, createdAt: -1 });
