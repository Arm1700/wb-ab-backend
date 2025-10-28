import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { Tokens } from './interfaces/tokens.interface';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async validateUser(email: string, password: string): Promise<any> {
    return this.usersService.validateUser(email, password);
  }

  async login(loginDto: LoginDto): Promise<Tokens> {
    const user = await this.validateUser(loginDto.email, loginDto.password);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.getTokens({
      sub: user.id,
      email: user.email,
      role: user.role,
    });
  }

  async register(dto: RegisterDto): Promise<Tokens> {
    // Create user and immediately issue tokens
    const user = await this.usersService.create({
      email: dto.email,
      password: dto.password,
      role: 'USER',
    } as any);

    return this.getTokens({
      sub: (user as any).id,
      email: (user as any).email,
      role: (user as any).role,
    });
  }

  async refreshTokens(userId: string, refreshToken: string): Promise<Tokens> {
    const user = await this.usersService.getUserIfRefreshTokenMatches(
      refreshToken,
      userId,
    );

    if (!user) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    return this.getTokens({
      sub: user.id,
      email: user.email,
      role: user.role,
    });
  }

  async getTokens(payload: JwtPayload): Promise<Tokens> {
    const accessTtlConfig = this.configService.get<string>('jwt.accessTokenExpiresIn') ?? '900'; // seconds by default
    const refreshTtlConfig = this.configService.get<string>('jwt.refreshTokenExpiresIn') ?? '604800'; // seconds by default

    const accessTtlSeconds = this.parseTtlToSeconds(accessTtlConfig, 900);
    const refreshTtlSeconds = this.parseTtlToSeconds(refreshTtlConfig, 604800);

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('jwt.secret'),
        expiresIn: accessTtlSeconds, // number of seconds
      }),
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('jwt.refreshSecret') || 'refresh-secret',
        expiresIn: refreshTtlSeconds, // number of seconds
      }),
    ]);

    // Store refresh token in database with absolute expiration Date
    const expiresAt = new Date(Date.now() + refreshTtlSeconds * 1000);

    await this.usersService.setRefreshToken(payload.sub, refreshToken, expiresAt);

    return {
      accessToken,
      refreshToken,
    };
  }

  // Parse TTL which can be a number (seconds) or a string like '15m', '7d', '24h', '30s'
  private parseTtlToSeconds(value: string | number, defaultSeconds: number): number {
    if (typeof value === 'number' && isFinite(value)) return value;
    if (typeof value === 'string') {
      const trimmed = value.trim();
      // Pure numeric string => seconds
      if (/^\d+$/.test(trimmed)) return parseInt(trimmed, 10);
      const match = trimmed.match(/^(\d+)\s*([smhd])$/i);
      if (match) {
        const amount = parseInt(match[1], 10);
        const unit = match[2].toLowerCase();
        switch (unit) {
          case 's':
            return amount;
          case 'm':
            return amount * 60;
          case 'h':
            return amount * 60 * 60;
          case 'd':
            return amount * 60 * 60 * 24;
        }
      }
    }
    return defaultSeconds;
  }

  async logout(userId: string) {
    await this.usersService.removeRefreshToken(userId);
  }
}
