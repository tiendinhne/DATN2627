import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
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

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  uploaderId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Meeting', default: null, index: true })
  meetingId?: Types.ObjectId | null;

  @Prop({ type: Types.ObjectId, ref: 'Room', default: null })
  roomId?: Types.ObjectId | null;

  @Prop({ default: null })
  deletedAt?: Date | null;
}

export const FileSchema = SchemaFactory.createForClass(File);

FileSchema.index({ storageKey: 1 }, { unique: true });
FileSchema.index({ meetingId: 1, createdAt: -1 });
FileSchema.index({ uploaderId: 1 });
