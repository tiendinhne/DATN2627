import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Room, RoomSchema } from './schemas/room.schema.js';
import { File, FileSchema } from './schemas/file.schema.js';
import { RoomMember, RoomMemberSchema } from '../room-members/schemas/room-member.schema.js';
import { RoomMembersModule } from '../room-members/room-members.module.js';
import { RoomsController } from './rooms.controller.js';
import { RoomsService } from './rooms.service.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Room.name, schema: RoomSchema },
      { name: File.name, schema: FileSchema },
      { name: RoomMember.name, schema: RoomMemberSchema },
    ]),
    // Lấy RoomAccessService để kiểm quyền
    RoomMembersModule,
  ],
  controllers: [RoomsController],
  providers: [RoomsService],
})
export class RoomsModule {}
