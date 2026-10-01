import { Module } from '@nestjs/common';
import { MeetingGateway } from './gateways/meeting.gateway.js';

@Module({
  providers: [MeetingGateway],
})
export class RealtimeModule {}
