import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
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
    const accessTtl = this.configService.get<number>('jwt.accessTokenExpiresIn') ?? 900; // 15m default
    const refreshTtl = this.configService.get<number>('jwt.refreshTokenExpiresIn') ?? 604800; // 7d default

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('jwt.secret'),
        expiresIn: accessTtl,
      }),
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('jwt.refreshSecret') || 'refresh-secret',
        expiresIn: refreshTtl,
      }),
    ]);

    // Store refresh token in database
    const expiresAt = new Date();
    const refreshSeconds = this.configService.get<number>('jwt.refreshTokenExpiresIn') ?? 604800;
    expiresAt.setSeconds(expiresAt.getSeconds() + refreshSeconds);

    await this.usersService.setRefreshToken(payload.sub, refreshToken, expiresAt);

    return {
      accessToken,
      refreshToken,
    };
  }

  async logout(userId: string) {
    await this.usersService.removeRefreshToken(userId);
  }
}
