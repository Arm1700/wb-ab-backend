import { Injectable, Logger } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
import { PrismaService } from '../prisma/prisma.service'
import { WbService } from '../wb/wb.service'

@Injectable()
export class CampaignStatsService {
    private readonly logger = new Logger(CampaignStatsService.name)

    constructor(
        private readonly prisma: PrismaService,
        private readonly wbService: WbService,
    ) { }

    /**
     * Collect stats for active AB test campaigns every hour
     */
    @Cron(CronExpression.EVERY_HOUR)
    async collectActiveCampaignStats() {
        this.logger.log('Starting hourly campaign stats collection...')

        try {
            // Get all active AB test variants with campaign IDs
            const activeVariants = await this.prisma.abAdVariant.findMany({
                where: {
                    status: { in: ['active', 'running'] },
                    wbCampaignId: { not: null },
                },
                include: {
                    test: {
                        include: {
                            product: {
                                include: {
                                    user: true,
                                },
                            },
                        },
                    },
                },
            })

            this.logger.log(`Found ${activeVariants.length} active campaigns to collect stats for`)

            for (const variant of activeVariants) {
                const userId = variant.test.product?.userId
                const campaignId = variant.wbCampaignId

                if (!userId || !campaignId) continue

                try {
                    await this.collectCampaignStats(userId, campaignId)
                    // Add delay to avoid rate limiting
                    await this.sleep(2000)
                } catch (error: any) {
                    this.logger.error(
                        `Failed to collect stats for campaign ${campaignId}: ${error.message}`,
                    )
                }
            }

            this.logger.log('Hourly campaign stats collection completed')
        } catch (error: any) {
            this.logger.error(`Campaign stats collection failed: ${error.message}`)
        }
    }

    /**
     * Collect stats for a specific campaign (yesterday's data)
     */
    async collectCampaignStats(userId: string, campaignId: number) {
        const today = new Date()
        const yesterday = new Date(today)
        yesterday.setDate(yesterday.getDate() - 1)

        const dateStr = yesterday.toISOString().slice(0, 10)

        return this.collectCampaignStatsForDateRange(userId, campaignId, dateStr, dateStr)
    }

    /**
     * Collect stats for a specific campaign and date range
     */
    async collectCampaignStatsForDateRange(
        userId: string,
        campaignId: number,
        dateFrom?: string,
        dateTo?: string,
    ) {
        const today = new Date().toISOString().slice(0, 10)
        const beginDate = dateFrom || today
        const endDate = dateTo || beginDate

        try {
            this.logger.log(`Fetching stats for campaign ${campaignId} from ${beginDate} to ${endDate}`)

            // Fetch stats from WB API
            const statsData = await this.wbService.getAdvertFullStatsRange(userId, {
                ids: [campaignId],
                beginDate,
                endDate,
            })

            // Extract daily stats
            const adverts = statsData?.data?.adverts || statsData?.adverts || []
            const advert = adverts[0]

            if (!advert) {
                this.logger.warn(`No data returned for campaign ${campaignId}`)
                return
            }

            const dailyData = advert.daily || []

            for (const dayStats of dailyData) {
                const date = new Date(dayStats.date || dayStats.day || beginDate)
                const impressions = Number(dayStats.impressions || dayStats.shows || 0)
                const clicks = Number(dayStats.clicks || 0)
                const conversions = Number(dayStats.orders || dayStats.conversions || dayStats.purchases || 0)
                const spend = Number(dayStats.spend || dayStats.cost || dayStats.expenses || 0)
                const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0

                // Upsert stats into database
                await this.prisma.wbCampaignStats.upsert({
                    where: {
                        user_campaign_date: {
                            userId,
                            campaignId,
                            date,
                        },
                    },
                    create: {
                        userId,
                        campaignId,
                        date,
                        impressions,
                        clicks,
                        ctr,
                        conversions,
                        spend,
                    },
                    update: {
                        impressions,
                        clicks,
                        ctr,
                        conversions,
                        spend,
                    },
                })
            }

            this.logger.log(`Saved ${dailyData.length} days of stats for campaign ${campaignId}`)
        } catch (error: any) {
            if (error?.response?.status === 429) {
                this.logger.warn(`Rate limited while fetching stats for campaign ${campaignId}`)
                throw error
            } else {
                throw error
            }
        }
    }

    /**
     * Get campaign stats from database
     */
    async getCampaignStats(userId: string, campaignIds: number[], dateFrom?: string, dateTo?: string) {
        const today = new Date().toISOString().slice(0, 10)
        const from = dateFrom || today
        const to = dateTo || from

        const stats = await this.prisma.wbCampaignStats.findMany({
            where: {
                userId,
                campaignId: { in: campaignIds },
                date: {
                    gte: new Date(from),
                    lte: new Date(to),
                },
            },
            orderBy: [{ campaignId: 'asc' }, { date: 'asc' }],
        })

        // Group by campaign
        const campaigns = campaignIds.map((campaignId) => {
            const campaignStats = stats.filter((s) => s.campaignId === campaignId)

            const summary = campaignStats.reduce(
                (acc, s) => ({
                    impressions: acc.impressions + s.impressions,
                    clicks: acc.clicks + s.clicks,
                    conversions: acc.conversions + s.conversions,
                    spend: acc.spend + s.spend,
                    ctr: 0,
                }),
                { impressions: 0, clicks: 0, conversions: 0, spend: 0, ctr: 0 },
            )

            summary.ctr = summary.impressions > 0 ? (summary.clicks / summary.impressions) * 100 : 0

            const daily = campaignStats.map((s) => ({
                date: s.date.toISOString().slice(0, 10),
                impressions: s.impressions,
                clicks: s.clicks,
                ctr: s.ctr,
                conversions: s.conversions,
                spend: s.spend,
            }))

            return {
                advertId: campaignId,
                name: null, // Will be enriched from WB API if needed
                type: null,
                status: null,
                summary,
                daily,
            }
        })

        return {
            dateFrom: from,
            dateTo: to,
            campaigns: campaigns.filter((c) => c.daily.length > 0),
        }
    }

    private sleep(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms))
    }
}
