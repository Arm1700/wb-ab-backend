import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { Worker, Job } from 'bullmq'
import { Redis } from 'ioredis'
import { QUEUE_NAMES } from '../queues.constants'
import { WbService } from '../../wb/wb.service'

// Handles Analytics report flow: create -> poll -> download
@Injectable()
export class WbReportsProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WbReportsProcessor.name)
  private worker?: Worker

  constructor(
    @Inject('REDIS_CONN') private readonly conn: Redis,
    private readonly wb: WbService,
  ) {}

  onModuleInit() {
    this.worker = new Worker(
      QUEUE_NAMES.WbReports,
      async (job: Job) => {
        // job.data: { userId, createBody }
        const { userId, createBody } = job.data as { userId: string; createBody: any }
        // 1) create report
        const created = await this.wb.createAnalyticsReport(userId, createBody)
        const reportId = created?.id || created?.reportId || created
        if (!reportId) return { error: 'No report id' }
        // 2) poll
        let status = 'PENDING'
        const started = Date.now()
        while (Date.now() - started < 60_000) { // up to 60s
          const st = await this.wb.getAnalyticsReportStatus(userId, String(reportId))
          status = st?.status || st?.state || 'UNKNOWN'
          if (status === 'DONE' || status === 'READY' || status === 'COMPLETED') break
          await new Promise(r => setTimeout(r, 2000))
        }
        if (!(status === 'DONE' || status === 'READY' || status === 'COMPLETED')) {
          return { reportId, status: 'TIMEOUT' }
        }
        // 3) download
        const payload = await this.wb.downloadAnalyticsReport(userId, String(reportId))
        return { reportId, status: 'DONE', payload }
      },
      { connection: this.conn, concurrency: 1 }
    )
    this.worker.on('failed', (job, err) => this.logger.error(`Job ${job?.id} failed: ${err?.message}`))
    this.worker.on('completed', (job) => this.logger.debug(`Job ${job.id} completed`))
  }

  async onModuleDestroy() { if (this.worker) await this.worker.close() }
}
