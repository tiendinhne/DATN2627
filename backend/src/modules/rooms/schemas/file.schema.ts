import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
// Field tham chiếu dùng SchemaTypes.ObjectId: Types.ObjectId bị @nestjs/mongoose biến thành Mixed (không ép kiểu)
import { Document, SchemaTypes, Types } from 'mongoose';
import { FilePurpose } from '../../../shared/enums.js';

export type FileDocument = File & Document;

@Schema({ timestamps: true, collection: 'files' })
export class File {
  @Prop({ required: true, unique: true })
  storageKey!: string;

  @Prop({ required: true, maxlength: 255 })
  originalName!: string;

  @Prop({ required: true })
  mimeType!: string;

  @Prop({ required: true })
  sizeBytes!: number;

  @Prop({ type: String, enum: FilePurpose, required: true })
  purpose!: FilePurpose;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: true, index: true })
  uploaderId!: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Meeting', default: null, index: true })
  meetingId?: Types.ObjectId | null;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Room', default: null })
  roomId?: Types.ObjectId | null;

  @Prop({ type: Date, required: false, default: null })
  deletedAt?: Date | null;
}

export const FileSchema = SchemaFactory.createForClass(File);

FileSchema.index({ meetingId: 1, createdAt: -1 });
