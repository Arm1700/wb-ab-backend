#!/bin/sh
set -e

echo "⏳ Waiting for PostgreSQL..."
# можно добавить проверку подключения к БД, чтобы не стартовать раньше
until nc -z $DB_HOST $DB_PORT; do
  echo "Postgres is unavailable - sleeping"
  sleep 2
done

echo "Running Prisma generate..."
npx prisma generate

echo "Running Prisma migrate deploy..."
npx prisma migrate deploy

echo "🚀 Starting NestJS app..."
exec node dist/main
