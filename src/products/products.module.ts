import { Module } from '@nestjs/common'
import { ProductsService } from './products.service'
import { ProductsController } from './products.controller'
import { PrismaModule } from '../prisma/prisma.module'
import { WbModule } from '../wb/wb.module'

@Module({
  imports: [PrismaModule, WbModule],
  controllers: [ProductsController],
  providers: [ProductsService],
  exports: [ProductsService],
})
export class ProductsModule {}
