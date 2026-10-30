import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { ChatService } from './chat.service.js';
import { CreateUploadDto } from './dto/create-upload.dto.js';
import { ListMessagesQueryDto } from './dto/list-messages-query.dto.js';

@UseGuards(JwtAuthGuard)
@Controller('rooms')
export class ChatController {
  constructor(private readonly chat: ChatService) {}

  @Get(':roomId/messages')
  listMessages(
    @Req() req: any,
    @Param('roomId') roomId: string,
    @Query() query: ListMessagesQueryDto,
  ) {
    return this.chat.listMessages(req.user.id, roomId, query);
  }

  @Post(':roomId/uploads')
  createUpload(
    @Req() req: any,
    @Param('roomId') roomId: string,
    @Body() dto: CreateUploadDto,
  ) {
    return this.chat.createUpload(req.user.id, roomId, dto);
  }

  @Post(':roomId/uploads/:fileId/complete')
  @HttpCode(200)
  completeUpload(
    @Req() req: any,
    @Param('roomId') roomId: string,
    @Param('fileId') fileId: string,
  ) {
    return this.chat.completeUpload(req.user.id, roomId, fileId);
  }

  @Get(':roomId/files/:fileId/download-url')
  createDownloadUrl(
    @Req() req: any,
    @Param('roomId') roomId: string,
    @Param('fileId') fileId: string,
  ) {
    return this.chat.createDownloadUrl(req.user.id, roomId, fileId);
  }
}
