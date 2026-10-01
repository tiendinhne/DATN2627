import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Meeting, MeetingSchema } from './schemas/meeting.schema.js';
import { MeetingParticipant, MeetingParticipantSchema } from './schemas/meeting-participant.schema.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Meeting.name, schema: MeetingSchema },
      { name: MeetingParticipant.name, schema: MeetingParticipantSchema },
    ]),
  ],
})
export class MeetingsModule {}
