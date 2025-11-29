import { Body, Controller, Get, Param, Post } from '@nestjs/common'
import { AbTestService } from './ab-test.service'
import { GetCurrentUserId } from '../auth/decorators/get-current-user-id.decorator'
import { StartAbTestDto } from './dto/start-ab-test.dto'

@Controller('wb/abtest')
export class AbTestController {
  constructor(private readonly service: AbTestService) {}

  @Post('start')
  async start(@GetCurrentUserId() userId: string, @Body() dto: StartAbTestDto) {
    return this.service.startTest(userId, dto as any)
  }

  @Post(':campaignId/stop')
  async stop(@GetCurrentUserId() userId: string, @Param('campaignId') campaignId: string) {
    return this.service.stopTest(userId, Number(campaignId))
  }

  // Ручной триггер ротации (можно вызывать с фронта при открытой странице)
  @Post(':sessionId/rotate')
  async rotate(@GetCurrentUserId() userId: string, @Param('sessionId') sessionId: string) {
    return this.service.rotateIfNeeded(userId, Number(sessionId))
  }
}
