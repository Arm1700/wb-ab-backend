import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query } from '@nestjs/common'
import { AbAdsService } from './ab-ads.service'
import { CreateAbAdTestDto } from './dto/create-ab-adtest.dto'
import { CreateWbCampaignDto } from './dto/create-wb-campaign.dto'
import { GetCurrentUserId } from '../auth/decorators/get-current-user-id.decorator'

@Controller('ab-ads')
export class AbAdsController {
  constructor(private readonly service: AbAdsService) {}

  @Get()
  async list() {
    return this.service.list()
  }

  @Post()
  async create(@Body() dto: CreateAbAdTestDto) {
    return this.service.create(dto)
  }

  @Post('wb/campaign')
  async createWbCampaign(
    @GetCurrentUserId() userId: string,
    @Body() body: any,
  ) {
    const dto: CreateWbCampaignDto = {
      name: body?.name,
      nms: body?.nms,
      bidType: body?.bidType ?? body?.bid_type,
      placementTypes: body?.placementTypes ?? body?.placement_types,
    } as CreateWbCampaignDto
    return this.service.createWbCampaign(userId, dto)
  }

  @Post('wb/campaign/:campaignId/start')
  async startWbCampaign(
    @Param('campaignId') campaignId: string,
    @GetCurrentUserId() userId: string,
  ) {
    return this.service.startWbCampaign(userId, campaignId)
  }

  @Post('wb/campaign/:campaignId/pause')
  async pauseWbCampaign(
    @Param('campaignId') campaignId: string,
    @GetCurrentUserId() userId: string,
  ) {
    return this.service.pauseWbCampaign(userId, campaignId)
  }

  @Post('wb/campaign/:campaignId/stop')
  async stopWbCampaign(
    @Param('campaignId') campaignId: string,
    @GetCurrentUserId() userId: string,
  ) {
    return this.service.stopWbCampaign(userId, campaignId)
  }

  @Delete('wb/campaign/:campaignId')
  async deleteWbCampaign(
    @Param('campaignId') campaignId: string,
    @GetCurrentUserId() userId: string,
  ) {
    return this.service.deleteWbCampaign(userId, campaignId)
  }

  @Patch('wb/campaign/:campaignId')
  async renameWbCampaign(
    @Param('campaignId') campaignId: string,
    @GetCurrentUserId() userId: string,
    @Body() body: { name?: string },
  ) {
    return this.service.renameWbCampaign(userId, campaignId, body?.name ?? '')
  }

  @Patch('wb/campaign/:campaignId/bids')
  async updateWbCampaignBids(
    @Param('campaignId') campaignId: string,
    @GetCurrentUserId() userId: string,
    @Body() body: { nmBids?: Array<{ nm: number; bid: number }> },
  ) {
    return this.service.updateWbCampaignBids(userId, campaignId, body)
  }

  @Put('wb/campaign/:campaignId/placements')
  async updateWbCampaignPlacements(
    @Param('campaignId') campaignId: string,
    @GetCurrentUserId() userId: string,
    @Body() body: { search?: boolean; recommendations?: boolean },
  ) {
    return this.service.updateWbCampaignPlacements(userId, campaignId, body)
  }

  @Patch('wb/campaign/:campaignId/auction-bids')
  async updateWbCampaignAuctionBids(
    @Param('campaignId') campaignId: string,
    @GetCurrentUserId() userId: string,
    @Body()
    body: { bids?: Array<{ nm: number; bid: number; placement?: 'combined' | 'search' | 'recommendations' }> },
  ) {
    return this.service.updateWbCampaignAuctionBids(userId, campaignId, body)
  }

  @Get('wb/campaign/:campaignId/budget')
  async getWbCampaignBudget(
    @Param('campaignId') campaignId: string,
    @GetCurrentUserId() userId: string,
  ) {
    return this.service.getWbCampaignBudget(userId, campaignId)
  }

  @Get(':id')
  async get(@Param('id') id: string) {
    return this.service.get(id)
  }

  @Post(':id/launch')
  async launch(@Param('id') id: string, @GetCurrentUserId() userId: string) {
    return this.service.launch(id, userId)
  }

  @Post(':id/collect-stats')
  async collectStats(@Param('id') id: string, @GetCurrentUserId() userId: string) {
    return this.service.collectStats(id, userId)
  }

  @Post(':id/variants/:variantId/pause')
  async pauseVariant(
    @Param('id') id: string,
    @Param('variantId') variantId: string,
    @GetCurrentUserId() userId: string,
  ) {
    return this.service.pauseVariant(id, variantId, userId)
  }

  @Post(':id/variants/:variantId/stop')
  async stopVariant(
    @Param('id') id: string,
    @Param('variantId') variantId: string,
    @GetCurrentUserId() userId: string,
  ) {
    return this.service.stopVariant(id, variantId, userId)
  }

  @Post(':id/variants/:variantId/bid')
  async updateBid(
    @Param('id') id: string,
    @Param('variantId') variantId: string,
    @Body() body: { nmId: number; bid: number; placement?: 'search'|'recommendations'|'combined' },
    @GetCurrentUserId() userId: string,
  ) {
    return this.service.updateVariantBid(id, variantId, body, userId)
  }

  @Get(':id/keywords-stats')
  async keywordsStats(
    @Param('id') id: string,
    @GetCurrentUserId() userId: string,
  ) {
    return this.service.getKeywordsStats(id, userId)
  }

  @Get(':id/stats')
  async getStatsSeries(@Param('id') id: string) {
    return this.service.getStatsSeries(id)
  }

  // WB Advert API proxy: promotion count
  @Get('wb/promotion-count')
  async getWbPromotionCount(
    @GetCurrentUserId() userId: string,
    @Query() query: Record<string, any>,
  ) {
    return this.service.getWbPromotionCount(userId, query)
  }

  // WB Advert API proxy: promotion list
  @Get('wb/promotion-list')
  async getWbPromotionList(
    @GetCurrentUserId() userId: string,
    @Query() query: Record<string, any>,
  ) {
    return this.service.getWbPromotionList(userId, query)
  }
}
