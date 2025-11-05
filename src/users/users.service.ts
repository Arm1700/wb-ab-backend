import { Injectable, ConflictException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import * as bcrypt from 'bcrypt';
import { User } from './entities/user.entity';
import { UserRole } from '../common/types/user-role';
import { encrypt, decrypt, isKeyConfigured } from '../common/utils/crypto.util';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  private readonly SALT_ROUNDS = 10;

  async create(createUserDto: CreateUserDto): Promise<User> {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: createUserDto.email },
    });

    if (existingUser) {
      throw new ConflictException('Email already in use');
    }

    const hashedPassword = await bcrypt.hash(
      createUserDto.password,
      this.SALT_ROUNDS,
    );

    const user = await this.prisma.user.create({
      data: {
        email: createUserDto.email,
        password: hashedPassword,
        role: createUserDto.role as any, // Type assertion since we validate in DTO
      },
    });

    return new User({ ...user, role: user.role as unknown as UserRole });
  }

  async findByEmail(email: string): Promise<User | null> {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });
    return user ? new User({ ...user, role: user.role as unknown as UserRole }) : null;
  }

  async findById(id: string): Promise<User | null> {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });
    return user ? new User({ ...user, role: user.role as unknown as UserRole }) : null;
  }

  async validateUser(email: string, password: string): Promise<User> {
    const user = await this.findByEmail(email);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return user;
  }

  async setRefreshToken(userId: string, refreshToken: string, expiresAt: Date) {
    // Invalidate any existing refresh tokens for this user
    await this.prisma.refreshToken.deleteMany({
      where: { userId },
    });

    // Create new refresh token
    await this.prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId,
        expiresAt,
      },
    });
  }

  async removeRefreshToken(token: string) {
    await this.prisma.refreshToken.deleteMany({
      where: { token },
    });
  }

  async getUserIfRefreshTokenMatches(token: string, userId: string) {
    const refreshToken = await this.prisma.refreshToken.findFirst({
      where: {
        token,
        userId,
        expiresAt: { gt: new Date() }, // Check if token is not expired
      },
    });

    if (!refreshToken) {
      return null;
    }

    return this.findById(userId);
  }

  async setWbApiToken(userId: string, token: string): Promise<void> {
    const toStore = ((): string => {
      if (isKeyConfigured()) {
        try { return encrypt(token); } catch { /* ignore and store plain */ }
      }
      return token;
    })();

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        wbApiToken: toStore,
        wbApiTokenUpdatedAt: new Date(),
      },
    });
  }

  async getWbApiToken(userId: string): Promise<string | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { wbApiToken: true },
    });
    if (!user?.wbApiToken) return null;
    const stored = user.wbApiToken;
    if (isKeyConfigured()) {
      try { return decrypt(stored); } catch { /* stored may be plain, fall through */ }
    }
    return stored;
  }
}
