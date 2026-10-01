import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
// Field tham chiếu dùng SchemaTypes.ObjectId: Types.ObjectId bị @nestjs/mongoose biến thành Mixed (không ép kiểu)
import { Document, SchemaTypes, Types } from 'mongoose';

export type WhiteboardDocument = Whiteboard & Document;

@Schema({ timestamps: true, collection: 'whiteboards' })
export class Whiteboard {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'Meeting', required: true, unique: true })
  meetingId!: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Room', required: true, index: true })
  roomId!: Types.ObjectId;

  @Prop({ type: Buffer, required: true })
  elementsGzip!: Buffer;

  @Prop({ default: 0 })
  elementCount?: number;

  @Prop({ default: 0 })
  rawSizeBytes?: number;

  @Prop({ required: true, default: 0 })
  lastSeq!: number;

  @Prop({ type: Object, default: {} })
  appState?: Record<string, any>;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Meeting', default: null })
  clonedFrom?: Types.ObjectId | null;

  @Prop({ type: Date, required: false, default: null })
  lastPersistedAt?: Date | null;
}

export const WhiteboardSchema = SchemaFactory.createForClass(Whiteboard);

WhiteboardSchema.index({ roomId: 1, updatedAt: -1 });
