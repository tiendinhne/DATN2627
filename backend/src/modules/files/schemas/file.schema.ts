import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { FilePurpose } from '@datn/shared';

/**
 * Mongo CHỈ lưu metadata. File nằm ở object storage (bắt buộc vì backend stateless).
 * Tải về bằng presigned URL có hạn — KHÔNG để bucket public, nếu không ai có link cũng tải được.
 */
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
