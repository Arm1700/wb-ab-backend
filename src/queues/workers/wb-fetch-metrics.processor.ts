import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { Worker, Job } from 'bullmq'
import { Redis } from 'ioredis'
import { QUEUE_NAMES } from '../queues.constants'
import { WbService } from '../../wb/wb.service'
import { PrismaService } from '../../prisma/prisma.service'

// Periodically fetch metrics (impressions/clicks/orders) for products and persist daily aggregates.
@Injectable()
export class WbFetchMetricsProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WbFetchMetricsProcessor.name)
  private worker?: Worker

  constructor(
    @Inject('REDIS_CONN') private readonly conn: Redis,
    private readonly wb: WbService,
    private readonly prisma: PrismaService,
  ) {}

  onModuleInit() {
    this.worker = new Worker(
      QUEUE_NAMES.WbFetchMetrics,
      async (job: Job) => {
        const { userId, productId, dateFrom, dateTo } = job.data as { userId: string; productId?: string; dateFrom?: string; dateTo?: string }
        // Minimal placeholder: fetch traffic summary and write a single ProductMetric row for dateTo
        try {
          const product = productId ? await this.prisma.product.findUnique({ where: { id: productId } }) : null
          const summary = await this.wb.getTrafficSummary(userId, { dateFrom, dateTo })
          const date = new Date(summary.dateTo)
          const impressions = Number(summary.impressions || 0)
          const clicks = Number(summary.clicks || 0)
          if (product) {
            await this.prisma.productMetric.upsert({
              where: { productId_date: { productId: product.id, date } },
              create: { productId: product.id, date, impressions, clicks, orders: 0 },
              update: { impressions, clicks },
            } as any)
          }
          return { ok: true, impressions, clicks }
        } catch (e: any) {
          this.logger.error(`Fetch metrics failed: ${e?.message}`)
          throw e
        }
      },
      { connection: this.conn, concurrency: 1 }
    )
    this.worker.on('failed', (job, err) => this.logger.error(`Job ${job?.id} failed: ${err?.message}`))
    this.worker.on('completed', (job) => this.logger.debug(`Job ${job.id} completed`))
  }

  async onModuleDestroy() { if (this.worker) await this.worker.close() }
}
