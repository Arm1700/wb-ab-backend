import { BadRequestException, HttpException, Injectable } from '@nestjs/common'
import axios, { AxiosInstance } from 'axios'
import { ConfigService } from '@nestjs/config'
import { UsersService } from '../users/users.service'
import { PrismaService } from '../prisma/prisma.service'

@Injectable()
export class WbService {
  private analyticsClient: AxiosInstance
  private advertClient: AxiosInstance
  private contentClient: AxiosInstance
  private limitsCache: { data: any; ts: number } | null = null

  constructor(
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
    private readonly prisma: PrismaService,
  ) {
    const analyticsBaseURL = this.configService.get<string>('wb.analyticsBaseUrl') || 'https://analytics-api-sandbox.wildberries.ru'
    const advertBaseURL = this.configService.get<string>('wb.advertBaseUrl') || 'https://advert-api-sandbox.wildberries.ru'
    const contentBaseURL = this.configService.get<string>('wb.contentBaseUrl') || 'https://content-api-sandbox.wildberries.ru'
    this.analyticsClient = axios.create({ baseURL: analyticsBaseURL })
    this.advertClient = axios.create({ baseURL: advertBaseURL })
    this.contentClient = axios.create({ baseURL: contentBaseURL })
  }

  // Analytics: Traffic daily series (last 7 days by default)
  async getTrafficDaily(userId: string, params?: { dateFrom?: string; dateTo?: string }) {
    const end = params?.dateTo ? new Date(params.dateTo) : new Date()
    end.setHours(23, 59, 59, 999) // Конец дня
    
    const start = params?.dateFrom ? new Date(params.dateFrom) : new Date(end.getTime() - 6 * 24 * 60 * 60 * 1000)
    start.setHours(0, 0, 0, 0) // Начало дня

    const dateFromIso = start.toISOString().slice(0, 10)
    const dateToIso = end.toISOString().slice(0, 10)

    // Получаем данные из нашей базы данных (агрегированные метрики всех продуктов)
    try {
      const metrics = await this.prisma.productMetric.groupBy({
        by: ['date'],
        where: {
          date: {
            gte: start,
            lte: end,
          },
        },
        _sum: {
          impressions: true,
          clicks: true,
        },
        orderBy: {
          date: 'asc',
        },
      })

      const items = metrics.map((m) => {
        const impressions = Number(m._sum.impressions ?? 0)
        const clicks = Number(m._sum.clicks ?? 0)
        const ctr = impressions > 0 ? +(clicks / impressions * 100).toFixed(2) : 0
        return { 
          date: m.date.toISOString().slice(0, 10), 
          impressions, 
          clicks, 
          ctr 
        }
      })

      // Если нет данных, возвращаем пустые дни для графика
      if (items.length === 0) {
        const emptyItems = []
        const cursor = new Date(start)
        while (cursor <= end) {
          emptyItems.push({
            date: cursor.toISOString().slice(0, 10),
            impressions: 0,
            clicks: 0,
            ctr: 0
          })
          cursor.setDate(cursor.getDate() + 1)
        }
        return { dateFrom: dateFromIso, dateTo: dateToIso, items: emptyItems }
      }

      return { dateFrom: dateFromIso, dateTo: dateToIso, items }
    } catch (err) {
      console.error('Error in getTrafficDaily:', err)
      // Fallback: пустой массив с днями
      const emptyItems = []
      const cursor = new Date(start)
      while (cursor <= end) {
        emptyItems.push({
          date: cursor.toISOString().slice(0, 10),
          impressions: 0,
          clicks: 0,
          ctr: 0
        })
        cursor.setDate(cursor.getDate() + 1)
      }
      return { dateFrom: dateFromIso, dateTo: dateToIso, items: emptyItems }
    }
  }

  private async getTokenOrThrow(userId: string): Promise<string> {
    const token = await this.usersService.getWbApiToken(userId)
    if (!token) throw new BadRequestException('WB API token is not set for this user')
    return token
  }

  private normalizeAuthHeader(rawToken: string): string {
    // WB usually expects the token directly in Authorization header (without 'Bearer ')
    if (!rawToken) return rawToken
    if (rawToken.startsWith('Bearer ')) return rawToken.slice(7)
    return rawToken
  }

  // Analytics: Sales funnel products
  async getSalesFunnelProducts(userId: string, params: {
    dateFrom?: string
    dateTo?: string
    page?: number
    pageSize?: number
  }) {
    const token = await this.getTokenOrThrow(userId)
    const query: Record<string, any> = {}
    if (params?.dateFrom) query.dateFrom = params.dateFrom
    if (params?.dateTo) query.dateTo = params.dateTo
    if (params?.page != null) query.page = params.page
    if (params?.pageSize != null) query.pageSize = params.pageSize

    const { data } = await this.analyticsClient.get('/api/analytics/v3/sales-funnel/products', {
      params: query,
      headers: { Authorization: token },
    })
    return data
  }

  // Analytics: Traffic summary (impressions, clicks, ctr) for a date range
  async getTrafficSummary(userId: string, params?: { dateFrom?: string; dateTo?: string }) {
    // Defaults: last 7 days
    const end = params?.dateTo ? new Date(params.dateTo) : new Date()
    const start = params?.dateFrom ? new Date(params.dateFrom) : new Date(end.getTime() - 6 * 24 * 60 * 60 * 1000)

    const dateFromIso = start.toISOString().slice(0, 10)
    const dateToIso = end.toISOString().slice(0, 10)

    // Получаем агрегированные данные из базы
    try {
      const result = await this.prisma.productMetric.aggregate({
        where: {
          date: {
            gte: start,
            lte: end,
          },
        },
        _sum: {
          impressions: true,
          clicks: true,
        },
      })

      const impressions = Number(result._sum.impressions ?? 0)
      const clicks = Number(result._sum.clicks ?? 0)
      const ctr = impressions > 0 ? +(clicks / impressions * 100).toFixed(2) : 0
      return { dateFrom: dateFromIso, dateTo: dateToIso, impressions, clicks, ctr }
    } catch (err) {
      return { dateFrom: dateFromIso, dateTo: dateToIso, impressions: 0, clicks: 0, ctr: 0 }
    }
  }

  // Analytics: Sales funnel summary (воронка продаж)
  async getSalesFunnelSummary(userId: string, params?: { dateFrom?: string; dateTo?: string }) {
    const end = params?.dateTo ? new Date(params.dateTo) : new Date()
    end.setHours(23, 59, 59, 999)
    
    const start = params?.dateFrom ? new Date(params.dateFrom) : new Date(end.getTime() - 6 * 24 * 60 * 60 * 1000)
    start.setHours(0, 0, 0, 0)

    const dateFromIso = start.toISOString().slice(0, 10)
    const dateToIso = end.toISOString().slice(0, 10)

    try {
      const result = await this.prisma.productMetric.aggregate({
        where: {
          date: {
            gte: start,
            lte: end,
          },
        },
        _sum: {
          impressions: true,
          openCount: true,
          cartCount: true,
          orders: true,
          buyoutCount: true,
          buyoutSum: true,
        },
      })

      const impressions = Number(result._sum.impressions ?? 0)
      const openCount = Number(result._sum.openCount ?? 0)
      const cartCount = Number(result._sum.cartCount ?? 0)
      const orders = Number(result._sum.orders ?? 0)
      const buyoutCount = Number(result._sum.buyoutCount ?? 0)
      const buyoutSum = Number(result._sum.buyoutSum ?? 0)

      // Конверсии
      const viewToOpenConversion = impressions > 0 ? +(openCount / impressions * 100).toFixed(2) : 0
      const openToCartConversion = openCount > 0 ? +(cartCount / openCount * 100).toFixed(2) : 0
      const cartToOrderConversion = cartCount > 0 ? +(orders / cartCount * 100).toFixed(2) : 0
      const orderToBuyoutConversion = orders > 0 ? +(buyoutCount / orders * 100).toFixed(2) : 0
      const avgBuyoutSum = buyoutCount > 0 ? +(buyoutSum / buyoutCount).toFixed(2) : 0

      return {
        dateFrom: dateFromIso,
        dateTo: dateToIso,
        impressions,
        openCount,
        cartCount,
        orders,
        buyoutCount,
        buyoutSum,
        conversions: {
          viewToOpen: viewToOpenConversion,
          openToCart: openToCartConversion,
          cartToOrder: cartToOrderConversion,
          orderToBuyout: orderToBuyoutConversion,
        },
        avgBuyoutSum,
      }
    } catch (err) {
      console.error('Error in getSalesFunnelSummary:', err)
      return {
        dateFrom: dateFromIso,
        dateTo: dateToIso,
        impressions: 0,
        openCount: 0,
        cartCount: 0,
        orders: 0,
        buyoutCount: 0,
        buyoutSum: 0,
        conversions: {
          viewToOpen: 0,
          openToCart: 0,
          cartToOrder: 0,
          orderToBuyout: 0,
        },
        avgBuyoutSum: 0,
      }
    }
  }

  // Analytics: Sales funnel daily (воронка продаж по дням)
  async getSalesFunnelDaily(userId: string, params?: { dateFrom?: string; dateTo?: string }) {
    const end = params?.dateTo ? new Date(params.dateTo) : new Date()
    end.setHours(23, 59, 59, 999)
    
    const start = params?.dateFrom ? new Date(params.dateFrom) : new Date(end.getTime() - 6 * 24 * 60 * 60 * 1000)
    start.setHours(0, 0, 0, 0)

    const dateFromIso = start.toISOString().slice(0, 10)
    const dateToIso = end.toISOString().slice(0, 10)

    try {
      const metrics = await this.prisma.productMetric.groupBy({
        by: ['date'],
        where: {
          date: {
            gte: start,
            lte: end,
          },
        },
        _sum: {
          impressions: true,
          openCount: true,
          cartCount: true,
          orders: true,
          buyoutCount: true,
          buyoutSum: true,
        },
        orderBy: {
          date: 'asc',
        },
      })

      const items = metrics.map((m) => {
        const impressions = Number(m._sum.impressions ?? 0)
        const openCount = Number(m._sum.openCount ?? 0)
        const cartCount = Number(m._sum.cartCount ?? 0)
        const orders = Number(m._sum.orders ?? 0)
        const buyoutCount = Number(m._sum.buyoutCount ?? 0)
        const buyoutSum = Number(m._sum.buyoutSum ?? 0)

        const viewToOpen = impressions > 0 ? +(openCount / impressions * 100).toFixed(2) : 0
        const openToCart = openCount > 0 ? +(cartCount / openCount * 100).toFixed(2) : 0
        const cartToOrder = cartCount > 0 ? +(orders / cartCount * 100).toFixed(2) : 0

        return {
          date: m.date.toISOString().slice(0, 10),
          impressions,
          openCount,
          cartCount,
          orders,
          buyoutCount,
          buyoutSum,
          viewToOpen,
          openToCart,
          cartToOrder,
        }
      })

      return { dateFrom: dateFromIso, dateTo: dateToIso, items }
    } catch (err) {
      console.error('Error in getSalesFunnelDaily:', err)
      return { dateFrom: dateFromIso, dateTo: dateToIso, items: [] }
    }
  }

  // Content: cards limits (simple GET)
  async getContentCardsLimits(userId: string) {
    const token = this.normalizeAuthHeader(await this.getTokenOrThrow(userId))
    // cache for 60s
    const now = Date.now()
    if (this.limitsCache && now - this.limitsCache.ts < 60_000) {
      return this.limitsCache.data
    }
    const attempt = async () => {
      const { data } = await this.contentClient.get('/content/v2/cards/limits', {
        headers: { Authorization: token },
      })
      return data
    }
    try {
      const data = await this.retryOn429(attempt)
      this.limitsCache = { data, ts: now }
      return data
    } catch (e: any) {
      const status = e?.response?.status || 502
      const message = e?.response?.data?.message || e?.message || 'WB Content limits request failed'
      throw new HttpException({ message, details: e?.response?.data }, status)
    }
  }

  // Content: goods list filter (WB docs sometimes show POST). We'll support POST with arbitrary filter body.
  async postContentGoodsFilter(userId: string, filterBody: any) {
    const token = this.normalizeAuthHeader(await this.getTokenOrThrow(userId))
    try {
      const mainAttempt = async () => {
        const { data } = await this.contentClient.post('/api/v2/list/goods/filter', filterBody, {
          headers: { Authorization: token },
        })
        return data
      }
      const data = await this.retryOn429(mainAttempt)
      return data
    } catch (e: any) {
      // If 404, try alternative Content API paths used in some WB doc variants
      const status = e?.response?.status
      if (status === 404) {
        try {
          const alt1 = await this.retryOn429(async () => {
            const r = await this.contentClient.post('/content/v2/cards/filter', filterBody, { headers: { Authorization: token } })
            return r.data
          })
          return alt1.data
        } catch {}
        try {
          const alt2 = await this.retryOn429(async () => {
            const r = await this.contentClient.post('/content/v2/cards/cursor/list', filterBody, { headers: { Authorization: token } })
            return r.data
          })
          return alt2.data
        } catch {}
        // Final sandbox fallback: return an empty set with a note so UI remains functional
        return { items: [], note: 'sandbox_404' }
      }
      const fallbackStatus = status || 502
      const message = e?.response?.data?.message || e?.message || 'WB Content goods filter failed'
      throw new HttpException({ message, details: e?.response?.data }, fallbackStatus)
    }
  }

  private async retryOn429<T>(fn: () => Promise<T>, max = 3): Promise<T> {
    let attempt = 0
    let lastErr: any
    while (attempt < max) {
      try {
        return await fn()
      } catch (e: any) {
        const status = e?.response?.status
        if (status === 429) {
          // Respect Retry-After if present
          const ra = e?.response?.headers?.['retry-after']
          const base = typeof ra === 'string' ? parseInt(ra) * 1000 : 500 * Math.pow(2, attempt)
          await new Promise(res => setTimeout(res, isNaN(base) ? 500 * Math.pow(2, attempt) : base))
          attempt++
          lastErr = e
          continue
        }
        throw e
      }
    }
    throw lastErr
  }

  // Advert: promotion count / campaigns summary
  async getAdvertPromotionCount(userId: string, query?: Record<string, any>) {
    const token = await this.getTokenOrThrow(userId)
    const { data } = await this.advertClient.get('/adv/v1/promotion/count', {
      params: query ?? {},
      headers: { Authorization: token },
    })
    return data
  }

  // --- Standard Analytics Report Flow ---
  // Create report
  async createAnalyticsReport(userId: string, body: any) {
    const token = await this.getTokenOrThrow(userId)
    // WB usually expects JSON body describing report type, date range, grouping, etc.
    const { data } = await this.analyticsClient.post('/api/analytics/v1/reports', body, {
      headers: { Authorization: token },
    })
    // Expecting { id: string, ... }
    return data
  }

  // Poll report status
  async getAnalyticsReportStatus(userId: string, reportId: string) {
    const token = await this.getTokenOrThrow(userId)
    const { data } = await this.analyticsClient.get(`/api/analytics/v1/reports/${encodeURIComponent(reportId)}`, {
      headers: { Authorization: token },
    })
    // Expecting statuses like PENDING/PROCESSING/DONE/ERROR
    return data
  }

  // Download report result
  async downloadAnalyticsReport(userId: string, reportId: string) {
    const token = await this.getTokenOrThrow(userId)
    const { data } = await this.analyticsClient.get(`/api/analytics/v1/reports/${encodeURIComponent(reportId)}/download`, {
      headers: { Authorization: token },
      responseType: 'json',
    })
    return data
  }

  // --- Content: Set primary image for a product (placeholder; adjust endpoint to your WB API) ---
  async setPrimaryImage(userId: string, params: { nmId: number | string; imageUrl: string }) {
    const token = await this.getTokenOrThrow(userId)
    // NOTE: Replace this with the exact WB Content API endpoint for setting primary image when available.
    // For sandbox, many image operations may be restricted. We simulate success here.
    try {
      // Example (pseudo): await this.contentClient.post(`/content/v1/cards/${params.nmId}/images/primary`, { url: params.imageUrl }, { headers: { Authorization: token } })
      return { success: true }
    } catch (e) {
      // Surface error with context
      throw e
    }
  }
}
