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

  @Prop({ required: false, select: false })
  password?: string;

  @Prop({ required: false, unique: true, sparse: true })
  googleId?: string;

  @Prop({ required: false })
  displayName?: string;

  @Prop({ required: false })
  avatarUrl?: string;

  @Prop({ required: false })
  lastLoginAt?: Date;

  @Prop({ type: [String], enum: AuthProvider, default: [AuthProvider.LOCAL] })
  providers!: AuthProvider[];
}

export const UserSchema = SchemaFactory.createForClass(User);
