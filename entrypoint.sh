#!/bin/sh
set -e

# Simple logger with timestamp and colors
ts() { date +"%Y-%m-%d %H:%M:%S"; }
INFO="\033[1;34mINFO\033[0m"   # blue
OK="\033[1;32mOK\033[0m"       # green
WARN="\033[1;33mWARN\033[0m"     # yellow
ERR="\033[1;31mERR\033[0m"       # red

echo "\n================= Backend (NestJS) Startup ================="
echo "[$(ts)] $INFO Environment: ${NODE_ENV:-development}"
echo "[$(ts)] $INFO DB: host=${DB_HOST:-postgres} port=${DB_PORT:-5432} db=${DB_DATABASE:-wb_ab_db}"

echo "[$(ts)] $INFO ⏳ Waiting for PostgreSQL to be ready..."
# Можно добавить проверку подключения к БД, чтобы не стартовать раньше
until nc -z "$DB_HOST" "$DB_PORT" 2>/dev/null; do
  echo "[$(ts)] $WARN PostgreSQL is unavailable - sleeping 2s"
  sleep 2
done
echo "[$(ts)] $OK PostgreSQL is reachable"

echo "[$(ts)] $INFO 🔧 Running Prisma generate..."
npx prisma generate
echo "[$(ts)] $OK Prisma client generated"

echo "[$(ts)] $INFO 📦 Applying Prisma migrations (deploy)..."
npx prisma migrate deploy
echo "[$(ts)] $OK Migrations applied"

APP_PORT=${PORT:-3001}
echo "[$(ts)] $INFO 🚀 Starting NestJS app on port ${APP_PORT}..."
echo "===========================================================\n"
exec node dist/main
