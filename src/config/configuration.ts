export default () => ({
  port: parseInt(process.env.PORT, 10) || 3000,
  database: {
    host: process.env.DATABASE_HOST || 'localhost',
    port: parseInt(process.env.DATABASE_PORT, 10) || 5432,
    username: process.env.DATABASE_USERNAME || 'postgres',
    password: process.env.DATABASE_PASSWORD || 'postgres',
    database: process.env.DATABASE_NAME || 'wb_ab_testing',
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'your-secret-key',
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'your-refresh-secret',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },
  wb: {
    apiKey: process.env.WB_API_KEY,
    baseUrl: process.env.WB_BASE_URL || 'https://suppliers-api.wildberries.ru',
    advertBaseUrl: process.env.WB_ADVERT_BASE_URL || 'https://advert-api.wildberries.ru',
    contentBaseUrl: process.env.WB_CONTENT_BASE_URL || 'https://content-api.wildberries.ru',
    analyticsBaseUrl: process.env.WB_ANALYTICS_BASE_URL || 'https://seller-analytics-api.wildberries.ru',
  },
  yookassa: {
    shopId: process.env.YOOKASSA_SHOP_ID,
    secretKey: process.env.YOOKASSA_SECRET_KEY,
  },
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT, 10) || 6379,
  },
});
