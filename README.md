# WB A-B Testing Platform

Современная платформа для A-B тестирования карточек товаров на Wildberries с интеграцией официального API и платёжной системой ЮKassa.

## Описание проекта

Веб-сервис для автоматизации A-B тестирования главных фотографий карточек товаров на Wildberries. Платформа позволяет:

- Регистрация и авторизация пользователей
- Автоматический сбор статистики (показы, клики, CTR)
- Автоматическая смена главного фото по достижению порога показов
- Визуализация результатов тестирования
- Интеграция с платёжной системой ЮKassa
- Защита данных и шифрование API ключей

## Технологический стек

### Backend
- **NestJS** - современный Node.js фреймворк
- **TypeScript** - типизированный JavaScript
- **PostgreSQL** - реляционная база данных
- **TypeORM** - ORM для работы с БД
- **Passport JWT** - аутентификация
- **Bcrypt** - хеширование паролей
- **Axios** - HTTP клиент для API запросов

### Frontend
- **Next.js 14** - React фреймворк с SSR
- **TypeScript** - типизация
- **Tailwind CSS** - utility-first CSS фреймворк
- **Zustand** - управление состоянием
- **React Hook Form** - работа с формами
- **Recharts** - графики и визуализация
- **Axios** - HTTP клиент

### DevOps
- **Docker & Docker Compose** - контейнеризация
- **PostgreSQL 16** - база данных

## Структура проекта

```
wb-ab
├── wb-ab-backend          Backend API (NestJS)
│   ├── src
│   │   ├── common         Общие утилиты, декораторы, фильтры
│   │   ├── config         Конфигурация (БД, JWT и т.д.)
│   │   ├── app.module.ts  Главный модуль приложения
│   │   └── main.ts        Точка входа
│   ├── .env.example       Пример переменных окружения
│   ├── docker-compose.yml Оркестрация контейнеров
│   ├── Dockerfile         Docker конфигурация
│   └── package.json       Зависимости
│
└── wb-ab-frontend         Frontend (Next.js)
    ├── src
    │   ├── app            App Router (страницы)
    │   ├── components     React компоненты
    │   └── lib            Утилиты и API клиент
    ├── .env.example       Пример переменных окружения
    ├── Dockerfile         Docker конфигурация
    └── package.json       Зависимости
```

## Быстрый старт

### Предварительные требования

- Node.js 20+ 
- npm или yarn
- PostgreSQL 16+ (или Docker)
- Git

### Установка и запуск (Локальная разработка)

#### 1. Клонирование репозитория

```bash
git clone <repository-url>
cd wb-ab
```

#### 2. Настройка Backend

```bash
cd wb-ab-backend

# Установка зависимостей
npm install

# Создание .env файла
copy .env.example .env

# Отредактируйте .env файл и укажите настройки БД
```

Пример `.env` для backend:
```env
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_DATABASE=wb_ab_testing

PORT=3001
NODE_ENV=development

JWT_SECRET=your-super-secret-jwt-key-change-this
JWT_EXPIRATION=7d

WB_API_BASE_URL=https://suppliers-api.wildberries.ru
FRONTEND_URL=http://localhost:3000

ENCRYPTION_KEY=your-32-character-encryption-key
```

#### 3. Настройка Frontend

```bash
cd ../wb-ab-frontend

# Установка зависимостей
npm install

# Создание .env файла
copy .env.example .env.local
```

Пример `.env.local` для frontend:
```env
NEXT_PUBLIC_NEST_URL=http://localhost:3001/api
```

#### 4. Запуск PostgreSQL

Если у вас установлен PostgreSQL локально:
```bash
# Создайте базу данных
createdb wb_ab_testing
```

Или используйте Docker:
```bash
docker run --name wb-ab-postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=wb_ab_testing -p 5432:5432 -d postgres:16-alpine
```

#### 5. Запуск приложений

**Backend:**
```bash
cd wb-ab-backend
npm run start:dev
```
Backend будет доступен на http://localhost:3001/api

**Frontend:**
```bash
cd wb-ab-frontend
npm run dev
```
Frontend будет доступен на http://localhost:3000

### Запуск через Docker Compose (Рекомендуется для продакшн)

```bash
# Из директории wb-ab-backend
cd wb-ab-backend
docker-compose up -d

# Просмотр логов
docker-compose logs -f

# Остановка
docker-compose down
```

Сервисы будут доступны:
- Frontend: http://localhost:3000
- Backend API: http://localhost:3001/api
- PostgreSQL: localhost:5432

## API Endpoints

### Базовые эндпоинты

- `GET /api` - Информация о API
- `GET /api/health` - Проверка здоровья сервиса

### Будущие эндпоинты (Этапы 2-6)

- `POST /api/auth/register` - Регистрация
- `POST /api/auth/login` - Авторизация
- `GET /api/auth/profile` - Профиль пользователя
- `GET /api/products` - Список карточек товаров
- `POST /api/ab-tests` - Создание A/B теста
- `GET /api/ab-tests/:id` - Получение результатов теста
- `POST /api/payments/create` - Создание платежа

## Скрипты разработки

### Backend

```bash
npm run start:dev      # Запуск в режиме разработки с hot-reload
npm run build          # Сборка проекта
npm run start:prod     # Запуск production версии
npm run lint           # Проверка кода
npm run test           # Запуск тестов
```

### Frontend

```bash
npm run dev            # Запуск в режиме разработки
npm run build          # Сборка для продакшн
npm run start          # Запуск production сервера
npm run lint           # Проверка кода
```

## База данных

### Миграции TypeORM

```bash
# Генерация миграции
npm run migration:generate -- src/migrations/MigrationName

# Запуск миграций
npm run migration:run

# Откат миграции
npm run migration:revert
```

## Безопасность

- JWT аутентификация (реализовано)
- Хеширование паролей bcrypt (реализовано)
- Шифрование API ключей AES (реализовано)
- CORS настроен (реализовано)
- Валидация входных данных (реализовано)
- SQL injection защита TypeORM (реализовано)
- Rate limiting (Этап 7)
- HTTPS и SSL (Этап 7)

## Этапы разработки

### Этап 1: Подготовка и архитектура (Завершён)
- Настройка репозитория
- Настройка окружения (Nest, PostgreSQL, Next)
- Создание базовой структуры API
- Подключение фронтенда к бэкенду (CORS, axios)
- Docker-контейнеры
- Файлы .env для конфигурации

### Этап 2: Пользователи и авторизация (В планах)
- Модель пользователя
- Регистрация и авторизация (JWT)
- Личный кабинет
- Защищённые эндпоинты

### Этап 3: Интеграция с API Wildberries (В планах)
- Подключение API WB
- Получение данных карточек
- Фоновый сбор статистики
- Отображение на фронтенде

### Этап 4: A-B-тестирование (В планах)
- Интерфейс создания теста
- Автоматическая смена фото
- Сбор и анализ статистики
- Отчёты и графики

### Этап 5: Админ-панель (В планах)
- Управление пользователями
- Управление тестами
- Статистика системы

### Этап 6: Интеграция ЮKassa (В планах)
- Подключение API ЮKassa
- Создание платежей
- Обработка вебхуков
- Активация подписок

### Этап 7: Безопасность (В планах)
- HTTPS и SSL
- Rate limiting
- Логирование
- Резервное копирование

### Этап 8: Тестирование и деплой (В планах)
- Unit тесты
- E2E тесты
- CI и CD
- Деплой на сервер

## Вклад в проект

1. Fork проекта
2. Создайте feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit изменения (`git commit -m 'Add some AmazingFeature'`)
4. Push в branch (`git push origin feature/AmazingFeature`)
5. Откройте Pull Request

## Лицензия

MIT License

## Автор

Разработано для автоматизации A/B тестирования на Wildberries

## Поддержка

При возникновении вопросов или проблем, создайте Issue в репозитории.

---

**Статус проекта:** Этап 1 завершён - Готов к разработке функционала
