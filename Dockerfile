# Base image
FROM node:20-alpine AS base
WORKDIR /app

# Dependencies stage
FROM base AS deps
COPY package*.json ./
RUN npm ci --only=production

# Build stage
FROM base AS builder
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx prisma generate
RUN npm run build

# Production stage
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Создаём non-root пользователя
RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nestjs

# Копируем зависимости и билд
COPY --from=deps --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /app/package*.json ./
COPY --from=builder --chown=nestjs:nodejs /app/prisma ./prisma

# Копируем entrypoint скрипт
COPY --chown=nestjs:nodejs entrypoint.sh ./
RUN chmod +x entrypoint.sh

USER nestjs
EXPOSE 3001

CMD ["./entrypoint.sh"]
