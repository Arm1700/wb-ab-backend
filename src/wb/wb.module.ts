import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { UsersModule } from '../users/users.module'
import { PrismaModule } from '../prisma/prisma.module'
import { WbService } from './wb.service'
import { WbController } from './wb.controller'
import { WbExportService } from './wb-export.service'
import { WbExportController } from './wb-export.controller'

@Module({
  imports: [ConfigModule, UsersModule, PrismaModule],
  controllers: [WbController, WbExportController],
  providers: [WbService, WbExportService],
  exports: [WbService, WbExportService],
})
export class WbModule {}
