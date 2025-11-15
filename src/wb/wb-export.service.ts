import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { UsersService } from '../users/users.service'
import axios, { AxiosInstance } from 'axios'

@Injectable()
export class WbExportService {
  private statisticsClient: AxiosInstance
  private contentClient: AxiosInstance
  private advertClient: AxiosInstance
  private analyticsClient: AxiosInstance

  constructor(
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
  ) {
    const statisticsBaseURL = this.configService.get<string>('wb.statisticsBaseUrl') || 'https://statistics-api.wildberries.ru'
    const contentBaseURL = this.configService.get<string>('wb.contentBaseUrl') || 'https://content-api.wildberries.ru'
    const advertBaseURL = this.configService.get<string>('wb.advertBaseUrl') || 'https://advert-api.wildberries.ru'
    const analyticsBaseURL = this.configService.get<string>('wb.analyticsBaseUrl') || 'https://seller-analytics-api.wildberries.ru'

    this.statisticsClient = axios.create({ baseURL: statisticsBaseURL })
    this.contentClient = axios.create({ baseURL: contentBaseURL })
    this.advertClient = axios.create({ baseURL: advertBaseURL })
    this.analyticsClient = axios.create({ baseURL: analyticsBaseURL })
  }

  // ==================== ФИНАНСОВЫЕ ОТЧЕТЫ ====================

  /**
   * Получить детальный финансовый отчет за период
   * Включает: выплаты, комиссии, компенсации
   */
  async getFinancialReport(userId: string, params: { dateFrom: string; dateTo: string; limit?: number }) {
    const token = await this.getTokenOrThrow(userId)
    
    try {
      const { data } = await this.statisticsClient.get('/api/v1/supplier/reportDetailByPeriod', {
        params: {
          dateFrom: params.dateFrom,
          dateTo: params.dateTo,
          limit: params.limit || 100000,
          rrdid: 0,
        },
        headers: { Authorization: token },
      })

      return data
    } catch (error: any) {
      console.error('Error fetching financial report:', error?.response?.data || error.message)
      // Возвращаем пустой массив если эндпоинт недоступен
      return []
    }
  }

  /**
   * Получить продажи или возвраты
   * flag: 0 - продажи, 1 - возвраты
   */
  async getSalesOrReturns(userId: string, params: { dateFrom: string; flag: 0 | 1 }) {
    const token = await this.getTokenOrThrow(userId)
    
    try {
      const { data } = await this.statisticsClient.get('/api/v1/supplier/sales', {
        params: {
          dateFrom: params.dateFrom,
          flag: params.flag,
        },
        headers: { Authorization: token },
      })

      return data
    } catch (error: any) {
      console.error('Error fetching sales/returns:', error?.response?.data || error.message)
      return []
    }
  }

  /**
   * Получить заказы
   * flag: 0 - новые, 1 - отмененные
   */
  async getOrders(userId: string, params: { dateFrom: string; flag: 0 | 1 }) {
    const token = await this.getTokenOrThrow(userId)
    
    try {
      const { data } = await this.statisticsClient.get('/api/v1/supplier/orders', {
        params: {
          dateFrom: params.dateFrom,
          flag: params.flag,
        },
        headers: { Authorization: token },
      })

      return data
    } catch (error: any) {
      console.error('Error fetching orders:', error?.response?.data || error.message)
      return []
    }
  }

  /**
   * Получить возвраты за период
   */
  async getReturns(userId: string, params: { dateFrom: string; dateTo: string }) {
    const token = await this.getTokenOrThrow(userId)
    
    try {
      const { data } = await this.statisticsClient.get('/api/v1/supplier/returns', {
        params: {
          dateFrom: params.dateFrom,
          dateTo: params.dateTo,
        },
        headers: { Authorization: token },
      })

      return data
    } catch (error: any) {
      console.error('Error fetching returns:', error?.response?.data || error.message)
      return []
    }
  }

  /**
   * Получить остатки на складах
   * Правильный эндпоинт: GET /api/v1/supplier/stocks (без параметров dateFrom)
   */
  async getStocks(userId: string, params: { dateFrom: string }) {
    const token = await this.getTokenOrThrow(userId)
    
    try {
      // WB API для остатков не требует dateFrom, возвращает текущие остатки
      const { data } = await this.statisticsClient.get('/api/v1/supplier/stocks', {
        headers: { Authorization: token },
      })

      return data
    } catch (error: any) {
      // Если эндпоинт не доступен, возвращаем пустой массив
      console.error('Error fetching stocks:', error?.response?.data || error.message)
      return []
    }
  }

  // ==================== ЭКСПОРТ КАРТОЧЕК ТОВАРОВ ====================

  /**
   * Создать задачу на экспорт карточек товаров в CSV
   */
  async createProductsExportTask(userId: string, nmIDs?: number[]) {
    const token = await this.getTokenOrThrow(userId)
    
    try {
      const { data } = await this.contentClient.post(
        '/content/v1/cards/csv/create/task',
        nmIDs ? { nmIDs } : {},
        { headers: { Authorization: token } }
      )

      return data // { taskId: "uuid" }
    } catch (error: any) {
      const errorData = error?.response?.data
      const errorMessage = errorData?.title || errorData?.detail || error.message
      
      console.error('Error creating products export task:', {
        status: error?.response?.status,
        statusText: error?.response?.statusText,
        error: errorData,
        endpoint: '/content/v1/cards/csv/create/task'
      })
      
      throw new Error(`Не удалось создать задачу экспорта: ${errorMessage}. Эндпоинт может быть недоступен в sandbox режиме.`)
    }
  }

  /**
   * Получить статус задач экспорта карточек
   */
  async getProductsExportTasks(userId: string) {
    const token = await this.getTokenOrThrow(userId)
    
    try {
      const { data } = await this.contentClient.get('/content/v1/cards/csv/tasks', {
        headers: { Authorization: token },
      })

      return data // [{ taskId, status, createdAt }]
    } catch (error: any) {
      console.error('Error fetching export tasks:', error?.response?.data || error.message)
      return []
    }
  }

  /**
   * Скачать CSV файл карточек товаров
   */
  async downloadProductsExport(userId: string, taskId: string) {
    const token = await this.getTokenOrThrow(userId)
    
    try {
      const { data } = await this.contentClient.get(`/content/v1/cards/csv/${taskId}`, {
        headers: { Authorization: token },
        responseType: 'arraybuffer', // для бинарных данных
      })

      return data
    } catch (error: any) {
      const errorData = error?.response?.data
      console.error('Error downloading export:', {
        status: error?.response?.status,
        error: errorData,
        taskId
      })
      
      throw new Error(`Не удалось скачать файл: ${errorData?.title || error.message}`)
    }
  }

  // ==================== ЭКСПОРТ РЕКЛАМНЫХ ОТЧЕТОВ ====================

  /**
   * Создать задачу экспорта рекламных данных
   * type: "campaigns" | "statistics"
   */
  async createAdvertExportTask(userId: string, params: { dateFrom: string; dateTo: string; type: string }) {
    const token = await this.getTokenOrThrow(userId)
    
    try {
      const { data } = await this.advertClient.post(
        '/adv/v1/export/tasks',
        {
          dateFrom: params.dateFrom,
          dateTo: params.dateTo,
          type: params.type,
        },
        { headers: { Authorization: token } }
      )

      return data // { taskId: "uuid" }
    } catch (error: any) {
      const errorData = error?.response?.data
      console.error('Error creating advert export task:', {
        status: error?.response?.status,
        error: errorData
      })
      
      throw new Error(`Ошибка создания задачи рекламы: ${errorData?.title || error.message}`)
    }
  }

  /**
   * Получить статус и ссылку на скачивание рекламного отчета
   */
  async getAdvertExportTask(userId: string, taskId: string) {
    const token = await this.getTokenOrThrow(userId)
    
    try {
      const { data } = await this.advertClient.get(`/adv/v1/export/tasks/${taskId}`, {
        headers: { Authorization: token },
      })

      return data // { status: "done", downloadUrl: "https://..." }
    } catch (error: any) {
      console.error('Error fetching advert task:', error?.response?.data || error.message)
      return { status: 'error', error: error.message }
    }
  }

  // ==================== АСИНХРОННЫЕ АНАЛИТИЧЕСКИЕ ОТЧЕТЫ ====================

  /**
   * Создать задачу экспорта метрик
   */
  async createMetricsExportTask(userId: string, params: { dateFrom: string; dateTo: string; metrics: string[] }) {
    const token = await this.getTokenOrThrow(userId)
    
    const { data } = await this.analyticsClient.post(
      '/api/v1/analytics/data/metrics/tasks',
      {
        dateFrom: params.dateFrom,
        dateTo: params.dateTo,
        metrics: params.metrics,
      },
      { headers: { Authorization: token } }
    )

    return data // { taskId: "uuid" }
  }

  /**
   * Создать задачу экспорта воронки продаж
   */
  async createSalesFunnelExportTask(userId: string, params: { dateFrom: string; dateTo: string }) {
    const token = await this.getTokenOrThrow(userId)
    
    const { data } = await this.analyticsClient.post(
      '/api/v1/analytics/sales-funnel/tasks',
      {
        dateFrom: params.dateFrom,
        dateTo: params.dateTo,
      },
      { headers: { Authorization: token } }
    )

    return data // { taskId: "uuid" }
  }

  /**
   * Создать задачу экспорта трафика
   */
  async createTrafficExportTask(userId: string, params: { dateFrom: string; dateTo: string }) {
    const token = await this.getTokenOrThrow(userId)
    
    const { data } = await this.analyticsClient.post(
      '/api/v1/analytics/traffic/tasks',
      {
        dateFrom: params.dateFrom,
        dateTo: params.dateTo,
      },
      { headers: { Authorization: token } }
    )

    return data // { taskId: "uuid" }
  }

  /**
   * Проверить статус аналитической задачи
   */
  async getAnalyticsTaskStatus(userId: string, taskId: string) {
    const token = await this.getTokenOrThrow(userId)
    
    const { data } = await this.analyticsClient.get(`/api/v1/analytics/tasks/${taskId}`, {
      headers: { Authorization: token },
    })

    return data // { status: "processing" | "done" | "error" }
  }

  /**
   * Скачать результат аналитической задачи (ZIP с CSV)
   */
  async downloadAnalyticsTaskFile(userId: string, taskId: string) {
    const token = await this.getTokenOrThrow(userId)
    
    const { data } = await this.analyticsClient.get(`/api/v1/analytics/tasks/file/${taskId}`, {
      headers: { Authorization: token },
      responseType: 'arraybuffer',
    })

    return data
  }

  /**
   * Получить список карточек товаров с Wildberries (v2)
   * Полностью аналогично curl-запросу:
   * POST https://content-api.wildberries.ru/content/v2/get/cards/list
   */
  async getProductsList(
    userId: string,
    params?: {
      limit?: number
      textSearch?: string
      withPhoto?: -1 | 0 | 1
      updatedAt?: string
      nmID?: number
    },
  ) {
    const rawToken = await this.getTokenForWBContent(userId)
    const token = this.normalizeAuthHeader(rawToken)
    try {
      const body = {
        settings: {
          cursor: {
            limit: params?.limit ?? 100,
          },
          filter: {
            textSearch: params?.textSearch ?? '',
            withPhoto: params?.withPhoto ?? -1,
          },
          sort: {
            cursor: {
              updatedAt: params?.updatedAt ?? 'desc',
              nmID: params?.nmID ?? 0,
            },
          },
        },
      }

      console.debug('[WB][getProductsList] request', {
        limit: body.settings.cursor.limit,
        textSearch: body.settings.filter.textSearch,
        withPhoto: body.settings.filter.withPhoto,
        updatedAt: body.settings.sort.cursor.updatedAt,
        nmID: body.settings.sort.cursor.nmID,
        tokenMeta: {
          length: typeof token === 'string' ? token.length : 0,
          hasBearerPrefix: typeof rawToken === 'string' ? rawToken.startsWith('Bearer ') : false,
        },
      })

      const { data } = await this.contentClient.post(
        '/content/v2/get/cards/list',
        body,
        { headers: { Authorization: token } },
      )
      console.log('data', data)

      const cardsLen = Array.isArray((data as any)?.cards) ? (data as any).cards.length : 0
      const cursor = (data as any)?.cursor
      console.debug('[WB][getProductsList] response', {
        cards: cardsLen,
        cursor,
      })

      // WB возвращает объект вида { cards: [...], cursor: {...} }
      return data
    } catch (error: any) {
      console.error('[WB][getProductsList] error', {
        status: error?.response?.status,
        statusText: error?.response?.statusText,
        data: error?.response?.data,
      })
      throw new Error(
        `Не удалось получить список карточек WB: ${error?.response?.data?.detail || error.message}`,
      )
    }
  }

  /**
   * Забрать все карточки постранично по курсору updatedAt/nmID
   */
  async fetchAllProducts(userId: string, params?: { limit?: number; textSearch?: string; withPhoto?: -1 | 0 | 1 }) {
    const allCards: any[] = []
    const seen = new Set<string>() // nmID set
    let updatedAt: string | undefined = undefined
    let nmID: number | undefined = undefined
    let prevCursorKey: string | undefined
    const limit = params?.limit ?? 100

    while (true) {
      const res: any = await this.getProductsList(userId, {
        limit,
        textSearch: params?.textSearch,
        withPhoto: params?.withPhoto,
        updatedAt,
        nmID,
      })

      const cards: any[] = Array.isArray(res?.cards) ? res.cards : []
      const cursor = res?.cursor
      console.debug('[WB][fetchAllProducts] batch', { size: cards.length, cursor })

      if (!cards.length) {
        console.info('[WB][fetchAllProducts] break: empty batch')
        break
      }

      // de-duplicate by nmID
      for (const c of cards) {
        const key = String(c?.nmID ?? c?.nmId ?? c?.id ?? '')
        if (!key || seen.has(key)) continue
        seen.add(key)
        allCards.push(c)
      }

      const nextUpdatedAt = cursor?.updatedAt
      const nextNmID = cursor?.nmID
      const cursorKey = `${nextUpdatedAt ?? ''}-${nextNmID ?? ''}`

      // Break if cursor is missing
      if (!nextUpdatedAt || !Number.isFinite(Number(nextNmID))) {
        console.info('[WB][fetchAllProducts] break: missing cursor', { nextUpdatedAt, nextNmID })
        break
      }

      // Break if cursor does not advance (WB repeats the same page)
      if (prevCursorKey && prevCursorKey === cursorKey) {
        console.warn('[WB][fetchAllProducts] break: cursor did not advance', { cursorKey })
        break
      }

      // Heuristic: if batch smaller than limit -> last page
      if (cards.length < limit) {
        console.info('[WB][fetchAllProducts] break: last page (size < limit)', { size: cards.length, limit })
        break
      }

      // advance
      prevCursorKey = cursorKey
      updatedAt = nextUpdatedAt
      nmID = nextNmID
    }

    console.info('[WB][fetchAllProducts] done', { total: allCards.length })
    return allCards
  }

  // ==================== ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ ====================

  private async getTokenOrThrow(userId: string): Promise<string> {
    const token = await this.usersService.getWbApiToken(userId)
    if (!token) throw new Error('WB API token is not set for this user')
    return token
  }

  private normalizeAuthHeader(rawToken: string): string {
    if (!rawToken) return rawToken
    const t = rawToken.trim()
    // всегда возвращаем токен с Bearer
    return t.startsWith('Bearer ') ? t : `Bearer ${t}`
  }
  

  private async getTokenForWBContent(userId: string): Promise<string> {
    const token = await this.usersService.getWbPartnerToken(userId)
    if (!token) throw new Error('WB partner API token is not set for this user')
    return token
  }
}
