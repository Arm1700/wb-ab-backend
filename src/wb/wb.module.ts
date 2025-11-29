import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { UsersModule } from '../users/users.module'
import { PrismaModule } from '../prisma/prisma.module'
import { WbService } from './wb.service'
import { WbController } from './wb.controller'
import { WbExportService } from './wb-export.service'
import { WbExportController } from './wb-export.controller'
import { AbTestService } from './ab-test.service'
import { AbTestController } from './ab-test.controller'
import { CampaignStatsService } from './campaign-stats.service'

@Module({
  imports: [ConfigModule, UsersModule, PrismaModule],
  controllers: [WbController, WbExportController, AbTestController],
  providers: [WbService, WbExportService, AbTestService, CampaignStatsService],
  exports: [WbService, WbExportService, AbTestService],
})
export class WbModule { }
