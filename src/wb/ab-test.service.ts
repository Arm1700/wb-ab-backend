import { Injectable, Logger } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import axios from 'axios'
import { PrismaService } from '../prisma/prisma.service'
import { WbService } from './wb.service'

const toISO = (d: Date) => d.toISOString().slice(0, 10)

@Injectable()
export class AbTestService {
  private readonly logger = new Logger(AbTestService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly wb: WbService,
  ) {}

  private async sendTelegramMessage(text: string) {
    const botToken = process.env.TG_BOT_TOKEN
    const chatId = process.env.TG_CHAT_ID
    if (!botToken || !chatId) return
    try {
      await axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
      })
    } catch (err: any) {
      this.logger.error(`Не удалось отправить в Telegram: ${err?.message || err}`)
    }
  }

  async startTest(userId: string, dto: { campaignId: number; nmId: number; photoUrls: string[]; viewsPerStep?: number; autoTopUp?: boolean; topUpThreshold?: number; topUpAmount?: number }) {
    if (!Array.isArray(dto.photoUrls) || dto.photoUrls.length === 0) {
      throw new Error('photoUrls is required')
    }
    const created = await this.prisma.abTestSession.upsert({
      where: { user_campaign: { userId, campaignId: BigInt(dto.campaignId) } as any },
      update: {
        nmId: BigInt(dto.nmId),
        photoUrls: dto.photoUrls,
        viewsPerStep: dto.viewsPerStep ?? 1500,
        status: 'running',
        autoTopUp: !!dto.autoTopUp,
        topUpThreshold: dto.topUpThreshold ?? 1000,
        topUpAmount: dto.topUpAmount ?? 5000,
        currentStep: 0,
        totalViews: BigInt(0),
      },
      create: {
        userId,
        campaignId: BigInt(dto.campaignId),
        nmId: BigInt(dto.nmId),
        photoUrls: dto.photoUrls,
        viewsPerStep: dto.viewsPerStep ?? 1500,
        status: 'running',
        autoTopUp: !!dto.autoTopUp,
        topUpThreshold: dto.topUpThreshold ?? 1000,
        topUpAmount: dto.topUpAmount ?? 5000,
      },
    })
    return { ok: true, id: created.id }
  }

  async stopTest(userId: string, campaignId: number) {
    await this.prisma.abTestSession.updateMany({ where: { userId, campaignId: BigInt(campaignId) }, data: { status: 'stopped' } })
    return { ok: true }
  }

  private async computeTotalImpressions(userId: string, campaignId: number): Promise<number> {
    const today = new Date()
    const dateFrom = '2020-01-01'
    const dateTo = toISO(today)
    const raw = await this.wb.getAdvertFullStatsRange(userId, { ids: [campaignId], beginDate: dateFrom, endDate: dateTo })
    const root: any = raw?.data ?? raw
    const adverts: any[] = Array.isArray(root?.adverts) ? root.adverts : Array.isArray(root?.data) ? root.data : Array.isArray(root) ? root : [root]
    const first = adverts && adverts[0] ? adverts[0] : null
    const rows: any[] = Array.isArray(first?.daily) ? first.daily : Array.isArray(first?.data?.daily) ? first.data.daily : []
    return rows.reduce((acc, r) => acc + (Number(r?.impressions ?? r?.shows ?? 0) || 0), 0)
  }

  private async maybeTopUp(userId: string, session: any) {
    if (!session?.autoTopUp) return
    try {
      const budget = await this.wb.getAdvertBudget(userId, Number(session.campaignId))
      const total = Number(budget?.total ?? budget?.budget ?? 0) || 0
      if (total < Number(session.topUpThreshold ?? 1000)) {
        const sum = Number(session.topUpAmount ?? 5000)
        await this.wb.depositAdvertBudget(userId, { advertId: Number(session.campaignId), sum })
        this.logger.log(`[AB][topUp] Campaign ${session.campaignId} +${sum} ₽ (prev=${total})`)
      }
    } catch (e: any) {
      this.logger.warn(`[AB][topUp] skip: ${e?.message || e}`)
    }
  }

  async rotateIfNeeded(userId: string, sessionId: number) {
    const session = await this.prisma.abTestSession.findUnique({ where: { id: sessionId } })
    if (!session || session.status !== 'running') return { skipped: true }

    const totalViews = await this.computeTotalImpressions(userId, Number(session.campaignId))
    const requiredStep = Math.floor(totalViews / Number(session.viewsPerStep))
    const nextIndex = requiredStep % session.photoUrls.length

    if (requiredStep > Number(session.currentStep)) {
      const newPhotoUrl = session.photoUrls[nextIndex]
      await this.wb.updateMainPhoto(userId, Number(session.nmId), newPhotoUrl)
      await this.prisma.abTestSession.update({ where: { id: session.id }, data: { totalViews: BigInt(totalViews), currentStep: requiredStep } })

      const message = [
        '<b>АВТО-СМЕНА ТИТУЛЬНИКА</b>',
        '',
        `Товар: <code>${session.nmId}</code>`,
        `Кампания: <code>${session.campaignId}</code>`,
        `Вариант: <b>${nextIndex + 1}</b> из ${session.photoUrls.length}`,
        `Показов: <b>${totalViews}</b>`,
        `Порог: каждые <b>${session.viewsPerStep}</b>`,
        `Фото: ${newPhotoUrl}`,
      ].join('\n')
      await this.sendTelegramMessage(message)
      await this.maybeTopUp(userId, session)
      this.logger.log(`[AB][rotate] nm=${session.nmId} var=${nextIndex + 1} total=${totalViews}`)
      return { rotated: true }
    }

    return { rotated: false, totalViews }
  }

  @Cron('0 */15 * * * *')
  async handleBackgroundRotation() {
    const sessions = await this.prisma.abTestSession.findMany({ where: { status: 'running' } })
    for (const s of sessions) {
      try {
        await this.rotateIfNeeded(s.userId, s.id)
      } catch (e: any) {
        this.logger.warn(`[AB][cron] session ${s.id} failed: ${e?.message || e}`)
      }
    }
  }
}
