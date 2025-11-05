import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ProductsService } from './products.service'
import { GetCurrentUserId } from '../auth/decorators/get-current-user-id.decorator'

@Controller('products')
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get()
  async list(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('search') search?: string,
  ) {
    return this.products.list({ page: Number(page || 1), pageSize: Number(pageSize || 20), search })
  }

  @Post('sync')
  async sync(@GetCurrentUserId() userId: string) {
    return this.products.syncFromWb(userId)
  }
}
