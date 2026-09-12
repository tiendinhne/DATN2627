import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

/**
 * Backend stateless nhiều instance -> refresh token phải verify được ở BẤT KỲ instance nào.
 * Vì vậy lưu ở Mongo, không giữ trong RAM.
 */
@Schema({ timestamps: true, collection: 'refresh_tokens' })
export class RefreshToken {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  /** SHA-256 của token. KHÔNG lưu token gốc. */
  @Prop({ required: true, unique: true })
  tokenHash: string;

  @Prop({ type: Date, required: true })
  expiresAt: Date;

  @Prop({ type: Date, default: null })
  revokedAt: Date | null;

  /** truy vết rotation chain, phát hiện token reuse */
  @Prop({ type: String, default: null })
  replacedByTokenHash: string | null;

  @Prop({ type: String, default: null })
  userAgent: string | null;
}

export type RefreshTokenDocument = HydratedDocument<RefreshToken>;
export const RefreshTokenSchema = SchemaFactory.createForClass(RefreshToken);

/** TTL index: Mongo tự xoá token hết hạn, không cần cron */
RefreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
