import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

@Schema({ timestamps: true, collection: 'whiteboards' })
export class Whiteboard {
  @Prop({ type: Types.ObjectId, ref: 'Meeting', required: true, unique: true })
  meetingId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Room', required: true })
  roomId: Types.ObjectId;

  @Prop({ type: Buffer, required: true })
  elementsGzip: Buffer;

  @Prop({ default: 0 })
  elementCount: number;

  @Prop({ default: 0 })
  rawSizeBytes: number;

  @Prop({ required: true, default: 0 })
  lastSeq: number;

  @Prop({ type: Object, default: {} })
  appState: Record<string, unknown>;

  @Prop({ type: Types.ObjectId, ref: 'Meeting', default: null })
  clonedFrom: Types.ObjectId | null;

  @Prop({ type: Date, default: null })
  lastPersistedAt: Date | null;
}

export type WhiteboardDocument = HydratedDocument<Whiteboard>;
export const WhiteboardSchema = SchemaFactory.createForClass(Whiteboard);

WhiteboardSchema.index({ roomId: 1, updatedAt: -1 });
