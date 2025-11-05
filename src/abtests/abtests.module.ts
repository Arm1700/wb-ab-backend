import { Module } from '@nestjs/common'
import { AbTestsService } from './abtests.service'
import { AbTestsController } from './abtests.controller'
import { PrismaModule } from '../prisma/prisma.module'
import { WbModule } from '../wb/wb.module'

@Module({
  imports: [PrismaModule, WbModule],
  controllers: [AbTestsController],
  providers: [AbTestsService],
  exports: [AbTestsService],
})
export class AbTestsModule {}
