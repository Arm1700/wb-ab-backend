import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from './prisma/prisma.service';

@Injectable()
export class AppService implements OnModuleInit {
  private readonly startTime: Date;
  private dbStatus: boolean = false;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.startTime = new Date();
  }

  async onModuleInit() {
    try {
      // Test database connection
      await this.prisma.$queryRaw`SELECT 1`;
      this.dbStatus = true;
    } catch (error) {
      this.dbStatus = false;
    }
  }

  getHello() {
    return {
      service: 'Wildberries A/B Testing API',
      version: this.configService.get('npm_package_version') || '1.0.0',
      environment: this.configService.get('NODE_ENV') || 'development',
      uptime: this.getUptime(),
      endpoints: {
        docs: '/api/docs',
        health: '/health',
        auth: '/auth',
        api: '/api',
      },
    };
  }

  getHealth() {
    const memoryUsage = process.memoryUsage();
    
    return {
      status: this.dbStatus ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      database: this.dbStatus ? 'connected' : 'disconnected',
      uptime: this.getUptime(),
      memory: {
        rss: `${Math.round(memoryUsage.rss / 1024 / 1024)} MB`,
        heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)} MB`,
        heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)} MB`,
        external: `${Math.round(memoryUsage.external / 1024 / 1024)} MB`,
      },
      environment: this.configService.get('NODE_ENV') || 'development',
      nodeVersion: process.version,
      platform: process.platform,
    };
  }

  private getUptime(): string {
    const uptime = process.uptime();
    const days = Math.floor(uptime / 86400);
    const hours = Math.floor((uptime % 86400) / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const seconds = Math.floor(uptime % 60);

    return `${days}d ${hours}h ${minutes}m ${seconds}s`;
  }
}
