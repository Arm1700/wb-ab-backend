import { Body, Controller, Inject, Param, Post } from '@nestjs/common'
import { AbTestsService } from './abtests.service'
import { CreateAbTestDto } from './dto/create-abtest.dto'
import { GetCurrentUserId } from '../auth/decorators/get-current-user-id.decorator'
import { Queue } from 'bullmq'
import { QUEUE_NAMES } from '../queues/queues.constants'

@Controller('abtests')
export class AbTestsController {
  constructor(
    private readonly abTests: AbTestsService,
    @Inject('QUEUE_ab_rotate') private readonly abRotateQueue: Queue,
  ) {}

  @Post()
  async create(@Body() dto: CreateAbTestDto) {
    return this.abTests.create(dto)
  }

  @Post(':id/start')
  async start(@Param('id') id: string) {
    return this.abTests.start(id)
  }

  @Post(':id/pause')
  async pause(@Param('id') id: string) {
    return this.abTests.pause(id)
  }

  @Post(':id/stop')
  async stop(@Param('id') id: string) {
    return this.abTests.stop(id)
  }

  @Post(':id/rotate')
  async rotate(@Param('id') id: string, @GetCurrentUserId() userId: string) {
    return this.abTests.rotate(id, userId)
  }

  @Post(':id/rotate/async')
  async rotateAsync(@Param('id') id: string, @GetCurrentUserId() userId: string) {
    await this.abRotateQueue.add(QUEUE_NAMES.AbRotate, { abTestId: id, userId }, { removeOnComplete: true, removeOnFail: true })
    return { enqueued: true }
  }
}
