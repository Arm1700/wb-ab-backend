import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common'
import { WbService } from './wb.service'
import { GetCurrentUserId } from '../auth/decorators/get-current-user-id.decorator'

@Controller('wb')
export class WbController {
  constructor(private readonly wbService: WbService) {}

  @Post('analytics/sales-funnel/products')
  async postSalesFunnelProducts(
    @GetCurrentUserId() userId: string,
    @Body() body: any,
  ) {
    return this.wbService.postSalesFunnelProducts(userId, body)
  }

  @Post('analytics/sales-funnel/products/history')
  async postSalesFunnelProductsHistory(
    @GetCurrentUserId() userId: string,
    @Body() body: any,
  ) {
    return this.wbService.postSalesFunnelProductsHistory(userId, body)
  }

  // Seller Analytics v3 proxy (matches the curl body you provided)
  @Post('analytics/v3/sales-funnel/products/history')
  async postSellerAnalyticsV3ProductsHistory(
    @GetCurrentUserId() userId: string,
    @Body() body: any,
  ) {
    return this.wbService.postSellerAnalyticsV3ProductsHistory(userId, body)
  }

  @Get('analytics/traffic/summary')
  async getTrafficSummary(
    @GetCurrentUserId() userId: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.wbService.getTrafficSummary(userId, { dateFrom, dateTo })
  }

  @Get('analytics/traffic/daily')
  async getTrafficDaily(
    @GetCurrentUserId() userId: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.wbService.getTrafficDaily(userId, { dateFrom, dateTo })
  }

  @Get('analytics/sales-funnel/summary')
  async getSalesFunnelSummary(
    @GetCurrentUserId() userId: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.wbService.getSalesFunnelSummary(userId, { dateFrom, dateTo })
  }

  @Get('analytics/sales-funnel/daily')
  async getSalesFunnelDaily(
    @GetCurrentUserId() userId: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.wbService.getSalesFunnelDaily(userId, { dateFrom, dateTo })
  }

  @Get('content/cards/limits')
  async getContentCardsLimits(@GetCurrentUserId() userId: string) {
    return this.wbService.getContentCardsLimits(userId)
  }

  @Post('content/cards/list')
  async postContentCardsList(
    @GetCurrentUserId() userId: string,
    @Body() body: any,
  ) {
    return this.wbService.postContentCardsList(userId, body)
  }

  @Post('content/goods/filter')
  async postContentGoodsFilter(
    @GetCurrentUserId() userId: string,
    @Body() filterBody: any,
  ) {
    return this.wbService.postContentGoodsFilter(userId, filterBody)
  }

  @Get('advert/promotion/count')
  async getAdvertPromotionCount(
    @GetCurrentUserId() userId: string,
    @Query() query: Record<string, any>,
  ) {
    return this.wbService.getAdvertPromotionCount(userId, query)
  }

  // --- Analytics report flow ---
  @Post('analytics/reports')
  async createAnalyticsReport(
    @GetCurrentUserId() userId: string,
    @Body() body: any,
  ) {
    return this.wbService.createAnalyticsReport(userId, body)
  }

  @Get('analytics/reports/:id')
  async getAnalyticsReportStatus(
    @GetCurrentUserId() userId: string,
    @Param('id') id: string,
  ) {
    return this.wbService.getAnalyticsReportStatus(userId, id)
  }

  @Get('analytics/reports/:id/download')
  async downloadAnalyticsReport(
    @GetCurrentUserId() userId: string,
    @Param('id') id: string,
  ) {
    return this.wbService.downloadAnalyticsReport(userId, id)
  }
}
