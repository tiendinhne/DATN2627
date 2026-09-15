import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { RoomMember, RoomMemberSchema } from './schemas/room-member.schema.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: RoomMember.name, schema: RoomMemberSchema },
    ]),
  ],
})
export class RoomMembersModule {}
