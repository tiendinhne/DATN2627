import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type WhiteboardDocument = Whiteboard & Document;

@Schema({ timestamps: true, collection: 'whiteboards' })
export class Whiteboard {
  @Prop({ type: Types.ObjectId, ref: 'Meeting', required: true, unique: true })
  meetingId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Room', required: true, index: true })
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

  @Prop({ type: Types.ObjectId, ref: 'Meeting', default: null })
  clonedFrom?: Types.ObjectId | null;

  @Prop({ default: null })
  lastPersistedAt?: Date | null;
}

export const WhiteboardSchema = SchemaFactory.createForClass(Whiteboard);

WhiteboardSchema.index({ meetingId: 1 }, { unique: true });
WhiteboardSchema.index({ roomId: 1, updatedAt: -1 });
