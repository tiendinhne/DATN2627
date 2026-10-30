import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PassportModule } from '@nestjs/passport';
import { RoomMembersModule } from '../room-members/room-members.module.js';
import { Meeting, MeetingSchema } from '../meetings/schemas/meeting.schema.js';
import { File, FileSchema } from '../rooms/schemas/file.schema.js';
import { ChatController } from './chat.controller.js';
import { ChatService } from './chat.service.js';
import { S3ObjectStorageAdapter } from './adapters/s3-object-storage.adapter.js';
import { Message, MessageSchema } from './schemas/message.schema.js';
import { OBJECT_STORAGE_PORT } from './ports/object-storage.port.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Message.name, schema: MessageSchema },
      { name: File.name, schema: FileSchema },
      { name: Meeting.name, schema: MeetingSchema },
    ]),
    RoomMembersModule,
    PassportModule.register({ session: false }),
  ],
  controllers: [ChatController],
  providers: [
    ChatService,
    { provide: OBJECT_STORAGE_PORT, useClass: S3ObjectStorageAdapter },
  ],
  exports: [ChatService],
})
export class ChatModule {}
