import { Injectable, Logger } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
import { PrismaService } from '../prisma/prisma.service'
import { WbService } from '../wb/wb.service'

export interface StartSessionParams {
    userId: string
    campaignId: number
    nmId: number
    photoUrls: string[] // 2-5 images
    viewsPerStep?: number // Default 1000
}

export interface SessionResults {
    session: any
    imageStats: Array<{
        imageUrl: string
        imageIndex: number
        viewsCollected: number
        duration: number // milliseconds
        avgViewsPerHour: number
        isWinner: boolean
    }>
    winner?: {
        imageIndex: number
        imageUrl: string
        reason: string
    }
}

@Injectable()
export class AbTestSessionService {
    private readonly logger = new Logger(AbTestSessionService.name)

    constructor(
        private readonly prisma: PrismaService,
        private readonly wbService: WbService,
    ) { }

    /**
     * Cron job: Check active sessions every 10 minutes
     */
    @Cron('*/10 * * * *') // Every 10 minutes
    async checkActiveSessions() {
        this.logger.log('Starting AB test sessions check...')

        try {
            const now = new Date()
            const activeSessions = await this.prisma.abTestSession.findMany({
                where: {
                    status: 'running',
                    OR: [
                        { nextCheckAt: null },
                        { nextCheckAt: { lte: now } },
                    ],
                },
                include: {
                    imageStats: {
                        where: { completedAt: null },
                        orderBy: { imageIndex: 'asc' },
                    },
                },
            })

            this.logger.log(`Found ${activeSessions.length} active sessions to check`)

            for (const session of activeSessions) {
                try {
                    await this.checkAndUpdateSession(session.id)
                    // Small delay to avoid rate limiting
                    await this.sleep(2000)
                } catch (error: any) {
                    this.logger.error(`Failed to check session ${session.id}: ${error.message}`)
                }
            }

            this.logger.log('AB test sessions check completed')
        } catch (error: any) {
            this.logger.error(`Session check failed: ${error.message}`)
        }
    }

    /**
     * Start a new AB test session
     */
    async startSession(params: StartSessionParams) {
        const { userId, campaignId, nmId, photoUrls, viewsPerStep } = params

        // Validate input
        if (photoUrls.length < 2 || photoUrls.length > 5) {
            throw new Error('Must provide between 2 and 5 images')
        }

        // Check if session already exists for this campaign
        const existing = await this.prisma.abTestSession.findUnique({
            where: { user_campaign: { userId, campaignId: BigInt(campaignId) } },
        })

        if (existing) {
            throw new Error('AB test session already exists for this campaign')
        }

        // Get initial views count
        const initialViews = await this.getCurrentViews(userId, campaignId)

        // Create session
        const session = await this.prisma.abTestSession.create({
            data: {
                userId,
                campaignId: BigInt(campaignId),
                nmId: BigInt(nmId),
                photoUrls,
                viewsPerStep: viewsPerStep || 1000,
                totalViews: BigInt(initialViews),
                currentStep: 0,
                status: 'running',
                nextCheckAt: new Date(Date.now() + 10 * 60 * 1000), // First check in 10 minutes
            },
        })

        // Create first image stats record
        await this.prisma.abTestImageStats.create({
            data: {
                sessionId: session.id,
                imageUrl: photoUrls[0],
                imageIndex: 0,
                targetViews: viewsPerStep || 1000,
                viewsAtStart: BigInt(initialViews),
                checkHistory: [],
            },
        })

        this.logger.log(`Started AB test session ${session.id} for campaign ${campaignId}`)

        return session
    }

    /**
     * Check and update a specific session
     */
    async checkAndUpdateSession(sessionId: number) {
        const session = await this.prisma.abTestSession.findUnique({
            where: { id: sessionId },
            include: {
                imageStats: {
                    where: { completedAt: null },
                    orderBy: { imageIndex: 'asc' },
                },
            },
        })

        if (!session || session.status !== 'running') {
            return
        }

        const currentImageStat = session.imageStats[0]
        if (!currentImageStat) {
            this.logger.warn(`No active image stat for session ${sessionId}`)
            return
        }

        // Get current views from WB API
        const currentViews = await this.getCurrentViews(session.userId, Number(session.campaignId))
        const viewsSinceStart = currentViews - Number(currentImageStat.viewsAtStart)

        // Update check history
        const checkHistory = Array.isArray(currentImageStat.checkHistory)
            ? currentImageStat.checkHistory
            : []

        checkHistory.push({
            timestamp: new Date().toISOString(),
            totalViews: currentViews,
            viewsSinceStart,
        })

        await this.prisma.abTestImageStats.update({
            where: { id: currentImageStat.id },
            data: { checkHistory },
        })

        // Update session total views and last check time
        await this.prisma.abTestSession.update({
            where: { id: sessionId },
            data: {
                totalViews: BigInt(currentViews),
                lastCheckAt: new Date(),
                nextCheckAt: new Date(Date.now() + 10 * 60 * 1000),
            },
        })

        // Check if target reached
        if (viewsSinceStart >= currentImageStat.targetViews) {
            this.logger.log(
                `Image ${currentImageStat.imageIndex} reached target views (${viewsSinceStart}/${currentImageStat.targetViews})`,
            )
            await this.switchToNextImage(sessionId, currentViews)
        } else {
            this.logger.log(
                `Session ${sessionId}: Image ${currentImageStat.imageIndex} - ${viewsSinceStart}/${currentImageStat.targetViews} views`,
            )
        }
    }

    /**
    * Switch to the next image in the test
    */
    async switchToNextImage(sessionId: number, currentViews: number) {
        const session = await this.prisma.abTestSession.findUnique({
            where: { id: sessionId },
            include: {
                imageStats: {
                    where: { completedAt: null },
                },
            },
        })

        if (!session) return

        const currentImageStat = session.imageStats[0]
        if (!currentImageStat) return

        // Mark current image as completed
        await this.prisma.abTestImageStats.update({
            where: { id: currentImageStat.id },
            data: {
                completedAt: new Date(),
                viewsAtEnd: BigInt(currentViews),
            },
        })

        const nextStep = session.currentStep + 1

        // Check if more images remaining
        if (nextStep < session.photoUrls.length) {
            // Create next image stats
            await this.prisma.abTestImageStats.create({
                data: {
                    sessionId: session.id,
                    imageUrl: session.photoUrls[nextStep],
                    imageIndex: nextStep,
                    targetViews: session.viewsPerStep,
                    viewsAtStart: BigInt(currentViews),
                    checkHistory: [],
                },
            })

            // Update session
            await this.prisma.abTestSession.update({
                where: { id: sessionId },
                data: {
                    currentStep: nextStep,
                },
            })

            this.logger.log(`Session ${sessionId}: Switched to image ${nextStep}`)
        } else {
            // All images tested - complete session
            await this.completeSession(sessionId)
        }
    }

    /**
     * Complete a test session
     */
    async completeSession(sessionId: number) {
        await this.prisma.abTestSession.update({
            where: { id: sessionId },
            data: {
                status: 'completed',
                nextCheckAt: null,
            },
        })

        this.logger.log(`Session ${sessionId} completed`)
    }

    /**
     * Pause a test session
     */
    async pauseSession(sessionId: number) {
        await this.prisma.abTestSession.update({
            where: { id: sessionId },
            data: {
                status: 'paused',
                nextCheckAt: null,
            },
        })

        this.logger.log(`Session ${sessionId} paused`)
    }

    /**
     * Resume a paused session
     */
    async resumeSession(sessionId: number) {
        await this.prisma.abTestSession.update({
            where: { id: sessionId },
            data: {
                status: 'running',
                nextCheckAt: new Date(Date.now() + 10 * 60 * 1000),
            },
        })

        this.logger.log(`Session ${sessionId} resumed`)
    }

    /**
     * Stop a session manually
     */
    async stopSession(sessionId: number) {
        // Mark current image as completed if exists
        const session = await this.prisma.abTestSession.findUnique({
            where: { id: sessionId },
            include: {
                imageStats: {
                    where: { completedAt: null },
                },
            },
        })

        if (session?.imageStats[0]) {
            const currentViews = await this.getCurrentViews(session.userId, Number(session.campaignId))
            await this.prisma.abTestImageStats.update({
                where: { id: session.imageStats[0].id },
                data: {
                    completedAt: new Date(),
                    viewsAtEnd: BigInt(currentViews),
                },
            })
        }

        await this.prisma.abTestSession.update({
            where: { id: sessionId },
            data: {
                status: 'stopped',
                nextCheckAt: null,
            },
        })

        this.logger.log(`Session ${sessionId} stopped`)
    }

    /**
    Get session results for dashboard
     */
    async getSessionResults(sessionId: number): Promise<SessionResults> {
        const session = await this.prisma.abTestSession.findUnique({
            where: { id: sessionId },
            include: {
                imageStats: {
                    orderBy: { imageIndex: 'asc' },
                },
            },
        })

        if (!session) {
            throw new Error('Session not found')
        }

        // Calculate stats for each image
        const imageStats = session.imageStats.map((stat) => {
            const viewsCollected = Number(stat.viewsAtEnd || 0) - Number(stat.viewsAtStart)
            const duration = stat.completedAt
                ? stat.completedAt.getTime() - stat.startedAt.getTime()
                : Date.now() - stat.startedAt.getTime()
            const hours = duration / (1000 * 60 * 60)
            const avgViewsPerHour = hours > 0 ? viewsCollected / hours : 0

            return {
                imageUrl: stat.imageUrl,
                imageIndex: stat.imageIndex,
                viewsCollected,
                duration,
                avgViewsPerHour,
                isWinner: false, // Will be set below
            }
        })

        // Find winner (fastest to reach target or highest avg views/hour)
        if (imageStats.length > 0) {
            const completedImages = imageStats.filter((s) => s.viewsCollected >= 1000)

            if (completedImages.length > 0) {
                // Winner = fastest to reach target
                const winner = completedImages.reduce((prev, curr) =>
                    curr.duration < prev.duration ? curr : prev,
                )
                winner.isWinner = true
            } else {
                // Winner = highest avg views/hour so far
                const winner = imageStats.reduce((prev, curr) =>
                    curr.avgViewsPerHour > prev.avgViewsPerHour ? curr : prev,
                )
                winner.isWinner = true
            }
        }

        const winner = imageStats.find((s) => s.isWinner)

        return {
            session,
            imageStats,
            winner: winner
                ? {
                    imageIndex: winner.imageIndex,
                    imageUrl: winner.imageUrl,
                    reason: `Fastest to reach target (${(winner.duration / (1000 * 60 * 60)).toFixed(1)} hours)`,
                }
                : undefined,
        }
    }

    /**
     * Get current views count from WB API
     */
    private async getCurrentViews(userId: string, campaignId: number): Promise<number> {
        try {
            // Use the WB service to get campaign stats
            const statsData = await this.wbService.getAdvertFullStatsRange(userId, {
                ids: [campaignId],
                beginDate: new Date().toISOString().slice(0, 10),
                endDate: new Date().toISOString().slice(0, 10),
            })

            const adverts = statsData?.data?.adverts || statsData?.adverts || []
            const advert = adverts[0]

            if (!advert) {
                this.logger.warn(`No stats data for campaign ${campaignId}`)
                return 0
            }

            // Sum impressions from daily data
            const daily = advert.daily || []
            const totalImpressions = daily.reduce((sum: number, day: any) => {
                return sum + (Number(day.impressions || day.shows || 0))
            }, 0)

            return totalImpressions
        } catch (error: any) {
            this.logger.error(`Failed to get views for campaign ${campaignId}: ${error.message}`)
            return 0
        }
    }

    private sleep(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms))
    }
}
