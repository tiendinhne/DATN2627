import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
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

  // Kèm hash mật khẩu (mặc định select: false) — chỉ dùng khi đổi mật khẩu
  async findByIdWithPassword(id: string) {
    return this.userModel.findById(id).select('+password').exec();
  }

  // Thông tin user trả cho frontend: id thay _id (ràng buộc 2), không lộ password / __v
  toProfile(user: UserDocument) {
    return {
      id: String(user._id),
      email: user.email,
      username: user.username,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl ?? null,
      providers: user.providers,
      // Có provider local = có mật khẩu (tài khoản chỉ dùng Google thì chưa có)
      hasPassword: user.providers.includes(AuthProvider.LOCAL),
      createdAt: (user as any).createdAt,
    };
  }

  // PATCH /users/me — đổi tên hiển thị
  async updateDisplayName(userId: string, displayName: string) {
    const updated = await this.userModel
      .findByIdAndUpdate(userId, { $set: { displayName: displayName.trim() } }, { new: true, runValidators: true })
      .exec();
    if (!updated) {
      throw new NotFoundException('Không tìm thấy người dùng');
    }
    return this.toProfile(updated);
  }

  // Lưu hash mật khẩu mới; thêm provider local để tài khoản Google đặt mật khẩu lần đầu đăng nhập được bằng mật khẩu
  async setPassword(userId: string, passwordHash: string) {
    await this.userModel
      .findByIdAndUpdate(userId, { $set: { password: passwordHash }, $addToSet: { providers: AuthProvider.LOCAL } })
      .exec();
  }

  async createLocalUser(data: { email: string; username: string; displayName: string; password: string }) {
    const user = new this.userModel({
      email: data.email.toLowerCase(),
      username: data.username,
      displayName: data.displayName,
      password: data.password,
      providers: [AuthProvider.LOCAL],
    });
    return user.save();
  }

  async createGoogleUser(data: {
    email: string;
    username: string;
    displayName?: string;
    googleId: string;
    avatarUrl?: string;
  }) {
    const user = new this.userModel({
      email: data.email.toLowerCase(),
      username: data.username,
      displayName: data.displayName || data.username,
      googleId: data.googleId,
      avatarUrl: data.avatarUrl,
      providers: [AuthProvider.GOOGLE],
    });
    return user.save();
  }

  // Khi user đã có tài khoản local, đăng nhập Google lần đầu bằng cùng email -> gắn thêm googleId
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

    // Về lý thuyết không xảy ra vì userId lấy từ user vừa tìm thấy ngay trước đó,
    // nhưng vẫn xử lý để đảm bảo kiểu dữ liệu trả về không phải null.
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
