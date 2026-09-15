import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Room, RoomSchema } from './schemas/room.schema.js';
import { File, FileSchema } from './schemas/file.schema.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Room.name, schema: RoomSchema },
      { name: File.name, schema: FileSchema },
    ]),
  ],
})
export class RoomsModule {}
