# Seed Module - Генерация тестовых данных

Этот модуль предоставляет API для генерации тестовых данных, аналогично песочнице Wildberries (https://dev.wildberries.ru/sandbox).

## Доступные эндпоинты

Все эндпоинты доступны по адресу: `http://localhost:3001/api/seed`

### 1. Создать все тестовые данные сразу

**POST** `/api/seed/all`

Создает полный набор тестовых данных: продукты, метрики и A/B тесты.

**Body (опционально):**
```json
{
  "productsCount": 20,
  "metricsDays": 30,
  "abTestsCount": 5
}
```

**Пример запроса:**
```bash
curl -X POST http://localhost:3001/api/seed/all \
  -H "Content-Type: application/json" \
  -d '{"productsCount": 15, "metricsDays": 30, "abTestsCount": 3}'
```

### 2. Создать только продукты

**POST** `/api/seed/products?count=10`

Генерирует тестовые продукты с изображениями.

**Query параметры:**
- `count` - количество продуктов (по умолчанию 10)

**Пример запроса:**
```bash
curl -X POST "http://localhost:3001/api/seed/products?count=20"
```

### 3. Создать метрики для продуктов

**POST** `/api/seed/metrics?days=30&productsCount=10`

Генерирует метрики (показы, клики, заказы, выручка) для существующих продуктов.

**Query параметры:**
- `days` - количество дней назад (по умолчанию 30)
- `productsCount` - количество продуктов для генерации метрик (опционально)

**Пример запроса:**
```bash
curl -X POST "http://localhost:3001/api/seed/metrics?days=60&productsCount=15"
```

### 4. Создать A/B тесты

**POST** `/api/seed/abtests?count=5`

Генерирует A/B тесты с вариантами и метриками для существующих продуктов.

**Query параметры:**
- `count` - количество A/B тестов (по умолчанию 5)

**Пример запроса:**
```bash
curl -X POST "http://localhost:3001/api/seed/abtests?count=10"
```

### 5. Получить статистику

**GET** `/api/seed/stats`

Возвращает количество записей каждого типа в базе данных.

**Пример запроса:**
```bash
curl http://localhost:3001/api/seed/stats
```

**Пример ответа:**
```json
{
  "products": 20,
  "productMetrics": 600,
  "abTests": 5,
  "abVariants": 12,
  "abVariantMetrics": 168
}
```

### 6. Удалить все тестовые данные

**DELETE** `/api/seed/all`

Очищает базу данных от всех продуктов, метрик и A/B тестов.

**⚠️ ВНИМАНИЕ:** Это действие необратимо!

**Пример запроса:**
```bash
curl -X DELETE http://localhost:3001/api/seed/all
```

## Быстрый старт

### Вариант 1: Создать все данные одной командой

```bash
curl -X POST http://localhost:3001/api/seed/all \
  -H "Content-Type: application/json" \
  -d '{"productsCount": 20, "metricsDays": 30, "abTestsCount": 5}'
```

### Вариант 2: Пошаговое создание

```bash
# 1. Создать продукты
curl -X POST "http://localhost:3001/api/seed/products?count=20"

# 2. Создать метрики
curl -X POST "http://localhost:3001/api/seed/metrics?days=30"

# 3. Создать A/B тесты
curl -X POST "http://localhost:3001/api/seed/abtests?count=5"
```

## Что генерируется

### Продукты
- Случайные бренды: Nike, Adidas, Puma, Reebok, New Balance, Under Armour, Asics, Converse
- Типы товаров: Кроссовки, Футболка, Куртка, Рюкзак, Часы, Наушники, Шорты, Кепка
- 3-5 изображений для каждого продукта (используется Picsum для генерации)
- Уникальные nmId (артикулы Wildberries)

### Метрики
- **Impressions** (показы): 500-5500 в день
- **Clicks** (клики): 2-17% от показов (CTR)
- **Orders** (заказы): 5-30% от кликов (CR)
- **Revenue** (выручка): 500-3500 руб за заказ

### A/B тесты
- 2-3 варианта для каждого теста (A, B, C)
- Статусы: running, paused, finished
- Пороги: 1000, 1500, 2000, 2500 показов
- Метрики для каждого варианта за 7-14 дней
- Вариант B обычно показывает лучшие результаты на 20%

## Swagger документация

После запуска сервера доступна по адресу:
`http://localhost:3001/api/docs`

В Swagger UI вы найдете раздел **"Seed (Test Data)"** со всеми эндпоинтами.

## Использование для тестирования токенов

1. Создайте тестовые данные:
```bash
curl -X POST http://localhost:3001/api/seed/all
```

2. Проверьте, что данные созданы:
```bash
curl http://localhost:3001/api/seed/stats
```

3. Используйте созданные данные для тестирования API:
```bash
# Получить список продуктов
curl http://localhost:3001/api/products

# Получить A/B тесты
curl http://localhost:3001/api/abtests
```

4. Когда закончите тестирование, очистите данные:
```bash
curl -X DELETE http://localhost:3001/api/seed/all
```

## Примеры использования в Postman

### Создать все данные
```
POST http://localhost:3001/api/seed/all
Content-Type: application/json

{
  "productsCount": 25,
  "metricsDays": 45,
  "abTestsCount": 8
}
```

### Проверить статистику
```
GET http://localhost:3001/api/seed/stats
```

## Интеграция с фронтендом

После генерации данных, фронтенд сможет:
- Отображать список продуктов с изображениями
- Показывать графики метрик (показы, клики, заказы)
- Визуализировать результаты A/B тестов
- Сравнивать варианты изображений

## Troubleshooting

### Ошибка: "Нет продуктов для генерации метрик"
Сначала создайте продукты:
```bash
curl -X POST "http://localhost:3001/api/seed/products?count=10"
```

### Ошибка: "Нет продуктов для создания A/B тестов"
Сначала создайте продукты:
```bash
curl -X POST "http://localhost:3001/api/seed/products?count=10"
```

### Очистка и пересоздание данных
```bash
# Удалить все
curl -X DELETE http://localhost:3001/api/seed/all

# Создать заново
curl -X POST http://localhost:3001/api/seed/all
```
