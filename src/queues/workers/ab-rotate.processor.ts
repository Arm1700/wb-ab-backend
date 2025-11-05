import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { Worker, Processor, Job } from 'bullmq'
import { Redis } from 'ioredis'
import { QUEUE_NAMES } from '../queues.constants'
import { AbTestsService } from '../../abtests/abtests.service'

@Injectable()
export class AbRotateProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AbRotateProcessor.name)
  private worker?: Worker

  constructor(
    @Inject('REDIS_CONN') private readonly conn: Redis,
    private readonly abTests: AbTestsService,
  ) {}

  onModuleInit() {
    this.worker = new Worker(
      QUEUE_NAMES.AbRotate,
      async (job: Job) => {
        const { abTestId, userId } = job.data as { abTestId: string; userId: string }
        this.logger.log(`Rotating AB test ${abTestId}`)
        await this.abTests.rotate(abTestId, userId)
        return { ok: true }
      },
      { connection: this.conn, concurrency: 1 }
    )
    this.worker.on('failed', (job, err) => this.logger.error(`Job ${job?.id} failed: ${err?.message}`))
    this.worker.on('completed', (job) => this.logger.debug(`Job ${job.id} completed`))
  }

  async onModuleDestroy() {
    if (this.worker) await this.worker.close()
  }
}
