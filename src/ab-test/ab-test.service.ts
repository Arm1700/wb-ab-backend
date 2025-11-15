import { Injectable, Logger, BadRequestException, NotFoundException, OnModuleInit } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import { HttpService } from '@nestjs/axios'
import { firstValueFrom } from 'rxjs'
import * as fs from 'fs'
import * as path from 'path'
import FormData from 'form-data'
import { PrismaService } from '../prisma/prisma.service'

interface Photo {
  id: number
  file: string
  views: number
  uploadedAt: string
}

@Injectable()
export class ABTestService implements OnModuleInit {
  private readonly logger = new Logger(ABTestService.name)
  private photos: Photo[] = [] // in-memory cache mirroring DB
  private currentIndex = 0
  private switchDate = new Date().toISOString().split('T')[0]
  private isRunning = false
  private threshold = 1000
  private currentRunId: string | null = null
  private currentNmId: number | null = null

  private readonly NM_ID = Number(process.env.NM_ID || 417308349)
  // Use path based on compiled file location to avoid cwd differences
  private readonly PHOTO_DIR = path.resolve(__dirname, '..', '..', 'photos')

  constructor(private readonly http: HttpService, private readonly prisma: PrismaService) {}

  private async getPartnerToken(): Promise<string> {
    const user = await this.prisma.user.findFirst({
      where: { wbPartnerToken: { not: null } },
      orderBy: { wbPartnerTokenUpdatedAt: 'desc' },
      select: { wbPartnerToken: true },
    })
    const token = user?.wbPartnerToken?.trim()
    if (!token) throw new BadRequestException('wbPartnerToken не настроен')
    return token
  }

  async onModuleInit() {
    // Restore last active run for configured NM_ID
    const nmId = BigInt(this.NM_ID)
    const active = await this.prisma.abTestRun.findFirst({
      where: { nmId, isRunning: true },
      orderBy: { createdAt: 'desc' },
      include: { photos: { orderBy: { order: 'asc' } } },
    })
    if (active) {
      this.currentRunId = active.id
      this.isRunning = active.isRunning
      this.currentIndex = active.currentIndex
      this.switchDate = active.switchDate
      this.threshold = active.threshold
      this.currentNmId = Number(active.nmId)
      this.photos = active.photos.map((p, i) => ({ id: i + 1, file: p.fileName, views: p.views, uploadedAt: p.uploadedAt }))
      this.logger.log(`A/B-тест восстановлен: nmId=${this.NM_ID}, фото ${this.currentIndex + 1}/${this.photos.length}`)
    }
  }

  // === ЗАПУСК A/B-ТЕСТА ===
  async start(photos: Array<{ filename: string }>, nmIdOverride?: number, thresholdOverride?: number) {
    if (this.isRunning) throw new BadRequestException('A/B-тест уже запущен')
    if (!photos || photos.length < 2 || photos.length > 5) throw new BadRequestException('Нужно 2–5 фото')

    // ensure photos dir
    if (!fs.existsSync(this.PHOTO_DIR)) fs.mkdirSync(this.PHOTO_DIR, { recursive: true })

    const nowIso = new Date().toISOString()
    const nmId = BigInt(nmIdOverride || this.NM_ID)
    this.currentNmId = Number(nmId)
    if (Number.isFinite(thresholdOverride) && (thresholdOverride as number) >= 2) {
      this.threshold = Math.floor(thresholdOverride as number)
    }
    // close previous runs for this nmId if any
    await this.prisma.abTestRun.updateMany({ where: { nmId, isRunning: true }, data: { isRunning: false } })
    // create run
    const run = await this.prisma.abTestRun.create({ data: { nmId, isRunning: true, currentIndex: 0, switchDate: nowIso.split('T')[0], threshold: this.threshold } })
    this.currentRunId = run.id
    // create photos with order
    await this.prisma.abTestPhoto.createMany({ data: photos.map((f, idx) => ({ runId: run.id, order: idx, fileName: f.filename, views: 0, uploadedAt: nowIso })) })
    const persisted = await this.prisma.abTestPhoto.findMany({ where: { runId: run.id }, orderBy: { order: 'asc' } })
    this.photos = persisted.map((p, i) => ({ id: i + 1, file: p.fileName, views: p.views, uploadedAt: p.uploadedAt }))
    this.currentIndex = 0
    this.switchDate = run.switchDate
    this.isRunning = true

    await this.uploadMainPhoto(this.photos[0].file, this.currentNmId || Number(nmId))
    this.logger.log(`A/B-тест запущен: ${this.photos.length} фото для nmId=${nmId}`)

    return { ok: true, runId: run.id }
  }

  // === ЗАГРУЗКА ГЛАВНОГО ФОТО ===
  private async uploadMainPhoto(filename: string, nmIdOverride?: number) {
    const filePath = path.join(this.PHOTO_DIR, filename)
    if (!fs.existsSync(filePath)) {
      this.logger.error(`Файл не найден для загрузки: ${filePath}`)
      throw new NotFoundException('Фото не найдено на сервере')
    }
    const partnerToken = await this.getPartnerToken()
    const form = new FormData()
    form.append('uploadfile', fs.createReadStream(filePath))

    await firstValueFrom(
      this.http.post(
        `https://content-api.wildberries.ru/content/v3/media/file`,
        form,
        {
          headers: {
            Authorization: `Bearer ${partnerToken}`,
            'X-Nm-Id': nmIdOverride || this.currentNmId || this.NM_ID,
            'X-Photo-Number': '1',
            ...form.getHeaders(),
          },
        },
      ),
    )

    this.logger.log(`Фото ${filename} → ГЛАВНОЕ (позиция 1)`) 
  }

  // === ПОЛУЧЕНИЕ ПРОСМОТРОВ ===
  private async getViews(): Promise<number> {
    const partnerToken = await this.getPartnerToken()
    const { data } = await firstValueFrom(
      this.http.post(
        `https://seller-analytics-api.wildberries.ru/api/analytics/v3/sales-funnel/products/history`,
        {
          selectedPeriod: { start: this.switchDate, end: new Date().toISOString().split('T')[0] },
          nmIds: [this.currentNmId || this.NM_ID],
          aggregationLevel: 'day',
        },
        {
          headers: { Authorization: `Bearer ${partnerToken}` },
        },
      ),
    )

    // data: array per product; sum openCount across full history since switchDate
    try {
      return (data || []).reduce((sum: number, item: any) => {
        const hist = Array.isArray(item?.history) ? item.history : []
        const opens = hist.reduce((acc: number, h: any) => acc + (Number(h?.openCount) || 0), 0)
        return sum + opens
      }, 0)
    } catch {
      return 0
    }
  }

  // === CRON: Каждые 20 минут ===
  @Cron('*/20 * * * *')
  async checkAndSwitch() {
    if (!this.isRunning || this.currentIndex >= this.photos.length - 1) return

    const views = await this.getViews()
    this.photos[this.currentIndex].views = views
    // persist views into DB if we have a run
    if (this.currentRunId) {
      const photo = await this.prisma.abTestPhoto.findFirst({ where: { runId: this.currentRunId, order: this.currentIndex } })
      if (photo) {
        await this.prisma.abTestPhoto.update({ where: { id: photo.id }, data: { views } })
      }
    }

    this.logger.log(`Просмотров с ${this.switchDate}: ${views}/1000`)

    const limit = this.threshold || 1000
    if (views >= limit) {
      this.currentIndex++
      this.switchDate = new Date().toISOString().split('T')[0]
      // persist run progress
      if (this.currentRunId) {
        await this.prisma.abTestRun.update({ where: { id: this.currentRunId }, data: { currentIndex: this.currentIndex, switchDate: this.switchDate } })
      }
      await this.uploadMainPhoto(this.photos[this.currentIndex].file, this.currentNmId || undefined)
      this.logger.log(`${limit} просмотров! → Фото #${this.currentIndex + 1}`)
    }
  }

  // === СТАТУС ===
  getStatus(_nmId?: number) {
    return {
      running: this.isRunning,
      total: this.photos.length,
      current: this.currentIndex + 1,
      // Source of truth for the main photo is our local state, not WB response order
      currentMain: this.photos[this.currentIndex]?.file || null,
      switchDate: this.switchDate,
      threshold: this.threshold,
      runId: this.currentRunId,
      photos: this.photos.map(p => ({ id: p.id, fileName: p.file, views: p.views, uploadedAt: p.uploadedAt })),
    }
  }

  // === УПРАВЛЕНИЕ ===
  async stop() {
    if (!this.currentRunId) throw new NotFoundException('Тест не запущен')
    await this.prisma.abTestRun.update({ where: { id: this.currentRunId }, data: { isRunning: false } })
    this.isRunning = false
    return { ok: true }
  }

  async next() {
    if (!this.currentRunId) throw new NotFoundException('Тест не запущен')
    if (this.currentIndex >= this.photos.length - 1) throw new BadRequestException('Нельзя переключить')
    this.currentIndex++
    this.switchDate = new Date().toISOString().split('T')[0]
    await this.prisma.abTestRun.update({ where: { id: this.currentRunId }, data: { currentIndex: this.currentIndex, switchDate: this.switchDate } })
    await this.uploadMainPhoto(this.photos[this.currentIndex].file, this.currentNmId || undefined)
    return { ok: true }
  }

  async setThreshold(val: number) {
    if (!this.currentRunId) throw new NotFoundException('Тест не запущен')
    if (!Number.isFinite(val) || val < 2) throw new BadRequestException('Минимум 2')
    this.threshold = Math.floor(val)
    await this.prisma.abTestRun.update({ where: { id: this.currentRunId }, data: { threshold: this.threshold } })
    return { ok: true, threshold: this.threshold }
  }
}
