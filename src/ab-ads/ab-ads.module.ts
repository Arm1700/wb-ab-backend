import { Module } from '@nestjs/common'
import { PrismaModule } from '../prisma/prisma.module'
import { WbModule } from '../wb/wb.module'
import { AbAdsService } from './ab-ads.service'
import { AbAdsController } from './ab-ads.controller'

@Module({
  imports: [PrismaModule, WbModule],
  providers: [AbAdsService],
  controllers: [AbAdsController],
  exports: [AbAdsService],
})
export class AbAdsModule {}
