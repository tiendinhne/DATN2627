import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { randomUUID } from 'node:crypto';
import { Model, Types } from 'mongoose';
import { RedisService } from '../../common/services/redis.service.js';
import { FilePurpose, MessageType } from '../../shared/enums.js';
import { RoomAccessService } from '../room-members/room-access.service.js';
import { Meeting } from '../meetings/schemas/meeting.schema.js';
import type { MeetingDocument } from '../meetings/schemas/meeting.schema.js';
import { File, FileStatus } from '../rooms/schemas/file.schema.js';
import type { FileDocument } from '../rooms/schemas/file.schema.js';
import { ChatSendDto } from './dto/chat-send.dto.js';
import {
  CHAT_FILE_MIME_TYPES,
  MAX_CHAT_FILE_SIZE_BYTES,
} from './dto/create-upload.dto.js';
import { Message } from './schemas/message.schema.js';
import type { MessageDocument } from './schemas/message.schema.js';
import { OBJECT_STORAGE_PORT } from './ports/object-storage.port.js';
import type { ObjectStoragePort } from './ports/object-storage.port.js';

const UPLOAD_URL_TTL_SECONDS = 5 * 60;

const MIME_EXTENSIONS: Record<(typeof CHAT_FILE_MIME_TYPES)[number], string[]> =
  {
    'image/jpeg': ['.jpg', '.jpeg'],
    'image/png': ['.png'],
    'image/webp': ['.webp'],
    'image/gif': ['.gif'],
    'application/pdf': ['.pdf'],
    'text/plain': ['.txt'],
    'text/csv': ['.csv'],
    'application/msword': ['.doc'],
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': [
      '.docx',
    ],
    'application/vnd.ms-excel': ['.xls'],
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': [
      '.xlsx',
    ],
    'application/vnd.ms-powerpoint': ['.ppt'],
    'application/vnd.openxmlformats-officedocument.presentationml.presentation':
      ['.pptx'],
  };

function isDuplicateKey(error: unknown): boolean {
  return (error as { code?: number } | undefined)?.code === 11000;
}

export function validateChatFileMetadata(input: {
  originalName: string;
  mimeType: string;
  sizeBytes: number;
}): string {
  if (
    !Number.isInteger(input.sizeBytes) ||
    input.sizeBytes < 1 ||
    input.sizeBytes > MAX_CHAT_FILE_SIZE_BYTES
  ) {
    throw new BadRequestException('Dung lượng file phải từ 1 byte đến 20 MiB');
  }
  if (!(CHAT_FILE_MIME_TYPES as readonly string[]).includes(input.mimeType)) {
    throw new BadRequestException('MIME type không được hỗ trợ');
  }
  if (
    [...input.originalName].some(
      (char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127,
    )
  ) {
    throw new BadRequestException('Tên file không hợp lệ');
  }
  const fileName = input.originalName.trim().split(/[\\/]/).pop() ?? '';
  const allowedExtensions = (MIME_EXTENSIONS as Record<string, string[]>)[
    input.mimeType
  ];
  if (
    !fileName ||
    !allowedExtensions?.includes(
      fileName.slice(fileName.lastIndexOf('.')).toLowerCase(),
    )
  ) {
    throw new BadRequestException(
      'Đuôi file không khớp với MIME type được hỗ trợ',
    );
  }
  return fileName;
}

@Injectable()
export class ChatService {
  constructor(
    @InjectModel(Message.name)
    private readonly messageModel: Model<MessageDocument>,
    @InjectModel(File.name) private readonly fileModel: Model<FileDocument>,
    @InjectModel(Meeting.name)
    private readonly meetingModel: Model<MeetingDocument>,
    private readonly roomAccess: RoomAccessService,
    private readonly redis: RedisService,
    @Inject(OBJECT_STORAGE_PORT) private readonly storage: ObjectStoragePort,
  ) {}

  async createUpload(
    userId: string,
    roomId: string,
    input: {
      originalName: string;
      mimeType: string;
      sizeBytes: number;
      meetingId?: string;
    },
  ) {
    await this.roomAccess.assertRoomAccess(userId, roomId);
    if (input.meetingId)
      await this.roomAccess.assertMeetingTag(userId, roomId, input.meetingId);
    if (input.sizeBytes > MAX_CHAT_FILE_SIZE_BYTES) {
      throw new BadRequestException('File vượt quá dung lượng tối đa 20 MiB');
    }

    const originalName = validateChatFileMetadata(input);
    const storageKey = `chat/${roomId}/${randomUUID()}`;
    const uploadUrl = await this.storage.createUploadUrl({
      key: storageKey,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
    });
    const file = await this.fileModel.create({
      storageKey,
      originalName,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
      purpose: FilePurpose.CHAT_ATTACHMENT,
      uploaderId: new Types.ObjectId(userId),
      roomId: new Types.ObjectId(roomId),
      meetingId: input.meetingId ? new Types.ObjectId(input.meetingId) : null,
      status: FileStatus.PENDING,
    });

    return {
      file: this.toFileResponse(file),
      upload: {
        method: 'PUT',
        url: uploadUrl,
        headers: { 'Content-Type': input.mimeType },
        expiresInSeconds: UPLOAD_URL_TTL_SECONDS,
      },
    };
  }

  async completeUpload(userId: string, roomId: string, fileId: string) {
    await this.roomAccess.assertRoomAccess(userId, roomId);
    if (!Types.ObjectId.isValid(fileId))
      throw new BadRequestException('fileId không hợp lệ');
    const file = await this.fileModel
      .findOne({
        _id: fileId,
        roomId,
        uploaderId: userId,
        purpose: FilePurpose.CHAT_ATTACHMENT,
        deletedAt: null,
      })
      .exec();
    if (!file) throw new NotFoundException('File không tồn tại');
    if (file.status === FileStatus.READY) return this.toFileResponse(file);

    const stored = await this.storage.headObject(file.storageKey);
    if (!stored)
      throw new BadRequestException('File chưa được tải lên Object Storage');
    if (
      stored.sizeBytes !== file.sizeBytes ||
      stored.mimeType !== file.mimeType
    ) {
      throw new BadRequestException(
        'Dung lượng hoặc MIME type của file không khớp',
      );
    }

    file.status = FileStatus.READY;
    await file.save();
    return this.toFileResponse(file);
  }

  async createDownloadUrl(userId: string, roomId: string, fileId: string) {
    await this.roomAccess.assertRoomAccess(userId, roomId);
    if (!Types.ObjectId.isValid(fileId))
      throw new BadRequestException('fileId không hợp lệ');
    const file = await this.fileModel
      .findOne({
        _id: fileId,
        roomId,
        purpose: FilePurpose.CHAT_ATTACHMENT,
        status: FileStatus.READY,
        deletedAt: null,
      })
      .lean()
      .exec();
    if (!file) throw new NotFoundException('File không tồn tại');

    return {
      url: await this.storage.createDownloadUrl({
        key: file.storageKey,
        mimeType: file.mimeType,
        fileName: file.originalName,
      }),
      expiresInSeconds: 15 * 60,
    };
  }

  async sendMessage(userId: string, senderName: string, dto: ChatSendDto) {
    await this.roomAccess.assertRoomAccess(userId, dto.roomId);
    const content = dto.content?.trim() ?? '';
    if (!content && !dto.fileId) {
      throw new BadRequestException(
        'Tin nhắn cần có nội dung hoặc file đính kèm',
      );
    }
    const existing = await this.messageModel
      .findOne({ roomId: dto.roomId, clientMsgId: dto.clientMsgId })
      .lean()
      .exec();
    if (existing) {
      if (String(existing.senderId) !== userId) {
        throw new ConflictException('clientMsgId đã được sử dụng');
      }
      return {
        created: false,
        message: await this.toMessageResponse(existing),
      };
    }

    if (dto.meetingId) {
      await this.roomAccess.assertMeetingTag(userId, dto.roomId, dto.meetingId);
    }

    const file = dto.fileId
      ? await this.fileModel
          .findOne({
            _id: dto.fileId,
            roomId: dto.roomId,
            uploaderId: userId,
            purpose: FilePurpose.CHAT_ATTACHMENT,
            status: FileStatus.READY,
            deletedAt: null,
          })
          .lean()
          .exec()
      : null;
    if (dto.fileId && !file)
      throw new BadRequestException(
        'File chưa sẵn sàng hoặc không thuộc Room này',
      );
    if (file && String(file.meetingId ?? '') !== (dto.meetingId ?? '')) {
      throw new BadRequestException(
        'Ngữ cảnh Meeting của file không khớp tin nhắn',
      );
    }

    const meeting = dto.meetingId
      ? await this.meetingModel
          .findById(dto.meetingId)
          .select('title')
          .lean()
          .exec()
      : null;
    const messageInput = {
      roomId: new Types.ObjectId(dto.roomId),
      meetingId: dto.meetingId ? new Types.ObjectId(dto.meetingId) : null,
      senderId: new Types.ObjectId(userId),
      senderName: senderName.slice(0, 60),
      type: file ? MessageType.FILE : MessageType.TEXT,
      content,
      fileId: file?._id ?? null,
      clientMsgId: dto.clientMsgId,
    };

    let message: MessageDocument;
    try {
      message = await this.messageModel.create(messageInput);
    } catch (error) {
      if (!isDuplicateKey(error)) throw error;
      const duplicate = await this.messageModel
        .findOne({ roomId: dto.roomId, clientMsgId: dto.clientMsgId })
        .lean()
        .exec();
      if (!duplicate || String(duplicate.senderId) !== userId) {
        throw new ConflictException('clientMsgId đã được sử dụng');
      }
      return {
        created: false,
        message: await this.toMessageResponse(duplicate, file, meeting?.title),
      };
    }

    if (dto.meetingId) {
      await this.meetingModel
        .updateOne({ _id: dto.meetingId }, { $inc: { messageCount: 1 } })
        .exec();
    }
    return {
      created: true,
      message: await this.toMessageResponse(message, file, meeting?.title),
    };
  }

  async listMessages(
    userId: string,
    roomId: string,
    query: { before?: string; limit: number; meetingId?: string },
  ) {
    await this.roomAccess.assertRoomAccess(userId, roomId);
    if (query.before && !Types.ObjectId.isValid(query.before)) {
      throw new BadRequestException('before không hợp lệ');
    }
    if (query.meetingId && !Types.ObjectId.isValid(query.meetingId)) {
      throw new BadRequestException('meetingId không hợp lệ');
    }
    if (query.meetingId) {
      const meeting = await this.meetingModel
        .findOne({ _id: query.meetingId, roomId })
        .select('_id')
        .lean()
        .exec();
      if (!meeting) throw new NotFoundException('Meeting không thuộc Room này');
    }

    const filter: {
      roomId: Types.ObjectId;
      deletedAt: null;
      meetingId?: Types.ObjectId;
      $or?: Array<
        | { createdAt: { $lt: Date } }
        | { createdAt: Date; _id: { $lt: Types.ObjectId } }
      >;
    } = {
      roomId: new Types.ObjectId(roomId),
      deletedAt: null,
      ...(query.meetingId
        ? { meetingId: new Types.ObjectId(query.meetingId) }
        : {}),
    };
    if (query.before) {
      const cursor = await this.messageModel
        .findOne({ _id: query.before, ...filter })
        .select('_id createdAt')
        .lean()
        .exec();
      if (!cursor)
        throw new BadRequestException('before không thuộc luồng chat này');
      filter.$or = [
        { createdAt: { $lt: cursor.createdAt } },
        { createdAt: cursor.createdAt, _id: { $lt: cursor._id } },
      ];
    }

    const results = await this.messageModel
      .find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .limit(query.limit + 1)
      .lean()
      .exec();
    const hasMore = results.length > query.limit;
    const messages = results.slice(0, query.limit);
    const fileIds = messages.flatMap((message) =>
      message.fileId ? [message.fileId] : [],
    );
    const meetingIds = messages.flatMap((message) =>
      message.meetingId ? [message.meetingId] : [],
    );
    const [files, meetings] = await Promise.all([
      fileIds.length
        ? this.fileModel
          .find({
            _id: { $in: fileIds },
            purpose: FilePurpose.CHAT_ATTACHMENT,
            status: FileStatus.READY,
          })
            .lean()
            .exec()
        : [],
      meetingIds.length
        ? this.meetingModel
            .find({ _id: { $in: meetingIds } })
            .select('_id title')
            .lean()
            .exec()
        : [],
    ]);
    const fileMap = new Map(files.map((file) => [String(file._id), file]));
    const meetingMap = new Map(
      meetings.map((meeting) => [String(meeting._id), meeting.title]),
    );
    const items = await Promise.all(
      messages.map((message) =>
        this.toMessageResponse(
          message,
          message.fileId ? fileMap.get(String(message.fileId)) : undefined,
          message.meetingId
            ? meetingMap.get(String(message.meetingId))
            : undefined,
        ),
      ),
    );

    return {
      items,
      nextCursor:
        hasMore && messages.length
          ? String(messages[messages.length - 1]._id)
          : null,
    };
  }

  async nextSequence(roomId: string): Promise<number> {
    return this.redis.incr(`chat:seq:${roomId}`);
  }

  private toFileResponse(file: FileDocument) {
    return {
      id: String(file._id),
      originalName: file.originalName,
      mimeType: file.mimeType,
      sizeBytes: file.sizeBytes,
      status: file.status,
    };
  }

  private async toMessageResponse(
    message: MessageDocument,
    file?: FileDocument | null,
    meetingTitle?: string,
  ) {
    const fileMetadata =
      file ??
      (message.fileId
        ? await this.fileModel
            .findOne({ _id: message.fileId, status: FileStatus.READY })
            .lean()
            .exec()
        : null);
    return {
      id: String(message._id),
      roomId: String(message.roomId),
      meetingId: message.meetingId ? String(message.meetingId) : null,
      ...(meetingTitle ? { meetingTitle } : {}),
      senderId: String(message.senderId),
      senderName: message.senderName,
      type: message.type,
      content: message.content ?? '',
      fileId: message.fileId ? String(message.fileId) : null,
      file: fileMetadata
        ? {
            id: String(fileMetadata._id),
            originalName: fileMetadata.originalName,
            mimeType: fileMetadata.mimeType,
            sizeBytes: fileMetadata.sizeBytes,
          }
        : null,
      createdAt: message.createdAt,
    };
  }
}
