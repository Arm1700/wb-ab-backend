import { Body, Controller, Get, Param, Post, Query, Res } from '@nestjs/common'
import { Response } from 'express'
import { WbExportService } from './wb-export.service'
import { GetCurrentUserId } from '../auth/decorators/get-current-user-id.decorator'

@Controller('wb/export')
export class WbExportController {
  constructor(private readonly wbExportService: WbExportService) {}

  // ==================== ФИНАНСОВЫЕ ОТЧЕТЫ ====================

  @Get('financial/report')
  async getFinancialReport(
    @GetCurrentUserId() userId: string,
    @Query('dateFrom') dateFrom: string,
    @Query('dateTo') dateTo: string,
    @Query('limit') limit?: string,
  ) {
    return this.wbExportService.getFinancialReport(userId, {
      dateFrom,
      dateTo,
      limit: limit ? Number(limit) : undefined,
    })
  }

  @Get('sales')
  async getSales(
    @GetCurrentUserId() userId: string,
    @Query('dateFrom') dateFrom: string,
  ) {
    return this.wbExportService.getSalesOrReturns(userId, { dateFrom, flag: 0 })
  }

  @Get('returns')
  async getReturns(
    @GetCurrentUserId() userId: string,
    @Query('dateFrom') dateFrom: string,
    @Query('dateTo') dateTo: string,
  ) {
    return this.wbExportService.getReturns(userId, { dateFrom, dateTo })
  }

  @Get('orders')
  async getOrders(
    @GetCurrentUserId() userId: string,
    @Query('dateFrom') dateFrom: string,
    @Query('flag') flag?: string,
  ) {
    return this.wbExportService.getOrders(userId, {
      dateFrom,
      flag: flag === '1' ? 1 : 0,
    })
  }

  @Get('stocks')
  async getStocks(
    @GetCurrentUserId() userId: string,
    @Query('dateFrom') dateFrom: string,
  ) {
    return this.wbExportService.getStocks(userId, { dateFrom })
  }

  // ==================== ЭКСПОРТ КАРТОЧЕК ТОВАРОВ ====================

  @Post('products/create-task')
  async createProductsExportTask(
    @GetCurrentUserId() userId: string,
    @Body() body: { nmIDs?: number[] },
  ) {
    return this.wbExportService.createProductsExportTask(userId, body.nmIDs)
  }

  @Get('products/tasks')
  async getProductsExportTasks(@GetCurrentUserId() userId: string) {
    return this.wbExportService.getProductsExportTasks(userId)
  }

  @Get('products/download/:taskId')
  async downloadProductsExport(
    @GetCurrentUserId() userId: string,
    @Param('taskId') taskId: string,
    @Res() res: Response,
  ) {
    const data = await this.wbExportService.downloadProductsExport(userId, taskId)
    
    res.setHeader('Content-Type', 'text/csv')
    res.setHeader('Content-Disposition', `attachment; filename="products-${taskId}.csv"`)
    res.send(data)
  }

  // ==================== ЭКСПОРТ РЕКЛАМНЫХ ОТЧЕТОВ ====================

  @Post('advert/create-task')
  async createAdvertExportTask(
    @GetCurrentUserId() userId: string,
    @Body() body: { dateFrom: string; dateTo: string; type: string },
  ) {
    return this.wbExportService.createAdvertExportTask(userId, body)
  }

  @Get('advert/task/:taskId')
  async getAdvertExportTask(
    @GetCurrentUserId() userId: string,
    @Param('taskId') taskId: string,
  ) {
    return this.wbExportService.getAdvertExportTask(userId, taskId)
  }

  // ==================== АСИНХРОННЫЕ АНАЛИТИЧЕСКИЕ ОТЧЕТЫ ====================

  @Post('analytics/metrics/create-task')
  async createMetricsExportTask(
    @GetCurrentUserId() userId: string,
    @Body() body: { dateFrom: string; dateTo: string; metrics: string[] },
  ) {
    return this.wbExportService.createMetricsExportTask(userId, body)
  }

  @Post('analytics/sales-funnel/create-task')
  async createSalesFunnelExportTask(
    @GetCurrentUserId() userId: string,
    @Body() body: { dateFrom: string; dateTo: string },
  ) {
    return this.wbExportService.createSalesFunnelExportTask(userId, body)
  }

  @Post('analytics/traffic/create-task')
  async createTrafficExportTask(
    @GetCurrentUserId() userId: string,
    @Body() body: { dateFrom: string; dateTo: string },
  ) {
    return this.wbExportService.createTrafficExportTask(userId, body)
  }

  @Get('analytics/task/:taskId/status')
  async getAnalyticsTaskStatus(
    @GetCurrentUserId() userId: string,
    @Param('taskId') taskId: string,
  ) {
    return this.wbExportService.getAnalyticsTaskStatus(userId, taskId)
  }

  @Get('analytics/task/:taskId/download')
  async downloadAnalyticsTaskFile(
    @GetCurrentUserId() userId: string,
    @Param('taskId') taskId: string,
    @Res() res: Response,
  ) {
    const data = await this.wbExportService.downloadAnalyticsTaskFile(userId, taskId)
    
    res.setHeader('Content-Type', 'application/zip')
    res.setHeader('Content-Disposition', `attachment; filename="analytics-${taskId}.zip"`)
    res.send(data)
  }
}
