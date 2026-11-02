import { Injectable, OnModuleDestroy } from '@nestjs/common';
import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { z } from 'zod';
import type { ObjectStoragePort } from '../ports/object-storage.port.js';

const storageEnvSchema = z.object({
  AWS_REGION: z.string().min(1),
  S3_BUCKET: z.string().min(1),
});

const UPLOAD_URL_TTL_SECONDS = 5 * 60;
const DOWNLOAD_URL_TTL_SECONDS = 15 * 60;

@Injectable()
export class S3ObjectStorageAdapter
  implements ObjectStoragePort, OnModuleDestroy
{
  private readonly bucket: string;
  private readonly client: S3Client;

  constructor() {
    const parsed = storageEnvSchema.safeParse(process.env);
    if (!parsed.success) {
      const detail = parsed.error.issues
        .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
        .join('; ');
      throw new Error(
        `Biến môi trường Object Storage không hợp lệ — ${detail}`,
      );
    }

    this.client = new S3Client({ region: parsed.data.AWS_REGION });
    this.bucket = parsed.data.S3_BUCKET;
  }

  createUploadUrl(input: { key: string; mimeType: string; sizeBytes: number }) {
    return getSignedUrl(
      this.client,
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: input.key,
        ContentType: input.mimeType,
        ContentLength: input.sizeBytes,
      }),
      {
        expiresIn: UPLOAD_URL_TTL_SECONDS,
        signableHeaders: new Set(['content-type', 'content-length']),
      },
    );
  }

  createDownloadUrl(input: {
    key: string;
    mimeType: string;
    fileName: string;
  }) {
    const disposition = input.mimeType.startsWith('image/')
      ? 'inline'
      : 'attachment';
    const encodedName = encodeURIComponent(input.fileName).replace(
      /[!'()*]/g,
      (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
    );

    return getSignedUrl(
      this.client,
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: input.key,
        ResponseContentType: input.mimeType,
        ResponseContentDisposition: `${disposition}; filename*=UTF-8''${encodedName}`,
      }),
      { expiresIn: DOWNLOAD_URL_TTL_SECONDS },
    );
  }

  async headObject(key: string) {
    try {
      const result = await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      if (result.ContentLength === undefined || !result.ContentType)
        return null;
      return { sizeBytes: result.ContentLength, mimeType: result.ContentType };
    } catch (error) {
      const status = (error as { $metadata?: { httpStatusCode?: number } })
        .$metadata?.httpStatusCode;
      if (status === 404) return null;
      throw error;
    }
  }

  onModuleDestroy() {
    this.client.destroy();
  }
}
