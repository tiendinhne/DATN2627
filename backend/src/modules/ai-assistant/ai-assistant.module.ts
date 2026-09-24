import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AiRequest, AiRequestSchema } from './schemas/ai-request.schema.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AiRequest.name, schema: AiRequestSchema },
    ]),
  ],
})
export class AiAssistantModule {}
