import { BadRequestException, Body, Controller, Get, Param, Post, Query } from '@nestjs/common'
import { WbService } from './wb.service'
import { GetCurrentUserId } from '../auth/decorators/get-current-user-id.decorator'

@Controller('wb')
export class WbController {
  constructor(private readonly wbService: WbService) { }

  @Post('analytics/sales-funnel/products')
  async postSalesFunnelProducts(
    @GetCurrentUserId() userId: string,
    @Body() body: any,
  ) {
    return this.wbService.postSalesFunnelProducts(userId, body)
  }

  @Get('adv/bids/min')
  async getMinBids(
    @GetCurrentUserId() userId: string,
    @Query('payment_type') paymentType?: string,
  ) {
    return this.wbService.getMinBids(userId, paymentType || 'cpm')
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

  // New: Get campaign stats from database (cached), auto-fetch if empty
  @Get('analytics/adv/cached-stats')
  async getCachedCampaignStats(
    @GetCurrentUserId() userId: string,
    @Query('ids') idsParam?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    const ids = (idsParam || '')
      .split(/[;,\s]+/)
      .map(token => Number(token))
      .filter(id => Number.isFinite(id) && id > 0)
    if (!ids.length) {
      throw new BadRequestException('ids query parameter must include at least one campaign id')
    }

    // Import at the top if not already
    const { CampaignStatsService } = await import('./campaign-stats.service')
    const campaignStatsService = new CampaignStatsService(this.wbService['prisma'], this.wbService)

    // Try to get from cache first
    let result = await campaignStatsService.getCampaignStats(userId, ids, dateFrom, dateTo)

    // If no data in cache, fetch from WB API and save
    if (!result.campaigns || result.campaigns.length === 0 || result.campaigns.every(c => c.daily.length === 0)) {
      try {
        // Fetch and save data for each campaign
        for (const campaignId of ids) {
          await campaignStatsService.collectCampaignStatsForDateRange(userId, campaignId, dateFrom, dateTo)
          // Small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 1500))
        }

        // Get the newly saved data
        result = await campaignStatsService.getCampaignStats(userId, ids, dateFrom, dateTo)
      } catch (error: any) {
        // If rate limited or other error, return what we have (might be empty)
        console.error('Error fetching stats from WB API:', error.message)
      }
    }

    return result
  }

  @Get('analytics/adv/fullstats')
  async getAdvertCampaignFullStats(
    @GetCurrentUserId() userId: string,
    @Query('ids') idsParam?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    const ids = (idsParam || '')
      .split(/[;,\s]+/)
      .map(token => Number(token))
      .filter(id => Number.isFinite(id) && id > 0)
    if (!ids.length) {
      throw new BadRequestException('ids query parameter must include at least one campaign id')
    }
    const today = new Date().toISOString().slice(0, 10)
    const beginDate = dateFrom || today
    const endDate = dateTo || beginDate
    const raw = await this.wbService.getAdvertFullStatsRange(userId, {
      ids,
      beginDate,
      endDate,
    })
    return this.normalizeAdvertFullStatsResponse(raw, beginDate, endDate)
  }

  private normalizeAdvertFullStatsResponse(raw: any, dateFrom: string, dateTo: string) {
    const campaigns: Array<{
      advertId: number | null
      name: string | null
      type: number | string | null
      status: number | string | null
      summary: { impressions: number; clicks: number; ctr: number; conversions: number; spend: number }
      daily: Array<{ date: string; impressions: number; clicks: number; ctr: number; conversions: number; spend: number }>
    }> = []

    const pushCampaign = (entry: any) => {
      if (!entry) return
      const advertIdRaw = entry?.advertId ?? entry?.id ?? entry?.campaignId ?? entry?.advert_id
      const advertId = Number(advertIdRaw)
      const dailySource = Array.isArray(entry?.daily)
        ? entry.daily
        : Array.isArray(entry?.data?.daily)
          ? entry.data.daily
          : []
      const daily = dailySource.map((row: any) => {
        const impressions = Number(row?.impressions ?? row?.shows ?? 0) || 0
        const clicks = Number(row?.clicks ?? 0) || 0
        const conversions = Number(row?.orders ?? row?.conversions ?? row?.purchases ?? 0) || 0
        const spend = Number(row?.spend ?? row?.cost ?? row?.expenses ?? 0) || 0
        const ctr = impressions > 0 ? +(clicks / impressions * 100).toFixed(2) : 0
        const date = row?.date ?? row?.day ?? row?.dt ?? row?.statDate ?? ''
        return { date, impressions, clicks, ctr, conversions, spend }
      })
      const summary = daily.reduce(
        (acc, item) => {
          acc.impressions += item.impressions
          acc.clicks += item.clicks
          acc.conversions += item.conversions
          acc.spend += item.spend
          return acc
        },
        { impressions: 0, clicks: 0, conversions: 0, spend: 0, ctr: 0 },
      )
      summary.ctr = summary.impressions > 0 ? +(summary.clicks / summary.impressions * 100).toFixed(2) : 0
      campaigns.push({
        advertId: Number.isFinite(advertId) ? advertId : null,
        name: entry?.name ?? entry?.campaignName ?? null,
        type: entry?.type ?? entry?.kind ?? null,
        status: entry?.status ?? entry?.state ?? null,
        summary,
        daily,
      })
    }

    const root = raw?.data ?? raw
    if (Array.isArray(root?.adverts)) {
      root.adverts.forEach(pushCampaign)
    } else if (Array.isArray(root?.data)) {
      root.data.forEach(pushCampaign)
    } else if (Array.isArray(root)) {
      root.forEach(pushCampaign)
    } else {
      pushCampaign(root)
    }

    return {
      dateFrom,
      dateTo,
      campaigns: campaigns.filter(c => c.advertId !== null),
    }
  }
}
