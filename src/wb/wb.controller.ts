import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common'
import { WbService } from './wb.service'
import { GetCurrentUserId } from '../auth/decorators/get-current-user-id.decorator'

@Controller('wb')
export class WbController {
  constructor(private readonly wbService: WbService) {}

  @Get('analytics/sales-funnel/products')
  async getSalesFunnelProducts(
    @GetCurrentUserId() userId: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const result = await this.wbService.getSalesFunnelProducts(userId, {
      dateFrom,
      dateTo,
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
    })
    return result
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
