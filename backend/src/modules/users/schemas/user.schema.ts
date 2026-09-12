import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

@Schema({ timestamps: true, collection: 'users' })
export class User {
  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email: string;

  /** select:false -> không rò ra query thường, phải .select('+passwordHash') mới lấy được */
  @Prop({ required: true, select: false })
  passwordHash: string;

  @Prop({ required: true, trim: true, maxlength: 60 })
  displayName: string;

  @Prop({ type: String, default: null })
  avatarUrl: string | null;

  @Prop({ type: Date, default: null })
  lastLoginAt: Date | null;
}

export type UserDocument = HydratedDocument<User>;
export const UserSchema = SchemaFactory.createForClass(User);

// email đã unique ở @Prop — không khai báo lại
