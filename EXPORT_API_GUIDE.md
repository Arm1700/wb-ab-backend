# Руководство по экспорту отчетов WB

## 📦 Доступные эндпоинты экспорта

### 1. Финансовые отчеты

#### Детальный финансовый отчет
```bash
GET /api/wb/export/financial/report?dateFrom=2025-10-01&dateTo=2025-10-31&limit=100000
```
**Возвращает:** JSON массив с детализацией выплат, комиссий, компенсаций

#### Продажи
```bash
GET /api/wb/export/sales?dateFrom=2025-10-01
```
**Возвращает:** JSON массив продаж

#### Возвраты
```bash
GET /api/wb/export/returns?dateFrom=2025-10-01&dateTo=2025-10-31
```
**Возвращает:** JSON массив возвратов

#### Заказы
```bash
GET /api/wb/export/orders?dateFrom=2025-10-01&flag=0
```
**Query params:**
- `flag=0` - новые заказы
- `flag=1` - отмененные заказы

#### Остатки на складах
```bash
GET /api/wb/export/stocks?dateFrom=2025-10-01
```
**Возвращает:** JSON массив остатков по складам

---

### 2. Экспорт карточек товаров (CSV)

#### Шаг 1: Создать задачу экспорта
```bash
POST /api/wb/export/products/create-task
Content-Type: application/json

{
  "nmIDs": [123456, 789012]  // опционально, если пусто - все товары
}
```
**Возвращает:**
```json
{
  "taskId": "550e8400-e29b-41d4-a716-446655440000"
}
```

#### Шаг 2: Проверить статус задачи
```bash
GET /api/wb/export/products/tasks
```
**Возвращает:**
```json
[
  {
    "taskId": "550e8400-e29b-41d4-a716-446655440000",
    "status": "done",
    "createdAt": "2025-11-06T00:00:00Z"
  }
]
```

#### Шаг 3: Скачать CSV файл
```bash
GET /api/wb/export/products/download/{taskId}
```
**Возвращает:** CSV файл с карточками товаров

---

### 3. Экспорт рекламных отчетов

#### Создать задачу экспорта
```bash
POST /api/wb/export/advert/create-task
Content-Type: application/json

{
  "dateFrom": "2025-10-01",
  "dateTo": "2025-10-31",
  "type": "campaigns"  // или "statistics"
}
```
**Возвращает:**
```json
{
  "taskId": "550e8400-e29b-41d4-a716-446655440000"
}
```

#### Получить статус и ссылку на скачивание
```bash
GET /api/wb/export/advert/task/{taskId}
```
**Возвращает:**
```json
{
  "status": "done",
  "downloadUrl": "https://..."
}
```

---

### 4. Асинхронные аналитические отчеты

#### Экспорт метрик
```bash
POST /api/wb/export/analytics/metrics/create-task
Content-Type: application/json

{
  "dateFrom": "2025-10-01",
  "dateTo": "2025-10-31",
  "metrics": ["sales", "revenue", "orders"]
}
```

#### Экспорт воронки продаж
```bash
POST /api/wb/export/analytics/sales-funnel/create-task
Content-Type: application/json

{
  "dateFrom": "2025-10-01",
  "dateTo": "2025-10-31"
}
```

#### Экспорт трафика
```bash
POST /api/wb/export/analytics/traffic/create-task
Content-Type: application/json

{
  "dateFrom": "2025-10-01",
  "dateTo": "2025-10-31"
}
```

#### Проверить статус задачи
```bash
GET /api/wb/export/analytics/task/{taskId}/status
```
**Возвращает:**
```json
{
  "status": "processing"  // или "done", "error"
}
```

#### Скачать результат (ZIP с CSV)
```bash
GET /api/wb/export/analytics/task/{taskId}/download
```
**Возвращает:** ZIP файл с CSV внутри

---

## 🎯 Примеры использования на Frontend

### React/TypeScript пример

```typescript
// api/wb-export.ts
import { apiClient } from '@/shared/api'

// Финансовый отчет
export async function getFinancialReport(dateFrom: string, dateTo: string) {
  const { data } = await apiClient.get('/wb/export/financial/report', {
    params: { dateFrom, dateTo }
  })
  return data
}

// Экспорт карточек товаров
export async function exportProducts(nmIDs?: number[]) {
  // Создать задачу
  const { data: task } = await apiClient.post('/wb/export/products/create-task', {
    nmIDs
  })
  
  // Опросить статус
  let status = 'processing'
  while (status === 'processing') {
    await new Promise(resolve => setTimeout(resolve, 2000)) // ждем 2 сек
    const { data: tasks } = await apiClient.get('/wb/export/products/tasks')
    const currentTask = tasks.find(t => t.taskId === task.taskId)
    status = currentTask?.status || 'error'
  }
  
  // Скачать файл
  if (status === 'done') {
    const response = await apiClient.get(`/wb/export/products/download/${task.taskId}`, {
      responseType: 'blob'
    })
    
    // Создать ссылку для скачивания
    const url = window.URL.createObjectURL(new Blob([response.data]))
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `products-${task.taskId}.csv`)
    document.body.appendChild(link)
    link.click()
    link.remove()
  }
}

// Экспорт аналитики
export async function exportAnalytics(type: 'metrics' | 'sales-funnel' | 'traffic', dateFrom: string, dateTo: string) {
  // Создать задачу
  const { data: task } = await apiClient.post(`/wb/export/analytics/${type}/create-task`, {
    dateFrom,
    dateTo,
    ...(type === 'metrics' ? { metrics: ['sales', 'revenue', 'orders'] } : {})
  })
  
  return task.taskId
}

export async function checkAnalyticsTaskStatus(taskId: string) {
  const { data } = await apiClient.get(`/wb/export/analytics/task/${taskId}/status`)
  return data.status
}

export async function downloadAnalyticsReport(taskId: string) {
  const response = await apiClient.get(`/wb/export/analytics/task/${taskId}/download`, {
    responseType: 'blob'
  })
  
  const url = window.URL.createObjectURL(new Blob([response.data]))
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', `analytics-${taskId}.zip`)
  document.body.appendChild(link)
  link.click()
  link.remove()
}
```

### React компонент с кнопками экспорта

```tsx
import { useState } from 'react'
import { exportProducts, exportAnalytics, checkAnalyticsTaskStatus, downloadAnalyticsReport } from '@/api/wb-export'
import toast from 'react-hot-toast'

export function ExportButtons() {
  const [loading, setLoading] = useState(false)

  const handleExportProducts = async () => {
    setLoading(true)
    try {
      await exportProducts()
      toast.success('Товары экспортированы')
    } catch (error) {
      toast.error('Ошибка экспорта')
    } finally {
      setLoading(false)
    }
  }

  const handleExportAnalytics = async () => {
    setLoading(true)
    try {
      const taskId = await exportAnalytics('sales-funnel', '2025-10-01', '2025-10-31')
      toast.success('Задача создана, ожидайте...')
      
      // Опрос статуса
      let status = 'processing'
      while (status === 'processing') {
        await new Promise(resolve => setTimeout(resolve, 3000))
        status = await checkAnalyticsTaskStatus(taskId)
      }
      
      if (status === 'done') {
        await downloadAnalyticsReport(taskId)
        toast.success('Отчет скачан')
      } else {
        toast.error('Ошибка генерации отчета')
      }
    } catch (error) {
      toast.error('Ошибка экспорта')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex gap-2">
      <button 
        onClick={handleExportProducts}
        disabled={loading}
        className="px-4 py-2 bg-blue-600 text-white rounded"
      >
        📦 Экспорт товаров (CSV)
      </button>
      
      <button 
        onClick={handleExportAnalytics}
        disabled={loading}
        className="px-4 py-2 bg-green-600 text-white rounded"
      >
        📊 Экспорт аналитики (ZIP)
      </button>
    </div>
  )
}
```

---

## 💡 Рекомендации

### 1. Кэширование
Финансовые отчеты можно кэшировать на 1-24 часа, так как данные обновляются не в реальном времени.

### 2. Обработка ошибок
```typescript
try {
  const data = await getFinancialReport('2025-10-01', '2025-10-31')
} catch (error) {
  if (error.response?.status === 401) {
    // Токен не установлен или истек
    toast.error('Добавьте WB токен в настройках')
  } else if (error.response?.status === 429) {
    // Rate limit
    toast.error('Слишком много запросов, попробуйте позже')
  } else {
    toast.error('Ошибка загрузки отчета')
  }
}
```

### 3. Прогресс-бар для асинхронных задач
```tsx
const [progress, setProgress] = useState(0)

const pollTask = async (taskId: string) => {
  const maxAttempts = 30 // 30 * 3 сек = 90 сек максимум
  let attempts = 0
  
  while (attempts < maxAttempts) {
    const status = await checkAnalyticsTaskStatus(taskId)
    setProgress((attempts / maxAttempts) * 100)
    
    if (status === 'done') return true
    if (status === 'error') return false
    
    await new Promise(resolve => setTimeout(resolve, 3000))
    attempts++
  }
  
  return false // timeout
}
```

### 4. Конвертация в Excel на клиенте
Для конвертации CSV в XLSX можно использовать библиотеку `xlsx`:

```typescript
import * as XLSX from 'xlsx'

function convertCSVtoXLSX(csvData: string, filename: string) {
  const workbook = XLSX.read(csvData, { type: 'string' })
  XLSX.writeFile(workbook, `${filename}.xlsx`)
}
```

---

## 🔐 Безопасность

1. Все эндпоинты требуют авторизации (JWT токен)
2. WB API токен хранится зашифрованным в БД
3. Файлы экспорта не сохраняются на сервере (stream напрямую клиенту)
4. Rate limiting: рекомендуется не более 10 запросов в минуту

---

## 📚 Дополнительные ресурсы

- [WB API Документация](https://openapi.wildberries.ru/)
- [Sandbox для тестирования](https://dev.wildberries.ru/sandbox)
- [Получение токена](https://seller.wildberries.ru/)
