import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { RoomMember, RoomMemberSchema } from './schemas/room-member.schema.js';
import { Room, RoomSchema } from '../rooms/schemas/room.schema.js';
import { Meeting, MeetingSchema } from '../meetings/schemas/meeting.schema.js';
import { RoomAccessService } from './room-access.service.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: RoomMember.name, schema: RoomMemberSchema },
      // Room và Meeting cần cho RoomAccessService
      { name: Room.name, schema: RoomSchema },
      { name: Meeting.name, schema: MeetingSchema },
    ]),
  ],
  providers: [RoomAccessService],
  exports: [RoomAccessService],
})
export class RoomMembersModule {}
