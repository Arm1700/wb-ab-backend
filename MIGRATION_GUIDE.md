# Миграция базы данных - Добавление воронки продаж

## Что добавлено

В модель `ProductMetric` добавлены новые поля для воронки продаж:
- `openCount` - количество открытий карточки товара
- `cartCount` - количество добавлений в корзину
- `buyoutCount` - количество выкупов
- `buyoutSum` - сумма выкупов

## Как применить миграцию

### Вариант 1: Автоматическая миграция (рекомендуется)

```bash
cd wb-ab-backend
npx prisma migrate dev --name add_sales_funnel_metrics
```

Эта команда:
1. Создаст SQL миграцию
2. Применит её к базе данных
3. Обновит Prisma Client

### Вариант 2: Ручная миграция (production)

```bash
# 1. Создать миграцию без применения
npx prisma migrate dev --create-only --name add_sales_funnel_metrics

# 2. Проверить созданный SQL файл в prisma/migrations/

# 3. Применить миграцию
npx prisma migrate deploy

# 4. Обновить Prisma Client
npx prisma generate
```

## После миграции

1. **Перезапустите сервер**
2. **Пересоздайте тестовые данные** с новыми полями:

```bash
# Удалить старые данные
curl -X DELETE http://localhost:3001/api/seed/all

# Создать новые данные с воронкой продаж
curl -X POST http://localhost:3001/api/seed/all \
  -H "Content-Type: application/json" \
  -d '{"productsCount": 20, "metricsDays": 30, "abTestsCount": 5}'
```

## Новые API эндпоинты

После миграции доступны новые эндпоинты:

### 1. Сводка воронки продаж
```bash
GET  http://localhost:3001/api/wb/analytics/sales-funnel/summary?dateFrom=2025-10-30&dateTo=2025-11-06
```

Возвращает:
- `impressions` - показы
- `openCount` - открытия карточки
- `cartCount` - добавления в корзину
- `orders` - заказы
- `buyoutCount` - выкупы
- `buyoutSum` - сумма выкупов
- `conversions` - конверсии на каждом этапе
- `avgBuyoutSum` - средний чек

### 2. Воронка продаж по дням
```bash
GET /api/wb/analytics/sales-funnel/daily?dateFrom=2025-10-30&dateTo=2025-11-06
```

Возвращает массив данных по дням с метриками и конверсиями.

## Проверка

```bash
# Проверить статистику
curl http://localhost:3001/api/seed/stats

# Проверить воронку продаж
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3001/api/wb/analytics/sales-funnel/summary
```
