import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, AuthProvider } from './schemas/user.schema.js';
import type { UserDocument } from './schemas/user.schema.js';

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private userModel: Model<UserDocument>) {}

  async findByEmail(email: string) {
    return this.userModel.findOne({ email: email.toLowerCase() }).select('+password').exec();
  }

  async findByUsername(username: string) {
    return this.userModel.findOne({ username }).select('+password').exec();
  }

  // Dùng cho login: identifier có thể là email hoặc username
  async findByIdentifier(identifier: string) {
    return this.userModel
      .findOne({
        $or: [{ email: identifier.toLowerCase() }, { username: identifier }],
      })
      .select('+password')
      .exec();
  }

  async findByGoogleId(googleId: string) {
    return this.userModel.findOne({ googleId }).exec();
  }

  async findById(id: string) {
    return this.userModel.findById(id).exec();
  }

  async createLocalUser(data: { email: string; username: string; password: string }) {
    const user = new this.userModel({
      email: data.email.toLowerCase(),
      username: data.username,
      password: data.password,
      providers: [AuthProvider.LOCAL],
    });
    return user.save();
  }

  async createGoogleUser(data: {
    email: string;
    username: string;
    googleId: string;
    displayName?: string;
    avatarUrl?: string;
  }) {
    const user = new this.userModel({
      email: data.email.toLowerCase(),
      username: data.username,
      googleId: data.googleId,
      displayName: data.displayName,
      avatarUrl: data.avatarUrl,
      providers: [AuthProvider.GOOGLE],
    });
    return user.save();
  }

  async linkGoogleAccount(userId: string, googleId: string, avatarUrl?: string): Promise<UserDocument> {
    const updated = await this.userModel
      .findByIdAndUpdate(
        userId,
        {
          googleId,
          ...(avatarUrl ? { avatarUrl } : {}),
          $addToSet: { providers: AuthProvider.GOOGLE },
        },
        { new: true },
      )
      .exec();

    if (!updated) {
      throw new InternalServerErrorException('Không tìm thấy user để liên kết tài khoản Google');
    }
    return updated;
  }

  // Tạo username không trùng khi tạo user mới từ Google (vd: "nguyenvana", "nguyenvana1"...)
  async ensureUniqueUsername(base: string): Promise<string> {
    const cleanBase = base.replace(/[^a-zA-Z0-9_]/g, '') || 'user';
    let candidate = cleanBase;
    let suffix = 0;
    while (await this.userModel.exists({ username: candidate })) {
      suffix += 1;
      candidate = `${cleanBase}${suffix}`;
    }
    return candidate;
  }
}
