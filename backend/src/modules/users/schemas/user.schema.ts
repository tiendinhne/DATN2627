import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type UserDocument = User & Document;

export enum AuthProvider {
  LOCAL = 'local',
  GOOGLE = 'google',
}

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email!: string;

  @Prop({ required: true, unique: true, trim: true })
  username!: string;

  // select: false -> mặc định không trả password khi query, phải .select('+password') mới lấy được
  @Prop({ required: false, select: false })
  password?: string;

  // sparse: true -> cho phép nhiều user không có googleId mà không vi phạm unique
  @Prop({ required: false, unique: true, sparse: true })
  googleId?: string;

  @Prop({ required: false })
  avatar?: string;

  @Prop({ type: [String], enum: AuthProvider, default: [AuthProvider.LOCAL] })
  providers!: AuthProvider[];
}

export const UserSchema = SchemaFactory.createForClass(User);
