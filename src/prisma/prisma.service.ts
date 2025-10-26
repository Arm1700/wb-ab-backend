import { Injectable, INestApplication, OnModuleInit, Logger } from '@nestjs/common';
import { PrismaClient, Prisma } from '@prisma/client';
import { ConfigService } from '@nestjs/config';

type LogLevel = 'info' | 'query' | 'warn' | 'error';
type LogDefinition = {
  level: LogLevel;
  emit: 'stdout' | 'event';
};

@Injectable()
export class PrismaService extends PrismaClient<{ log: LogDefinition[] }> implements OnModuleInit {
  private readonly logger = new Logger(PrismaService.name);

  constructor(private configService: ConfigService) {
    super({
      log: [
        { level: 'warn', emit: 'event' },
        { level: 'info', emit: 'event' },
        { level: 'error', emit: 'event' },
        { level: 'query', emit: 'event' },
      ] as LogDefinition[],
    });

    // Log database queries in development
    if (this.configService.get('NODE_ENV') !== 'production') {
      this.$on('query' as any, (e: any) => {
        this.logger.debug(`Query: ${e.query}`);
        this.logger.debug(`Params: ${e.params}`);
        this.logger.debug(`Duration: ${e.duration}ms`);
      });
    }

    this.$on('error' as any, (e: any) => {
      this.logger.error(`Prisma Error: ${e.message}`, e.stack || '');
    });

    this.$on('warn' as any, (e: any) => {
      this.logger.warn(`Prisma Warning: ${e.message}`);
    });
  }

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log('Successfully connected to the database');
    } catch (error: any) {
      this.logger.error('Failed to connect to the database', error.stack || '');
      process.exit(1);
    }
  }

  async enableShutdownHooks(app: INestApplication) {
    process.on('beforeExit', async () => {
      try {
        await app.close();
        this.logger.log('Application shutdown gracefully');
      } catch (error: any) {
        this.logger.error('Error during shutdown', error.stack || '');
        process.exit(1);
      }
    });
  }
}
