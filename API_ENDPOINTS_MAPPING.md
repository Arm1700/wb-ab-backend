# Wildberries API Endpoints - Полная карта данных

## 📊 Текущая реализация (Sandbox + База данных)

### Источники данных в проекте

| Наш эндпоинт | Источник данных | WB API эндпоинт (для реального токена) |
|--------------|-----------------|----------------------------------------|
| `GET /api/wb/analytics/traffic/summary` | **База данных** (ProductMetric) | `GET /api/analytics/v1/traffic/summary` |
| `GET /api/wb/analytics/traffic/daily` | **База данных** (ProductMetric) | `GET /api/analytics/v1/traffic/daily` |
| `GET /api/wb/analytics/sales-funnel/summary` | **База данных** (ProductMetric) | `POST /api/analytics/v3/sales-funnel/products` |
| `GET /api/wb/analytics/sales-funnel/daily` | **База данных** (ProductMetric) | `POST /api/analytics/v3/sales-funnel/products/history` |
| `GET /api/wb/analytics/sales-funnel/products` | **WB Sandbox API** → fallback | `POST /api/analytics/v3/sales-funnel/products` |
| `GET /api/wb/content/cards/limits` | **WB Sandbox API** | `GET /content/v2/cards/limits` |
| `POST /api/wb/content/goods/filter` | **WB Sandbox API** → fallback | `POST /api/v2/list/goods/filter` |
| `GET /api/wb/advert/promotion/count` | **WB Sandbox API** | `GET /adv/v1/promotion/count` |

---

## 🔄 Поток данных

### 1. Трафик (Traffic)

**Наш эндпоинт:**
```
GET /api/wb/analytics/traffic/summary?dateFrom=2025-10-30&dateTo=2025-11-06
GET /api/wb/analytics/traffic/daily?dateFrom=2025-10-30&dateTo=2025-11-06
```

**Текущая реализация:**
- Читает из таблицы `ProductMetric` в PostgreSQL
- Агрегирует поля: `impressions`, `clicks`
- Вычисляет: `ctr = (clicks / impressions) * 100`

**Для реального WB API:**
```typescript
// В wb.service.ts, метод getTrafficSummary()
// Заменить:
const result = await this.prisma.productMetric.aggregate(...)

// На:
const { data } = await this.analyticsClient.get('/api/analytics/v1/traffic/summary', {
  params: { dateFrom, dateTo },
  headers: { Authorization: token }
})
```

**WB API документация:**
- Endpoint: `https://analytics-api.wildberries.ru/api/analytics/v1/traffic/summary`
- Method: `GET`
- Headers: `Authorization: <WB_TOKEN>`
- Query params: `dateFrom`, `dateTo` (YYYY-MM-DD)
- Response:
```json
{
  "impressions": 123456,
  "clicks": 12345,
  "ctr": 10.0
}
```

---

### 2. Воронка продаж (Sales Funnel)

**Наш эндпоинт:**
```
GET /api/wb/analytics/sales-funnel/summary?dateFrom=2025-10-30&dateTo=2025-11-06
GET /api/wb/analytics/sales-funnel/daily?dateFrom=2025-10-30&dateTo=2025-11-06
```

**Текущая реализация:**
- Читает из таблицы `ProductMetric`
- Поля: `impressions`, `openCount`, `cartCount`, `orders`, `buyoutCount`, `buyoutSum`
- Вычисляет конверсии между этапами

**Для реального WB API:**
```typescript
// В wb.service.ts, метод getSalesFunnelSummary()
// Заменить:
const result = await this.prisma.productMetric.aggregate(...)

// На:
const { data } = await this.analyticsClient.post('/api/analytics/v3/sales-funnel/products', {
  dateFrom,
  dateTo,
  // Опционально: фильтры по категориям, брендам
}, {
  headers: { Authorization: token }
})
```

**WB API документация:**
- Endpoint: `https://analytics-api.wildberries.ru/api/analytics/v3/sales-funnel/products`
- Method: `POST`
- Headers: `Authorization: <WB_TOKEN>`, `Content-Type: application/json`
- Body:
```json
{
  "dateFrom": "2025-10-30",
  "dateTo": "2025-11-06",
  "page": 1,
  "pageSize": 100
}
```
- Response:
```json
{
  "data": [
    {
      "nmID": 123456789,
      "name": "Product Name",
      "openCount": 1000,        // Открытия карточки
      "cartCount": 150,         // Добавления в корзину
      "orderCount": 50,         // Заказы
      "buyoutCount": 45,        // Выкупы
      "buyoutSum": 45000,       // Сумма выкупов
      "addToCartConversion": 15.0,
      "cartToOrderConversion": 33.3
    }
  ],
  "total": 100
}
```

**История по дням:**
- Endpoint: `https://analytics-api.wildberries.ru/api/analytics/v3/sales-funnel/products/history`
- Method: `POST`
- Body:
```json
{
  "dateFrom": "2025-10-30",
  "dateTo": "2025-11-06",
  "nmIDs": [123456789, 987654321],
  "period": "day"  // или "week"
}
```

---

### 3. Список товаров (Products)

**Наш эндпоинт:**
```
POST /api/wb/content/goods/filter
```

**Текущая реализация:**
- Пытается вызвать WB Sandbox API
- При ошибке 404 → возвращает пустой массив или создает demo продукты

**Для реального WB API:**
```typescript
// В wb.service.ts, метод postContentGoodsFilter()
// Уже реализовано, просто нужен настоящий токен
const { data } = await this.contentClient.post('/api/v2/list/goods/filter', 
  filterBody, 
  { headers: { Authorization: token } }
)
```

**WB API документация:**
- Endpoint: `https://content-api.wildberries.ru/api/v2/list/goods/filter`
- Method: `POST`
- Headers: `Authorization: <WB_TOKEN>`
- Body:
```json
{
  "limit": 100,
  "offset": 0,
  "filterNmID": 0,
  "query": ""
}
```
- Response:
```json
{
  "data": [
    {
      "nmID": 123456789,
      "vendorCode": "ART-001",
      "title": "Product Name",
      "brand": "Brand Name",
      "photos": [
        {
          "big": "https://...",
          "small": "https://..."
        }
      ]
    }
  ],
  "cursor": {
    "total": 100
  }
}
```

---

### 4. Лимиты карточек (Content Limits)

**Наш эндпоинт:**
```
GET /api/wb/content/cards/limits
```

**Текущая реализация:**
- Вызывает WB Sandbox API напрямую

**WB API документация:**
- Endpoint: `https://content-api.wildberries.ru/content/v2/cards/limits`
- Method: `GET`
- Headers: `Authorization: <WB_TOKEN>`
- Response:
```json
{
  "freeLimits": 1000,
  "paidLimits": 5000
}
```

---

### 5. Рекламные кампании (Advert)

**Наш эндпоинт:**
```
GET /api/wb/advert/promotion/count
```

**Текущая реализация:**
- Вызывает WB Sandbox API напрямую

**WB API документация:**
- Endpoint: `https://advert-api.wildberries.ru/adv/v1/promotion/count`
- Method: `GET`
- Headers: `Authorization: <WB_TOKEN>`
- Response:
```json
{
  "all": 10,
  "active": 5,
  "paused": 3,
  "completed": 2
}
```

---

## 🔧 Как переключиться на реальный WB API

### Шаг 1: Обновить базовые URL

В файле `wb.service.ts` (конструктор):

```typescript
// Было (sandbox):
const analyticsBaseURL = 'https://analytics-api-sandbox.wildberries.ru'
const advertBaseURL = 'https://advert-api-sandbox.wildberries.ru'
const contentBaseURL = 'https://content-api-sandbox.wildberries.ru'

// Стало (production):
const analyticsBaseURL = 'https://analytics-api.wildberries.ru'
const advertBaseURL = 'https://advert-api.wildberries.ru'
const contentBaseURL = 'https://content-api.wildberries.ru'
```

Или через переменные окружения в `.env`:
```env
WB_ANALYTICS_BASE_URL=https://analytics-api.wildberries.ru
WB_ADVERT_BASE_URL=https://advert-api.wildberries.ru
WB_CONTENT_BASE_URL=https://content-api.wildberries.ru
```

### Шаг 2: Заменить методы на WB API вызовы

**Файл:** `src/wb/wb.service.ts`

#### getTrafficSummary (строка ~108)
```typescript
// Заменить весь метод на:
async getTrafficSummary(userId: string, params?: { dateFrom?: string; dateTo?: string }) {
  const token = await this.getTokenOrThrow(userId)
  const end = params?.dateTo ? new Date(params.dateTo) : new Date()
  const start = params?.dateFrom ? new Date(params.dateFrom) : new Date(end.getTime() - 6 * 24 * 60 * 60 * 1000)

  const dateFromIso = start.toISOString().slice(0, 10)
  const dateToIso = end.toISOString().slice(0, 10)

  try {
    const { data } = await this.analyticsClient.get('/api/analytics/v1/traffic/summary', {
      params: { dateFrom: dateFromIso, dateTo: dateToIso },
      headers: { Authorization: token },
    })

    return {
      dateFrom: dateFromIso,
      dateTo: dateToIso,
      impressions: Number(data?.impressions ?? 0),
      clicks: Number(data?.clicks ?? 0),
      ctr: Number(data?.ctr ?? 0),
    }
  } catch (err) {
    console.error('WB API error:', err)
    return { dateFrom: dateFromIso, dateTo: dateToIso, impressions: 0, clicks: 0, ctr: 0 }
  }
}
```

#### getTrafficDaily (строка ~28)
```typescript
async getTrafficDaily(userId: string, params?: { dateFrom?: string; dateTo?: string }) {
  const token = await this.getTokenOrThrow(userId)
  const end = params?.dateTo ? new Date(params.dateTo) : new Date()
  const start = params?.dateFrom ? new Date(params.dateFrom) : new Date(end.getTime() - 6 * 24 * 60 * 60 * 1000)

  const dateFromIso = start.toISOString().slice(0, 10)
  const dateToIso = end.toISOString().slice(0, 10)

  try {
    const { data } = await this.analyticsClient.get('/api/analytics/v1/traffic/daily', {
      params: { dateFrom: dateFromIso, dateTo: dateToIso },
      headers: { Authorization: token },
    })

    const items = Array.isArray(data) ? data.map(d => ({
      date: d.date,
      impressions: Number(d.impressions ?? 0),
      clicks: Number(d.clicks ?? 0),
      ctr: d.impressions > 0 ? Number(((d.clicks / d.impressions) * 100).toFixed(2)) : 0
    })) : []

    return { dateFrom: dateFromIso, dateTo: dateToIso, items }
  } catch (err) {
    console.error('WB API error:', err)
    return { dateFrom: dateFromIso, dateTo: dateToIso, items: [] }
  }
}
```

#### getSalesFunnelSummary (строка ~172)
```typescript
async getSalesFunnelSummary(userId: string, params?: { dateFrom?: string; dateTo?: string }) {
  const token = await this.getTokenOrThrow(userId)
  const end = params?.dateTo ? new Date(params.dateTo) : new Date()
  const start = params?.dateFrom ? new Date(params.dateFrom) : new Date(end.getTime() - 6 * 24 * 60 * 60 * 1000)

  const dateFromIso = start.toISOString().slice(0, 10)
  const dateToIso = end.toISOString().slice(0, 10)

  try {
    const { data } = await this.analyticsClient.post('/api/analytics/v3/sales-funnel/products', {
      dateFrom: dateFromIso,
      dateTo: dateToIso,
      page: 1,
      pageSize: 1000
    }, {
      headers: { Authorization: token },
    })

    // Агрегируем данные по всем продуктам
    const products = Array.isArray(data?.data) ? data.data : []
    const totals = products.reduce((acc, p) => ({
      impressions: acc.impressions + (p.impressions || 0),
      openCount: acc.openCount + (p.openCount || 0),
      cartCount: acc.cartCount + (p.cartCount || 0),
      orders: acc.orders + (p.orderCount || 0),
      buyoutCount: acc.buyoutCount + (p.buyoutCount || 0),
      buyoutSum: acc.buyoutSum + (p.buyoutSum || 0),
    }), { impressions: 0, openCount: 0, cartCount: 0, orders: 0, buyoutCount: 0, buyoutSum: 0 })

    const viewToOpen = totals.impressions > 0 ? Number(((totals.openCount / totals.impressions) * 100).toFixed(2)) : 0
    const openToCart = totals.openCount > 0 ? Number(((totals.cartCount / totals.openCount) * 100).toFixed(2)) : 0
    const cartToOrder = totals.cartCount > 0 ? Number(((totals.orders / totals.cartCount) * 100).toFixed(2)) : 0
    const orderToBuyout = totals.orders > 0 ? Number(((totals.buyoutCount / totals.orders) * 100).toFixed(2)) : 0
    const avgBuyoutSum = totals.buyoutCount > 0 ? Number((totals.buyoutSum / totals.buyoutCount).toFixed(2)) : 0

    return {
      dateFrom: dateFromIso,
      dateTo: dateToIso,
      ...totals,
      conversions: { viewToOpen, openToCart, cartToOrder, orderToBuyout },
      avgBuyoutSum,
    }
  } catch (err) {
    console.error('WB API error:', err)
    return {
      dateFrom: dateFromIso,
      dateTo: dateToIso,
      impressions: 0,
      openCount: 0,
      cartCount: 0,
      orders: 0,
      buyoutCount: 0,
      buyoutSum: 0,
      conversions: { viewToOpen: 0, openToCart: 0, cartToOrder: 0, orderToBuyout: 0 },
      avgBuyoutSum: 0,
    }
  }
}
```

#### getSalesFunnelDaily (строка ~254)
```typescript
async getSalesFunnelDaily(userId: string, params?: { dateFrom?: string; dateTo?: string }) {
  const token = await this.getTokenOrThrow(userId)
  const end = params?.dateTo ? new Date(params.dateTo) : new Date()
  const start = params?.dateFrom ? new Date(params.dateFrom) : new Date(end.getTime() - 6 * 24 * 60 * 60 * 1000)

  const dateFromIso = start.toISOString().slice(0, 10)
  const dateToIso = end.toISOString().slice(0, 10)

  try {
    const { data } = await this.analyticsClient.post('/api/analytics/v3/sales-funnel/products/history', {
      dateFrom: dateFromIso,
      dateTo: dateToIso,
      period: 'day'
    }, {
      headers: { Authorization: token },
    })

    const items = Array.isArray(data?.data) ? data.data.map(d => {
      const impressions = Number(d.impressions ?? 0)
      const openCount = Number(d.openCount ?? 0)
      const cartCount = Number(d.cartCount ?? 0)
      const orders = Number(d.orderCount ?? 0)
      const buyoutCount = Number(d.buyoutCount ?? 0)
      const buyoutSum = Number(d.buyoutSum ?? 0)

      return {
        date: d.date,
        impressions,
        openCount,
        cartCount,
        orders,
        buyoutCount,
        buyoutSum,
        viewToOpen: impressions > 0 ? Number(((openCount / impressions) * 100).toFixed(2)) : 0,
        openToCart: openCount > 0 ? Number(((cartCount / openCount) * 100).toFixed(2)) : 0,
        cartToOrder: cartCount > 0 ? Number(((orders / cartCount) * 100).toFixed(2)) : 0,
      }
    }) : []

    return { dateFrom: dateFromIso, dateTo: dateToIso, items }
  } catch (err) {
    console.error('WB API error:', err)
    return { dateFrom: dateFromIso, dateTo: dateToIso, items: [] }
  }
}
```

---

## 📝 Дополнительные WB API эндпоинты

### Региональные продажи
```
GET https://analytics-api.wildberries.ru/api/v1/analytics/region-sale
Headers: Authorization: <WB_TOKEN>
Query: dateFrom, dateTo
```

### Заблокированные товары
```
GET https://analytics-api.wildberries.ru/api/v1/analytics/banned-products/blocked
GET https://analytics-api.wildberries.ru/api/v1/analytics/banned-products/shadowed
Headers: Authorization: <WB_TOKEN>
```

---

## 📊 Экспорт отчетов (CSV, XLSX, ZIP)

### 1. Финансовые отчеты
**Отчет по периоду (выплаты, комиссии, компенсации)**
```
GET https://statistics-api.wildberries.ru/api/v1/supplier/reportDetailByPeriod
Headers: Authorization: <WB_TOKEN>
Query: 
  - dateFrom: YYYY-MM-DD
  - dateTo: YYYY-MM-DD
  - limit: 100000
  - rrdid: 0
Response: JSON массив с детализацией по каждой операции
```

**Продажи и возвраты**
```
GET https://statistics-api.wildberries.ru/api/v1/supplier/sales
Headers: Authorization: <WB_TOKEN>
Query: dateFrom, flag (0 - продажи, 1 - возвраты)
Response: JSON массив продаж/возвратов
```

**Заказы**
```
GET https://statistics-api.wildberries.ru/api/v1/supplier/orders
Headers: Authorization: <WB_TOKEN>
Query: dateFrom, flag (0 - новые, 1 - отмененные)
Response: JSON массив заказов
```

### 2. Экспорт карточек товаров (CSV)

**Создание задачи на экспорт**
```
POST https://content-api.wildberries.ru/content/v1/cards/csv/create/task
Headers: Authorization: <WB_TOKEN>
Body: { "nmIDs": [123456, 789012] } // опционально, если пусто - все товары
Response: { "taskId": "uuid-string" }
```

**Проверка статуса задачи**
```
GET https://content-api.wildberries.ru/content/v1/cards/csv/tasks
Headers: Authorization: <WB_TOKEN>
Response: [{ "taskId": "...", "status": "done", "createdAt": "..." }]
```

**Скачивание CSV файла**
```
GET https://content-api.wildberries.ru/content/v1/cards/csv/{taskId}
Headers: Authorization: <WB_TOKEN>
Response: CSV file или ссылка на скачивание
```

### 3. Экспорт рекламных отчетов

**Создание задачи экспорта**
```
POST https://advert-api.wildberries.ru/adv/v1/export/tasks
Headers: Authorization: <WB_TOKEN>
Body: {
  "dateFrom": "2025-10-01",
  "dateTo": "2025-10-31",
  "type": "campaigns" // или "statistics"
}
Response: { "taskId": "uuid" }
```

**Получение статуса и файла**
```
GET https://advert-api.wildberries.ru/adv/v1/export/tasks/{taskId}
Headers: Authorization: <WB_TOKEN>
Response: { "status": "done", "downloadUrl": "https://..." }
```

### 4. Асинхронные аналитические отчеты

**Создание задачи метрик**
```
POST https://analytics-api.wildberries.ru/api/v1/analytics/data/metrics/tasks
Headers: Authorization: <WB_TOKEN>
Body: {
  "dateFrom": "2025-10-01",
  "dateTo": "2025-10-31",
  "metrics": ["sales", "revenue", "orders"]
}
Response: { "taskId": "uuid" }
```

**Воронка продаж (асинхронно)**
```
POST https://analytics-api.wildberries.ru/api/v1/analytics/sales-funnel/tasks
Headers: Authorization: <WB_TOKEN>
Body: { "dateFrom": "...", "dateTo": "..." }
Response: { "taskId": "uuid" }
```

**Трафик карточек (асинхронно)**
```
POST https://analytics-api.wildberries.ru/api/v1/analytics/traffic/tasks
Headers: Authorization: <WB_TOKEN>
Body: { "dateFrom": "...", "dateTo": "..." }
Response: { "taskId": "uuid" }
```

**Проверка статуса задачи**
```
GET https://analytics-api.wildberries.ru/api/v1/analytics/tasks/{taskId}
Headers: Authorization: <WB_TOKEN>
Response: { "status": "processing" | "done" | "error" }
```

**Скачивание результата**
```
GET https://analytics-api.wildberries.ru/api/v1/analytics/tasks/file/{taskId}
Headers: Authorization: <WB_TOKEN>
Response: ZIP файл с CSV внутри
```

### 5. Возвраты и остатки

**Возвраты**
```
GET https://statistics-api.wildberries.ru/api/v1/supplier/returns
Headers: Authorization: <WB_TOKEN>
Query: dateFrom, dateTo
Response: JSON массив возвратов
```

**Остатки на складах**
```
GET https://statistics-api.wildberries.ru/api/v1/supplier/stocks
Headers: Authorization: <WB_TOKEN>
Query: dateFrom (опционально, может не поддерживаться)
Response: JSON массив остатков по складам

Примечание: Эндпоинт может отличаться в зависимости от версии API.
Альтернативный путь: GET /api/v3/stocks/{warehouseId}
```

**Аналитика остатков**
```
GET https://analytics-api.wildberries.ru/api/analytics/v1/stock
Headers: Authorization: <WB_TOKEN>
Query: dateFrom, dateTo
Response: Оборачиваемость и статистика склада
```

---

## 🔑 Получение токена WB

1. Зайти в личный кабинет WB: https://seller.wildberries.ru/
2. Настройки → API → Создать токен
3. Выбрать права доступа:
   - Аналитика (чтение)
   - Контент (чтение/запись)
   - Реклама (чтение)
4. Скопировать токен и сохранить в приложении

---

## ⚠️ Важные замечания

1. **Rate Limiting**: WB API имеет лимиты запросов (обычно 100-1000 req/min)
2. **Кэширование**: Рекомендуется кэшировать ответы на 5-60 минут
3. **Ошибки 429**: Реализована retry логика в `retryOn429()` методе
4. **Токен безопасность**: Токен хранится зашифрованным в БД
5. **Sandbox vs Production**: Sandbox может не иметь всех эндпоинтов

---

## 📚 Официальная документация WB

- Портал разработчика: https://dev.wildberries.ru/
- API документация: https://openapi.wildberries.ru/
- Sandbox: https://dev.wildberries.ru/sandbox
