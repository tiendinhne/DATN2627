import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { RoomRole } from '../../../shared/enums.js';

export type ParticipantSessionDocument = ParticipantSession & Document;
export type MeetingParticipantDocument = MeetingParticipant & Document;

@Schema({ _id: false })
export class ParticipantSession {
  @Prop({ required: true })
  joinedAt!: Date;

  @Prop({ type: Date, required: false, default: null })
  leftAt?: Date | null;
}

@Schema({ timestamps: true, collection: 'meeting_participants' })
export class MeetingParticipant {
  @Prop({ type: Types.ObjectId, ref: 'Meeting', required: true, index: true })
  meetingId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId!: Types.ObjectId;

  @Prop({ required: true, maxlength: 60 })
  displayName!: string;

  @Prop({ type: String, enum: RoomRole, required: true })
  roleAtJoin!: RoomRole;

  @Prop({ type: [ParticipantSession], default: [] })
  sessions?: ParticipantSession[];

  @Prop({ default: 0 })
  totalDurationSeconds?: number;
}

const ParticipantSessionSchema = SchemaFactory.createForClass(ParticipantSession);
export const MeetingParticipantSchema = SchemaFactory.createForClass(MeetingParticipant);

MeetingParticipantSchema.add({ sessions: [ParticipantSessionSchema] });
MeetingParticipantSchema.index({ meetingId: 1, userId: 1 }, { unique: true });
