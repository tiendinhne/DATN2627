import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

enum RoomRole {
  HOST = 'HOST',
  CO_HOST = 'CO_HOST',
  MEMBER = 'MEMBER',
  VIEWER = 'VIEWER',
}

@Schema({ _id: false })
export class ParticipantSession {
  @Prop({ type: Date, required: true })
  joinedAt: Date;

  @Prop({ type: Date, default: null })
  leftAt: Date | null;
}

const ParticipantSessionSchema = SchemaFactory.createForClass(ParticipantSession);

@Schema({ timestamps: true, collection: 'meeting_participants' })
export class MeetingParticipant {
  @Prop({ type: Types.ObjectId, ref: 'Meeting', required: true })
  meetingId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ required: true, maxlength: 60 })
  displayName: string;

  @Prop({ type: String, enum: RoomRole, required: true })
  roleAtJoin: RoomRole;

  @Prop({ type: [ParticipantSessionSchema], default: [] })
  sessions: ParticipantSession[];

  @Prop({ default: 0 })
  totalDurationSeconds: number;
}

export type MeetingParticipantDocument = HydratedDocument<MeetingParticipant>;
export const MeetingParticipantSchema = SchemaFactory.createForClass(MeetingParticipant);

MeetingParticipantSchema.index({ meetingId: 1, userId: 1 }, { unique: true });
