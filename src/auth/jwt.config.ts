import { registerAs } from '@nestjs/config';

export default registerAs('jwt', () => ({
  secret: process.env.JWT_SECRET || 'your-secret-key', // In production, use environment variables
  accessTokenExpiresIn: '15m', // 15 minutes
  refreshTokenExpiresIn: '7d',  // 7 days
}));
