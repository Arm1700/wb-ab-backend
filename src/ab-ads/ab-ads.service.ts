import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { CreateAbAdTestDto } from './dto/create-ab-adtest.dto'
import { CreateWbCampaignDto } from './dto/create-wb-campaign.dto'
import { WbService } from '../wb/wb.service'

@Injectable()
export class AbAdsService {
  private readonly logger = new Logger(AbAdsService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly wb: WbService,
  ) {}

  async create(dto: CreateAbAdTestDto) {
    if (!dto.variants || dto.variants.length < 2) {
      throw new BadRequestException('At least two variants are required')
    }
    const test = await this.prisma.abAdTest.create({
      data: {
        name: dto.name,
        productId: dto.productId ?? null,
        budget: dto.budget ?? null,
        status: 'draft',
        variants: {
          create: dto.variants.map(v => ({
            variantName: v.name,
            nmIds: v.nmIds as any,
            dailyBudget: v.dailyBudget ?? null,
            bidType: v.bidType ?? 'manual',
            placementTypes: v.placementTypes?.length ? v.placementTypes as any : ['search'],
            status: 'draft',
          })),
        },
      },
      include: { variants: true },
    })
    return test
  }

  async createWbCampaign(userId: string, dto: CreateWbCampaignDto) {
    const name = dto.name?.trim()
    if (!name) {
      throw new BadRequestException('name is required')
    }
    if (!Array.isArray(dto.nms) || dto.nms.length === 0) {
      throw new BadRequestException('nms must include at least one nmId')
    }
    const needsPlacements = dto.bidType === 'manual'
    const placements = Array.isArray(dto.placementTypes) ? dto.placementTypes : []
    if (needsPlacements && placements.length === 0) {
      throw new BadRequestException('placement_types must include at least one value for manual bid_type')
    }
    const payload = {
      name,
      nms: dto.nms,
      bid_type: dto.bidType,
      ...(needsPlacements ? { placement_types: placements } : {}),
    }
    this.logger.debug(`[WB Campaign] create payload: ${JSON.stringify(payload)}`)
    const created = await this.wb.createAdvertCampaign(userId, payload)
    const campaignId =
      typeof created === 'number'
        ? created
        : Number(created?.id ?? created?.campaignId ?? created?.data?.id ?? created?.result?.id ?? created)
    return {
      campaignId: Number.isFinite(campaignId) ? campaignId : null,
      wbResponse: created,
    }
  }

  async list() {
    const tests = await this.prisma.abAdTest.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        variants: {
          include: { stats: { orderBy: { date: 'desc' }, take: 1 } },
        },
      },
    })
    return tests.map(t => ({
      id: t.id,
      name: t.name,
      status: t.status,
      budget: t.budget,
      createdAt: t.createdAt,
      variantCount: t.variants.length,
      variants: t.variants.map(v => {
        const variantExt = v as any
        return ({
          id: v.id,
          name: v.variantName,
          wbCampaignId: v.wbCampaignId,
          ctr: v.stats?.[0]?.ctr ?? 0,
          nmIds: v.nmIds,
          dailyBudget: v.dailyBudget ?? null,
          status: v.status,
          bidType: variantExt.bidType ?? 'manual',
          placementTypes: variantExt.placementTypes ?? ['search'],
        })
      }),
    }))
  }

  async get(id: string) {
    const test = await this.prisma.abAdTest.findUnique({
      where: { id },
      include: { variants: { include: { stats: { orderBy: { date: 'desc' }, take: 1 } } } },
    })
    if (!test) throw new NotFoundException('A/B Ads test not found')
    return test
  }

  // Creates WB campaigns for each variant and starts them
  async launch(id: string, userId: string) {
    const test = await this.prisma.abAdTest.findUnique({ where: { id }, include: { variants: true } })
    if (!test) throw new NotFoundException('A/B Ads test not found')
    if (test.status !== 'draft' && test.status !== 'paused') {
      throw new BadRequestException('Test must be in draft or paused status to launch')
    }

    for (const v of test.variants) {
      try {
        const nmIds = (v.nmIds as unknown as number[]) || []
        if (!Array.isArray(nmIds) || nmIds.length === 0) {
          throw new BadRequestException(`Variant ${v.variantName} has no nmIds`)
        }

        if (!v.wbCampaignId) {
          // WB Promotion API (2025): /adv/v2/seacat/save-ad expects { name, nms, bid_type, placement_types }
          const variantExt = v as any
          const payload = {
            name: `${test.name} - ${v.variantName}`,
            nms: nmIds,
            bid_type: (variantExt.bidType as 'manual' | 'unified') || 'manual',
            placement_types: (Array.isArray(variantExt.placementTypes) && variantExt.placementTypes.length ? variantExt.placementTypes : ['search']) as ('search' | 'recommendations')[],
            daily_budget: v.dailyBudget || undefined,
          }
          const created = await this.wb.createAdvertCampaign(userId, payload)
          // API often returns plain integer ID; also support wrapped shapes just in case
          const campaignId =
            typeof created === 'number'
              ? created
              : Number(created?.id ?? created?.campaignId ?? created?.data?.id ?? created)
          if (!Number.isFinite(campaignId)) {
            const reason = created?.message || created?.error || JSON.stringify(created)
            throw new BadRequestException(`Failed to create WB campaign for variant ${v.variantName}: ${reason}`)
          }
          await this.prisma.abAdVariant.update({ where: { id: v.id }, data: { wbCampaignId: campaignId, status: 'running' } })
          await this.wb.startAdvertCampaign(userId, campaignId)
        } else {
          // ensure running
          await this.wb.startAdvertCampaign(userId, v.wbCampaignId)
          await this.prisma.abAdVariant.update({ where: { id: v.id }, data: { status: 'running' } })
        }
      } catch (e: any) {
        // Surface meaningful details to client instead of generic 500
        const msg = e?.message || 'Launch failed'
        throw new BadRequestException(`Variant ${v.variantName}: ${msg}`)
      }
    }

    await this.prisma.abAdTest.update({ where: { id }, data: { status: 'running' } })
    return { ok: true }
  }

  // Pull stats for all variants and upsert daily AbAdStats
  async collectStats(id: string, userId: string) {
    const test = await this.prisma.abAdTest.findUnique({ where: { id }, include: { variants: true } })
    if (!test) throw new NotFoundException('A/B Ads test not found')

    const today = new Date(); today.setHours(0,0,0,0)

    for (const v of test.variants) {
      if (!v.wbCampaignId) continue
      const raw = await this.wb.getAdvertFullStats(userId, v.wbCampaignId)
      // Try to normalize stats
      const normalized = this.normalizeFullStats(raw)
      const totals = normalized.total
      await this.prisma.abAdStats.upsert({
        // Use the correct Prisma compound unique selector key (schema name: variant_date)
        where: { variant_date: { abAdVariantId: v.id, date: today } },
        update: {
          impressions: totals.impressions,
          clicks: totals.clicks,
          ctr: totals.ctr,
          conversions: totals.conversions,
          spend: totals.spend,
        },
        create: {
          abAdVariantId: v.id,
          date: today,
          impressions: totals.impressions,
          clicks: totals.clicks,
          ctr: totals.ctr,
          conversions: totals.conversions,
          spend: totals.spend,
        },
      })
    }
    return { ok: true }
  }

  async getStatsSeries(id: string) {
    const test = await this.prisma.abAdTest.findUnique({ where: { id }, include: { variants: true } })
    if (!test) throw new NotFoundException('A/B Ads test not found')
    const series = [] as Array<{ variantId: string; variantName: string; items: any[] }>
    for (const v of test.variants) {
      const items = await this.prisma.abAdStats.findMany({ where: { abAdVariantId: v.id }, orderBy: { date: 'asc' } })
      series.push({ variantId: v.id, variantName: v.variantName, items })
    }
    return { id: test.id, name: test.name, status: test.status, series }
  }

  async pauseVariant(testId: string, variantId: string, userId: string) {
    const variant = await this.prisma.abAdVariant.findUnique({ where: { id: variantId } })
    if (!variant) throw new NotFoundException('Variant not found')
    if (!variant.wbCampaignId) throw new BadRequestException('Variant has no WB campaign')
    await this.wb.pauseAdvertCampaign(userId, variant.wbCampaignId)
    await this.prisma.abAdVariant.update({ where: { id: variantId }, data: { status: 'paused' } })
    // if all paused, mark test paused
    const left = await this.prisma.abAdVariant.count({ where: { abAdTestId: testId, status: 'running' } })
    if (left === 0) await this.prisma.abAdTest.update({ where: { id: testId }, data: { status: 'paused' } })
    return { ok: true }
  }

  async stopVariant(testId: string, variantId: string, userId: string) {
    const variant = await this.prisma.abAdVariant.findUnique({ where: { id: variantId } })
    if (!variant) throw new NotFoundException('Variant not found')
    if (!variant.wbCampaignId) throw new BadRequestException('Variant has no WB campaign')
    await this.wb.stopAdvertCampaign(userId, variant.wbCampaignId)
    await this.prisma.abAdVariant.update({ where: { id: variantId }, data: { status: 'stopped' } })
    return { ok: true }
  }

  async updateVariantBid(
    testId: string,
    variantId: string,
    body: { nmId: number; bid: number; placement?: 'search'|'recommendations'|'combined' },
    userId: string,
  ) {
    const variant = await this.prisma.abAdVariant.findUnique({ where: { id: variantId } })
    if (!variant) throw new NotFoundException('Variant not found')
    if (!variant.wbCampaignId) throw new BadRequestException('Variant has no WB campaign')
    if (!body || !Number.isFinite(body.bid) || !Number.isFinite(body.nmId)) {
      throw new BadRequestException('nmId and bid are required')
    }
    await this.wb.updateAuctionBids(userId, { advertId: variant.wbCampaignId, nmId: body.nmId, bid: body.bid, placement: body.placement })
    return { ok: true }
  }

  async getKeywordsStats(testId: string, userId: string) {
    const test = await this.prisma.abAdTest.findUnique({ where: { id: testId }, include: { variants: true } })
    if (!test) throw new NotFoundException('A/B Ads test not found')
    const dateTo = new Date()
    const dateFrom = new Date(dateTo.getTime() - 6 * 24 * 60 * 60 * 1000)
    const dateFromStr = dateFrom.toISOString().slice(0,10)
    const dateToStr = dateTo.toISOString().slice(0,10)
    const result: any = {}
    for (const v of test.variants) {
      if (!v.wbCampaignId) continue
      try {
        const data = await this.wb.getAdvertKeywordsStats(userId, { advertId: v.wbCampaignId, dateFrom: dateFromStr, dateTo: dateToStr })
        result[v.id] = data
      } catch (e) {
        result[v.id] = { error: true }
      }
    }
    return { dateFrom: dateFromStr, dateTo: dateToStr, data: result }
  }

  // WB Advert: promotion count summary proxy
  async getWbPromotionCount(userId: string, query?: Record<string, any>) {
    const data = await this.wb.getAdvertPromotionCount(userId, query)
    // Expect shape: { adverts: [{ type, status, count, advert_list: [{ advertId, changeTime }, ...] }], all }
    const groups = Array.isArray(data?.adverts) ? data.adverts : []
    for (const g of groups) {
      const type = Number(g?.type)
      const status = Number(g?.status)
      const list = Array.isArray(g?.advert_list) ? g.advert_list : []
      for (const it of list) {
        const id = Number(it?.advertId ?? it?.id)
        if (!Number.isFinite(id)) continue
        const changeTime = it?.changeTime ? new Date(it.changeTime) : null
        await this.prisma.wbAdvert.upsert({
          where: { id },
          update: { type: isNaN(type) ? undefined : type, status: isNaN(status) ? undefined : status, changeTime: changeTime ?? undefined, userId },
          create: { id, type: isNaN(type) ? 0 : type, status: isNaN(status) ? 0 : status, changeTime: changeTime ?? undefined, userId },
        })
      }
    }
    return { ok: true, saved: groups.reduce((acc: number, g: any) => acc + (Number(g?.count) || 0), 0), raw: data }
  }

  async getWbPromotionList(userId: string, query?: Record<string, any>) {
    const summary = await this.getWbPromotionCount(userId, query)
    const groups = Array.isArray(summary?.raw?.adverts)
      ? summary.raw.adverts
      : []

    const advertIds = Array.from(new Set(
      groups.flatMap((g: any) => {
        const list = Array.isArray(g?.advert_list) ? g.advert_list : []
        return list
          .map((it: any) => Number(it?.advertId ?? it?.id))
          .filter(id => Number.isFinite(id))
      }),
    )) as number[]

    if (!advertIds.length) {
      return { summary, data: [], auction: [] }
    }

    const [details, auction] = await Promise.all([
      this.wb.getAdvertPromotionAdverts(userId, advertIds),
      this.wb.getAuctionAdverts(userId, query),
    ])

    return { summary, data: details, auction }
  }

  private ensureCampaignId(raw: number | string) {
    const campaignId = Number(raw)
    if (!Number.isFinite(campaignId) || campaignId <= 0) {
      throw new BadRequestException('campaignId must be a positive number')
    }
    return campaignId
  }

  async getWbCampaignBudget(userId: string, campaignId: number | string) {
    const id = this.ensureCampaignId(campaignId)
    const budget = await this.wb.getAdvertBudget(userId, id)
    return { id, budget }
  }

  async startWbCampaign(userId: string, campaignId: number | string) {
    const id = this.ensureCampaignId(campaignId)
    await this.wb.startAdvertCampaign(userId, id)
    return { ok: true }
  }

  async pauseWbCampaign(userId: string, campaignId: number | string) {
    const id = this.ensureCampaignId(campaignId)
    await this.wb.pauseAdvertCampaign(userId, id)
    return { ok: true }
  }

  async stopWbCampaign(userId: string, campaignId: number | string) {
    const id = this.ensureCampaignId(campaignId)
    await this.wb.stopAdvertCampaign(userId, id)
    return { ok: true }
  }

  async deleteWbCampaign(userId: string, campaignId: number | string) {
    const id = this.ensureCampaignId(campaignId)
    await this.wb.deleteAdvertCampaign(userId, id)
    return { ok: true }
  }

  async renameWbCampaign(userId: string, campaignId: number | string, name: string) {
    const id = this.ensureCampaignId(campaignId)
    const trimmed = (name ?? '').trim()
    if (!trimmed) {
      throw new BadRequestException('name is required')
    }
    await this.wb.renameAdvertCampaign(userId, { advertId: id, name: trimmed })
    return { ok: true }
  }

  async updateWbCampaignBids(
    userId: string,
    campaignId: number | string,
    body: { nmBids?: Array<{ nm: number; bid: number }> },
  ) {
    const id = this.ensureCampaignId(campaignId)
    const nmBids = Array.isArray(body?.nmBids)
      ? body.nmBids
          .map(item => ({ nm: Number(item?.nm), bid: Number(item?.bid) }))
          .filter(item => Number.isFinite(item.nm) && Number.isFinite(item.bid))
      : []
    if (!nmBids.length) {
      throw new BadRequestException('nmBids must include at least one { nm, bid } pair')
    }
    const payload = {
      bids: [
        {
          advert_id: id,
          nm_bids: nmBids.map(item => ({ nm: item.nm, bid: item.bid })),
        },
      ],
    }
    await this.wb.updateAdvertBids(userId, payload)
    return { ok: true }
  }

  async updateWbCampaignPlacements(
    userId: string,
    campaignId: number | string,
    body: { search?: boolean; recommendations?: boolean },
  ) {
    const id = this.ensureCampaignId(campaignId)
    const hasSearch = typeof body?.search === 'boolean'
    const hasRecommendations = typeof body?.recommendations === 'boolean'
    if (!hasSearch && !hasRecommendations) {
      throw new BadRequestException('Provide search and/or recommendations flags')
    }
    const payload = {
      placements: [
        {
          advert_id: id,
          placements: {
            search: hasSearch ? Boolean(body?.search) : false,
            recommendations: hasRecommendations ? Boolean(body?.recommendations) : false,
          },
        },
      ],
    }
    await this.wb.updateAdvertAuctionPlacements(userId, payload)
    return { ok: true }
  }

  async updateWbCampaignAuctionBids(
    userId: string,
    campaignId: number | string,
    body: { bids?: Array<{ nm: number; bid: number; placement?: 'combined' | 'search' | 'recommendations' }> },
  ) {
    const id = this.ensureCampaignId(campaignId)
    const entries = Array.isArray(body?.bids)
      ? body.bids
          .map(item => ({
            nm: Number(item?.nm),
            bid: Number(item?.bid),
            placement: (item?.placement as 'combined' | 'search' | 'recommendations') || undefined,
          }))
          .filter(item => Number.isFinite(item.nm) && Number.isFinite(item.bid))
      : []
    if (!entries.length) {
      throw new BadRequestException('bids must include at least one { nm, bid } entry')
    }
    const payload = {
      bids: entries.map(item => ({
        advert_id: id,
        nm: item.nm,
        bid: item.bid,
        placement: item.placement ?? 'combined',
      })),
    }
    await this.wb.updateAdvertAuctionBids(userId, payload)
    return { ok: true }
  }

  private normalizeFullStats(raw: any) {
    // WB fullstats shape varies; attempt robust extraction
    const totals = { impressions: 0, clicks: 0, ctr: 0, conversions: 0, spend: 0 }
    try {
      const data = raw?.data ?? raw
      const rows = Array.isArray(data?.daily) ? data.daily : (Array.isArray(data) ? data : [])
      for (const r of rows) {
        const imp = Number(r?.impressions ?? r?.shows ?? 0)
        const clk = Number(r?.clicks ?? 0)
        const conv = Number(r?.orders ?? r?.conversions ?? 0)
        const spend = Number(r?.spend ?? r?.cost ?? r?.expenses ?? 0)
        totals.impressions += isNaN(imp) ? 0 : imp
        totals.clicks += isNaN(clk) ? 0 : clk
        totals.conversions += isNaN(conv) ? 0 : conv
        totals.spend += isNaN(spend) ? 0 : spend
      }
      totals.ctr = totals.impressions > 0 ? +(totals.clicks / totals.impressions * 100).toFixed(2) : 0
    } catch {}
    return { total: totals }
  }
}
