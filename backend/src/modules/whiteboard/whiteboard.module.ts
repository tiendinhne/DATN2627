import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Whiteboard, WhiteboardSchema } from './schemas/whiteboard.schema.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Whiteboard.name, schema: WhiteboardSchema },
    ]),
  ],
})
export class WhiteboardModule {}
