import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Room, RoomSchema } from './schemas/room.schema.js';
import { File, FileSchema } from './schemas/file.schema.js';
import { RoomMember, RoomMemberSchema } from '../room-members/schemas/room-member.schema.js';
import { RoomMembersModule } from '../room-members/room-members.module.js';
import { User, UserSchema } from '../users/schemas/user.schema.js';
import { RoomsController } from './rooms.controller.js';
import { RoomsService } from './rooms.service.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Room.name, schema: RoomSchema },
      { name: File.name, schema: FileSchema },
      { name: RoomMember.name, schema: RoomMemberSchema },
      // Tìm user theo email khi HOST thêm thành viên
      { name: User.name, schema: UserSchema },
    ]),
    // Lấy RoomAccessService để kiểm quyền
    RoomMembersModule,
  ],
  controllers: [RoomsController],
  providers: [RoomsService],
})
export class RoomsModule {}
