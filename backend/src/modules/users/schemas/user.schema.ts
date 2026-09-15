import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type UserDocument = User & Document;

export enum AuthProvider {
  LOCAL = 'local',
  GOOGLE = 'google',
}

@Schema({ timestamps: true, collection: 'users' })
export class User {
  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email!: string;

  @Prop({ required: true, unique: true, trim: true })
  username!: string;

  @Prop({ required: true, trim: true, maxlength: 60 })
  displayName!: string;

  @Prop({ required: false, select: false })
  password?: string;

  @Prop({ required: false, unique: true, sparse: true })
  googleId?: string;

  @Prop({ default: null })
  avatarUrl?: string | null;

  @Prop({ default: null })
  lastLoginAt?: Date | null;

  @Prop({ type: [String], enum: AuthProvider, default: [AuthProvider.LOCAL] })
  providers!: AuthProvider[];
}

export const UserSchema = SchemaFactory.createForClass(User);

UserSchema.index({ email: 1 }, { unique: true });
