import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Types } from 'mongoose';
import { describe, expect, it, vi } from 'vitest';
import { FileStatus } from '../rooms/schemas/file.schema.js';
import { MessageType } from '../../shared/enums.js';
import { ChatService, validateChatFileMetadata } from './chat.service.js';

const userId = new Types.ObjectId().toString();
const roomId = new Types.ObjectId().toString();
const meetingId = new Types.ObjectId().toString();

function query(result: unknown) {
  const chain: any = {
    lean: vi.fn(() => chain),
    select: vi.fn(() => chain),
    sort: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    exec: vi.fn().mockResolvedValue(result),
  };
  return chain;
}

function build() {
  const messageModel = {
    findOne: vi.fn(() => query(null)),
    create: vi.fn(),
  };
  const fileModel = {
    create: vi.fn(),
    findOne: vi.fn(() => query(null)),
  };
  const meetingModel = {
    findById: vi.fn(() => query(null)),
    updateOne: vi.fn(() => query({ modifiedCount: 1 })),
  };
  const roomAccess = {
    assertRoomAccess: vi.fn().mockResolvedValue({}),
    assertMeetingTag: vi.fn().mockResolvedValue(undefined),
  };
  const redis = { incr: vi.fn().mockResolvedValue(1) };
  const storage = {
    createUploadUrl: vi.fn().mockResolvedValue('https://storage.test/upload'),
    createDownloadUrl: vi
      .fn()
      .mockResolvedValue('https://storage.test/download'),
    headObject: vi
      .fn()
      .mockResolvedValue({ sizeBytes: 12, mimeType: 'image/png' }),
  };
  const service = new ChatService(
    messageModel as any,
    fileModel as any,
    meetingModel as any,
    roomAccess as any,
    redis as any,
    storage as any,
  );
  return {
    service,
    messageModel,
    fileModel,
    meetingModel,
    roomAccess,
    redis,
    storage,
  };
}

describe('validateChatFileMetadata', () => {
  it('accepts a supported filename, MIME type and size', () => {
    expect(
      validateChatFileMetadata({
        originalName: '  note.pdf ',
        mimeType: 'application/pdf',
        sizeBytes: 1024,
      }),
    ).toBe('note.pdf');
  });

  it('rejects mismatched extensions, unsupported MIME types and oversized files', () => {
    expect(() =>
      validateChatFileMetadata({
        originalName: 'image.exe',
        mimeType: 'image/png',
        sizeBytes: 10,
      }),
    ).toThrow(BadRequestException);
    expect(() =>
      validateChatFileMetadata({
        originalName: 'image.svg',
        mimeType: 'image/svg+xml',
        sizeBytes: 10,
      }),
    ).toThrow(BadRequestException);
    expect(() =>
      validateChatFileMetadata({
        originalName: 'large.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 20 * 1024 * 1024 + 1,
      }),
    ).toThrow(BadRequestException);
  });
});

describe('createUpload', () => {
  it('checks room membership before issuing a direct-to-storage upload URL', async () => {
    const { service, fileModel, storage } = build();
    fileModel.create.mockResolvedValue({
      _id: new Types.ObjectId(),
      originalName: 'note.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 12,
      status: FileStatus.PENDING,
    });

    const result = await service.createUpload(userId, roomId, {
      originalName: 'note.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 12,
    });

    expect(storage.createUploadUrl).toHaveBeenCalledWith(
      expect.objectContaining({ mimeType: 'application/pdf', sizeBytes: 12 }),
    );
    expect(fileModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        status: FileStatus.PENDING,
        roomId: new Types.ObjectId(roomId),
      }),
    );
    expect(result.upload.method).toBe('PUT');
    expect(result.file.status).toBe(FileStatus.PENDING);
  });

  it('does not contact object storage when room access is denied', async () => {
    const { service, roomAccess, storage } = build();
    roomAccess.assertRoomAccess.mockRejectedValue(new ForbiddenException());

    await expect(
      service.createUpload(userId, roomId, {
        originalName: 'note.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 12,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(storage.createUploadUrl).not.toHaveBeenCalled();
  });

  it('checks meeting presence when an upload is tagged to a meeting', async () => {
    const { service, roomAccess, fileModel } = build();
    fileModel.create.mockResolvedValue({
      _id: new Types.ObjectId(),
      originalName: 'note.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 12,
      status: FileStatus.PENDING,
    });

    await service.createUpload(userId, roomId, {
      originalName: 'note.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 12,
      meetingId,
    });
    expect(roomAccess.assertMeetingTag).toHaveBeenCalledWith(
      userId,
      roomId,
      meetingId,
    );
  });
});

describe('completeUpload', () => {
  it('marks a file ready only when stored size and MIME match the declared metadata', async () => {
    const { service, fileModel, storage } = build();
    const file = {
      _id: new Types.ObjectId(),
      storageKey: `chat/${roomId}/random`,
      sizeBytes: 12,
      mimeType: 'image/png',
      status: FileStatus.PENDING,
      originalName: 'image.png',
      save: vi.fn().mockResolvedValue(undefined),
    };
    const pending = {
      exec: vi.fn().mockResolvedValue(file),
    };
    fileModel.findOne.mockReturnValue(pending as any);

    const result = await service.completeUpload(
      userId,
      roomId,
      String(file._id),
    );

    expect(storage.headObject).toHaveBeenCalledWith(file.storageKey);
    expect(file.save).toHaveBeenCalledOnce();
    expect(result.status).toBe(FileStatus.READY);
  });

  it('does not mark a file ready when object metadata does not match', async () => {
    const { service, fileModel, storage } = build();
    storage.headObject.mockResolvedValue({
      sizeBytes: 13,
      mimeType: 'image/png',
    });
    const file = {
      _id: new Types.ObjectId(),
      storageKey: `chat/${roomId}/random`,
      sizeBytes: 12,
      mimeType: 'image/png',
      status: FileStatus.PENDING,
      save: vi.fn(),
    };
    fileModel.findOne.mockReturnValue({
      exec: vi.fn().mockResolvedValue(file),
    } as any);

    await expect(
      service.completeUpload(userId, roomId, String(file._id)),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(file.save).not.toHaveBeenCalled();
  });
});

describe('createDownloadUrl', () => {
  it('requires room membership and returns a short-lived URL without exposing the object key', async () => {
    const { service, fileModel, roomAccess, storage } = build();
    fileModel.findOne.mockReturnValue(
      query({
        _id: new Types.ObjectId(),
        storageKey: `chat/${roomId}/opaque-key`,
        originalName: 'image.png',
        mimeType: 'image/png',
        status: FileStatus.READY,
      }),
    );

    const result = await service.createDownloadUrl(
      userId,
      roomId,
      new Types.ObjectId().toString(),
    );

    expect(roomAccess.assertRoomAccess).toHaveBeenCalledWith(userId, roomId);
    expect(storage.createDownloadUrl).toHaveBeenCalledWith(
      expect.objectContaining({ mimeType: 'image/png', fileName: 'image.png' }),
    );
    expect(result).toEqual({
      url: 'https://storage.test/download',
      expiresInSeconds: 900,
    });
    expect(result).not.toHaveProperty('storageKey');
  });
});

describe('sendMessage', () => {
  it('persists text messages and returns id instead of _id', async () => {
    const { service, messageModel } = build();
    messageModel.create.mockResolvedValue({
      _id: new Types.ObjectId(),
      roomId: new Types.ObjectId(roomId),
      meetingId: null,
      senderId: new Types.ObjectId(userId),
      senderName: 'Student',
      type: MessageType.TEXT,
      content: 'hello',
      fileId: null,
      createdAt: new Date(),
    });

    const result = await service.sendMessage(userId, 'Student', {
      roomId,
      clientMsgId: '4bf92f30-7f38-4d71-9e7c-8f3b18d4f1b3',
      content: ' hello ',
    });

    expect(result.created).toBe(true);
    expect(result.message).toHaveProperty('id');
    expect(result.message).not.toHaveProperty('_id');
    expect(messageModel.create).toHaveBeenCalledWith(
      expect.objectContaining({ content: 'hello', type: MessageType.TEXT }),
    );
  });

  it('returns an existing message for a retry without creating a duplicate', async () => {
    const { service, messageModel } = build();
    const existing = {
      _id: new Types.ObjectId(),
      roomId: new Types.ObjectId(roomId),
      meetingId: null,
      senderId: new Types.ObjectId(userId),
      senderName: 'Student',
      type: MessageType.TEXT,
      content: 'hello',
      fileId: null,
      createdAt: new Date(),
    };
    messageModel.findOne.mockReturnValue(query(existing));

    const result = await service.sendMessage(userId, 'Student', {
      roomId,
      clientMsgId: '4bf92f30-7f38-4d71-9e7c-8f3b18d4f1b3',
      content: 'hello',
    });

    expect(result.created).toBe(false);
    expect(messageModel.create).not.toHaveBeenCalled();
  });

  it('checks meeting access before persisting a tagged message', async () => {
    const { service, roomAccess, messageModel } = build();
    roomAccess.assertMeetingTag.mockRejectedValue(new ForbiddenException());

    await expect(
      service.sendMessage(userId, 'Student', {
        roomId,
        clientMsgId: '4bf92f30-7f38-4d71-9e7c-8f3b18d4f1b3',
        content: 'hello',
        meetingId,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(messageModel.create).not.toHaveBeenCalled();
  });

  it('stores an attachment message only when its file is ready and owned in the same room', async () => {
    const { service, fileModel, messageModel } = build();
    const file = {
      _id: new Types.ObjectId(),
      roomId: new Types.ObjectId(roomId),
      uploaderId: new Types.ObjectId(userId),
      meetingId: null,
      originalName: 'image.png',
      mimeType: 'image/png',
      sizeBytes: 12,
      status: FileStatus.READY,
    };
    fileModel.findOne.mockReturnValue(query(file));
    messageModel.create.mockResolvedValue({
      _id: new Types.ObjectId(),
      roomId: new Types.ObjectId(roomId),
      meetingId: null,
      senderId: new Types.ObjectId(userId),
      senderName: 'Student',
      type: MessageType.FILE,
      content: '',
      fileId: file._id,
      createdAt: new Date(),
    });

    const result = await service.sendMessage(userId, 'Student', {
      roomId,
      clientMsgId: '4bf92f30-7f38-4d71-9e7c-8f3b18d4f1b3',
      fileId: String(file._id),
    });

    expect(messageModel.create).toHaveBeenCalledWith(
      expect.objectContaining({ type: MessageType.FILE, fileId: file._id }),
    );
    expect(result.message.file).toEqual(
      expect.objectContaining({
        originalName: 'image.png',
        mimeType: 'image/png',
        sizeBytes: 12,
      }),
    );
  });
});
