import { Global, Module, OnModuleDestroy } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Queue } from 'bullmq'
import IORedis, { Redis } from 'ioredis'
import { QUEUE_NAMES } from './queues.constants'
import { AbRotateProcessor } from './workers/ab-rotate.processor'
import { WbReportsProcessor } from './workers/wb-reports.processor'
import { WbFetchMetricsProcessor } from './workers/wb-fetch-metrics.processor'
import { AbTestsService } from '../abtests/abtests.service'
import { WbService } from '../wb/wb.service'
import { PrismaModule } from '../prisma/prisma.module'
import { WbModule } from '../wb/wb.module'
import { AbTestsModule } from '../abtests/abtests.module'

@Global()
@Module({
  imports: [PrismaModule, WbModule, AbTestsModule],
  providers: [
    // Redis connection
    {
      provide: 'REDIS_CONN',
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const host = config.get<string>('redis.host') || 'localhost';
        const port = config.get<number>('redis.port') || 6379;
        const url = process.env.REDIS_URL;
    
        const conn: Redis = url
          ? new IORedis(url, { maxRetriesPerRequest: null })
          : new IORedis({
              host,
              port,
              maxRetriesPerRequest: null, // обязательно для BullMQ
            });
    
        return conn;
      },
    },
    // Queues
    {
      provide: 'QUEUE_ab_rotate',
      inject: ['REDIS_CONN'],
      useFactory: (conn: Redis) => new Queue(QUEUE_NAMES.AbRotate, { connection: conn }),
    },
    {
      provide: 'QUEUE_wb_reports',
      inject: ['REDIS_CONN'],
      useFactory: (conn: Redis) => new Queue(QUEUE_NAMES.WbReports, { connection: conn }),
    },
    {
      provide: 'QUEUE_wb_fetch_metrics',
      inject: ['REDIS_CONN'],
      useFactory: (conn: Redis) => new Queue(QUEUE_NAMES.WbFetchMetrics, { connection: conn }),
    },
    // Workers
    AbRotateProcessor,
    WbReportsProcessor,
    WbFetchMetricsProcessor,
  ],
  exports: [
    'REDIS_CONN',
    'QUEUE_ab_rotate',
    'QUEUE_wb_reports',
    'QUEUE_wb_fetch_metrics',
  ],
})
export class QueuesModule implements OnModuleDestroy {
  constructor(
    // Close queues on shutdown if needed in future
  ) {}
  async onModuleDestroy() {}
}
