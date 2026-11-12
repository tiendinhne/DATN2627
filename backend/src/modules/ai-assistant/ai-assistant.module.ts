import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AiRequest, AiRequestSchema } from './schemas/ai-request.schema.js';
import { AiAssistantService } from './ai-assistant.service.js';
import { AI_PROVIDER_PORT } from './ports/ai-provider.port.js';
import { GeminiAiProviderAdapter } from './adapters/gemini-ai-provider.adapter.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AiRequest.name, schema: AiRequestSchema },
    ]),
  ],
  // Port "ai-provider" cài bằng Gemini — đổi vendor chỉ đổi useClass (ràng buộc 9). RedisService là module global
  providers: [AiAssistantService, { provide: AI_PROVIDER_PORT, useClass: GeminiAiProviderAdapter }],
  // RealtimeModule (gateway ai:generate) dùng
  exports: [AiAssistantService],
})
export class AiAssistantModule {}
