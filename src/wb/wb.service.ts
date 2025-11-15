import { BadRequestException, HttpException, Injectable } from '@nestjs/common'
import axios, { AxiosInstance } from 'axios'
import { ConfigService } from '@nestjs/config'
import { UsersService } from '../users/users.service'
import { PrismaService } from '../prisma/prisma.service'

@Injectable()
export class WbService {
  private analyticsClient: AxiosInstance
  private sellerAnalyticsClient: AxiosInstance
  private statisticsClient: AxiosInstance
  private advertClient: AxiosInstance
  private contentClient: AxiosInstance
  private limitsCache: { data: any; ts: number } | null = null

  constructor(
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
    private readonly prisma: PrismaService,
  ) {
    // Plan A: Use Statistics API as the single source of truth
    this.analyticsClient = axios.create({ baseURL: 'https://statistics-api.wildberries.ru' })
    this.sellerAnalyticsClient = axios.create({ baseURL: 'https://seller-analytics-api.wildberries.ru' })
    this.statisticsClient = axios.create({ baseURL: 'https://statistics-api.wildberries.ru' })
    this.advertClient = axios.create({ baseURL: 'https://advert-api.wildberries.ru' })
    this.contentClient = axios.create({ baseURL: 'https://content-api.wildberries.ru' })
  }

  // Seller Analytics v3: proxy products history exactly like the curl you provided
  async postSellerAnalyticsV3ProductsHistory(userId: string, body: any) {
    const token = await this.getTokenOrThrow(userId)
    try {
      const { data } = await this.sellerAnalyticsClient.post(
        '/api/analytics/v3/sales-funnel/products/history',
        body,
        { headers: { Authorization: token, 'Content-Type': 'application/json' } },
      )
      return data
    } catch (e: any) {
      const status = e?.response?.status || 502
      const message = e?.response?.data?.message || e?.message || 'Seller Analytics v3 products history failed'
      throw new HttpException({ message, details: e?.response?.data }, status)
    }
  }

  // --- Analytics rebuilt on top of Statistics API ---
  // body: { selectedPeriod: {start, end}, nmIds?: number[], ... }
  async postSalesFunnelProducts(userId: string, body: any) {
    const token = await this.getTokenOrThrow(userId)
    const start = body?.selectedPeriod?.start
    if (!start) throw new HttpException({ message: 'selectedPeriod.start is required' }, 400)
    // Pull orders and sales for the period. statistics API requires dateFrom; we fetch from start.
    const params: any = { dateFrom: start, flag: 0 }
    try {
      const [ordersRes, salesRes] = await Promise.all([
        this.statisticsClient.get('/api/v1/supplier/orders', { params, headers: { Authorization: token } }),
        this.statisticsClient.get('/api/v1/supplier/sales', { params, headers: { Authorization: token } }),
      ])
      const orders = Array.isArray(ordersRes.data) ? ordersRes.data : []
      const sales = Array.isArray(salesRes.data) ? salesRes.data : []
      const nmFilter: number[] | undefined = Array.isArray(body?.nmIds) ? body.nmIds : undefined
      const inFilter = (nm: any) => !nmFilter || nmFilter.includes(Number(nm))
      const byNm = new Map<number, { orders: number; sales: number }>()
      for (const o of orders) {
        const nm = Number(o?.nmId ?? o?.nmID ?? o?.nm)
        if (!Number.isFinite(nm) || !inFilter(nm)) continue
        const row = byNm.get(nm) || { orders: 0, sales: 0 }
        row.orders += 1
        byNm.set(nm, row)
      }
      for (const s of sales) {
        const nm = Number(s?.nmId ?? s?.nmID ?? s?.nm)
        if (!Number.isFinite(nm) || !inFilter(nm)) continue
        const row = byNm.get(nm) || { orders: 0, sales: 0 }
        row.sales += 1
        byNm.set(nm, row)
      }
      const items = Array.from(byNm.entries()).map(([nmId, v]) => ({ nmId, orders: v.orders, sales: v.sales }))
      return { items, periodStart: start }
    } catch (e: any) {
      const status = e?.response?.status || 502
      const message = e?.response?.data?.message || e?.message || 'Statistics aggregation failed'
      throw new HttpException({ message, details: e?.response?.data }, status)
    }
  }

  // Content: explicit cards list via the legacy endpoint you referenced
  // POST https://content-api.wildberries.ru/content/v2/get/cards/list
  async postContentCardsList(userId: string, body: any) {
    const token = this.normalizeAuthHeader(await this.getTokenOrThrow(userId))
    try {
      // Accept either ready 'settings' shape or wrap a simpler request into it
      const normalizedBody = (() => {
        if (body && typeof body === 'object' && body.settings) return body
        const limit = body?.cursor?.limit ?? body?.sort?.cursor?.limit ?? 100
        const textSearch = body?.filter?.textSearch ?? ''
        const withPhoto = body?.filter?.withPhoto ?? -1
        const updatedAt = body?.sort?.cursor?.updatedAt ?? 'desc'
        const nmID = body?.sort?.cursor?.nmID ?? 0
        return {
          settings: {
            cursor: { limit },
            filter: { textSearch, withPhoto },
            sort: { cursor: { updatedAt, nmID } },
          },
        }
      })()

      const attempt = async () => {
        const { data } = await this.contentClient.post('/content/v2/get/cards/list', normalizedBody, {
          headers: { Authorization: token },
        })
        return data
      }
      const data = await this.retryOn429(attempt)
      return data
    } catch (e: any) {
      const status = e?.response?.status || 502
      const message = e?.response?.data?.message || e?.message || 'WB Content cards list request failed'
      throw new HttpException({ message, details: e?.response?.data }, status)
    }
  }

  // body: { selectedPeriod: {start, end}, nmIds?: number[], aggregationLevel?: 'day'|'week' }
  async postSalesFunnelProductsHistory(userId: string, body: any) {
    const token = await this.getTokenOrThrow(userId)
    const startStr = body?.selectedPeriod?.start
    const endStr = body?.selectedPeriod?.end
    if (!startStr || !endStr) throw new HttpException({ message: 'selectedPeriod.start and end are required' }, 400)
    const start = new Date(startStr)
    const end = new Date(endStr)
    const nmFilter: number[] | undefined = Array.isArray(body?.nmIds) ? body.nmIds : undefined
    const bucket = (d: Date) => d.toISOString().slice(0, 10)
    const byNmDate = new Map<string, { orders: number; sales: number }>()
    try {
      const params: any = { dateFrom: startStr, flag: 0 }
      const [ordersRes, salesRes] = await Promise.all([
        this.statisticsClient.get('/api/v1/supplier/orders', { params, headers: { Authorization: token } }),
        this.statisticsClient.get('/api/v1/supplier/sales', { params, headers: { Authorization: token } }),
      ])
      const orders = Array.isArray(ordersRes.data) ? ordersRes.data : []
      const sales = Array.isArray(salesRes.data) ? salesRes.data : []
      const inFilter = (nm: any) => !nmFilter || nmFilter.includes(Number(nm))
      for (const o of orders) {
        const nm = Number(o?.nmId ?? o?.nmID ?? o?.nm)
        if (!Number.isFinite(nm) || !inFilter(nm)) continue
        const dt = new Date(o?.date ?? o?.lastChangeDate ?? o?.orderDate ?? Date.now())
        if (dt < start || dt > end) continue
        const key = `${nm}-${bucket(dt)}`
        const row = byNmDate.get(key) || { orders: 0, sales: 0 }
        row.orders += 1
        byNmDate.set(key, row)
      }
      for (const s of sales) {
        const nm = Number(s?.nmId ?? s?.nmID ?? s?.nm)
        if (!Number.isFinite(nm) || !inFilter(nm)) continue
        const dt = new Date(s?.date ?? s?.lastChangeDate ?? s?.saleDate ?? Date.now())
        if (dt < start || dt > end) continue
        const key = `${nm}-${bucket(dt)}`
        const row = byNmDate.get(key) || { orders: 0, sales: 0 }
        row.sales += 1
        byNmDate.set(key, row)
      }
      // Shape response
      const items: any[] = []
      for (const [key, val] of byNmDate.entries()) {
        const [nmIdStr, date] = key.split('-')
        items.push({ nmId: Number(nmIdStr), date, orders: val.orders, sales: val.sales })
      }
      // Sort by date
      items.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
      return { items, dateFrom: startStr, dateTo: endStr }
    } catch (e: any) {
      const status = e?.response?.status || 502
      const message = e?.response?.data?.message || e?.message || 'Statistics history aggregation failed'
      throw new HttpException({ message, details: e?.response?.data }, status)
    }
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
    // Prefer classic API token, but gracefully fallback to Partner token
    const apiToken = await this.usersService.getWbApiToken(userId)
    if (apiToken) return apiToken
    const partnerToken = await this.usersService.getWbPartnerToken(userId)
    if (partnerToken) return partnerToken
    throw new BadRequestException('WB API/Partner token is not set for this user')
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

  async postContentGoodsFilter(userId: string, filterBody: any) {
    const token = this.normalizeAuthHeader(await this.getTokenOrThrow(userId))
    try {
      const body = (filterBody && Object.keys(filterBody).length > 0)
        ? filterBody
        : { sort: { cursor: { limit: 100 } }, filter: {} }
      const mainAttempt = async () => {
        const { data } = await this.contentClient.post('/api/v2/list/goods/filter', body, {
          headers: { Authorization: token },
        })
        return data
      }
      const data = await this.retryOn429(mainAttempt)
      return data
    } catch (e: any) {
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
      // Provide clearer guidance on 401/403 (token missing Content permissions)
      const fallbackStatus = status || 502
      const message = (status === 401 || status === 403)
        ? 'WB Content goods filter unauthorized: ensure the token has Content permissions'
        : (e?.response?.data?.message || e?.message || 'WB Content goods filter failed')
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
