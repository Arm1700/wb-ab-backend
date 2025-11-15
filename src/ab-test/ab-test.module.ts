import { Module } from '@nestjs/common'
import { ScheduleModule } from '@nestjs/schedule'
import { HttpModule } from '@nestjs/axios'
import { ABTestService } from './ab-test.service'
import { ABTestController } from './ab-test.controller'

@Module({
  imports: [HttpModule, ScheduleModule],
  providers: [ABTestService],
  controllers: [ABTestController],
})
export class AbTestModule {}
