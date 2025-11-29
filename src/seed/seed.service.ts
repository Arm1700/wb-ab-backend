import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SeedService {
  constructor(private prisma: PrismaService) {}

  /**
   * Генерирует тестовые продукты с изображениями
   */
  async seedProducts(count: number = 10) {
    const products = [];
    const startNmId = 100000000 + Math.floor(Math.random() * 900000000);

    const brands = ['Nike', 'Adidas', 'Puma', 'Reebok', 'New Balance', 'Under Armour', 'Asics', 'Converse'];
    const categories = ['Обувь', 'Одежда', 'Аксессуары', 'Спорт', 'Электроника'];
    const productTypes = ['Кроссовки', 'Футболка', 'Куртка', 'Рюкзак', 'Часы', 'Наушники', 'Шорты', 'Кепка'];

    for (let i = 0; i < count; i++) {
      const nmId = BigInt(startNmId + i);
      const brand = brands[Math.floor(Math.random() * brands.length)];
      const productType = productTypes[Math.floor(Math.random() * productTypes.length)];
      const name = `${brand} ${productType} ${Math.floor(Math.random() * 1000)}`;
      const categoryId = Math.floor(Math.random() * 100) + 1;

      // Since Product now uses a composite unique (userId, nmId), and seed data is global (no user),
      // we scope seed rows to userId = null. Upsert via findFirst + create/update.
      const existing = await this.prisma.product.findFirst({ where: { nmId, userId: null } })
      const product = existing
        ? await this.prisma.product.update({
            where: { id: existing.id },
            data: { name, brand, categoryId },
          })
        : await this.prisma.product.create({
            data: { userId: null, nmId, name, brand, categoryId },
          })

      // Создаем 3-5 изображений для каждого продукта
      const imageCount = Math.floor(Math.random() * 3) + 3;
      const images = [];
      
      for (let j = 0; j < imageCount; j++) {
        const imageUrl = `https://picsum.photos/seed/${nmId}-${j}/800/800`;
        images.push({
          productId: product.id,
          url: imageUrl,
          isPrimary: j === 0, // Первое изображение - основное
        });
      }

      await this.prisma.productImage.deleteMany({
        where: { productId: product.id },
      });

      await this.prisma.productImage.createMany({
        data: images,
      });

      products.push(product);
    }

    return {
      message: `Создано ${count} тестовых продуктов`,
      products: products.map(p => ({ ...p, nmId: p.nmId.toString() })),
    };
  }

  /**
   * Генерирует тестовые метрики для продуктов за последние N дней
   */
  async seedMetrics(daysBack: number = 30, productsCount?: number) {
    const products = await this.prisma.product.findMany({
      take: productsCount || 100,
      orderBy: { createdAt: 'desc' },
    });

    if (products.length === 0) {
      throw new Error('Нет продуктов для генерации метрик. Сначала создайте продукты.');
    }

    let totalMetrics = 0;
    const endDate = new Date();
    
    for (const product of products) {
      for (let i = 0; i < daysBack; i++) {
        const date = new Date(endDate);
        date.setDate(date.getDate() - i);
        date.setHours(0, 0, 0, 0);

        // Генерируем реалистичные метрики с воронкой продаж
        const impressions = Math.floor(Math.random() * 5000) + 500;
        const clicks = Math.floor(impressions * (Math.random() * 0.15 + 0.02)); // CTR 2-17%
        const orders = Math.floor(clicks * (Math.random() * 0.25 + 0.05)); // CR 5-30%
        const revenue = orders * (Math.random() * 3000 + 500); // 500-3500 руб за заказ

        // Воронка продаж: impressions -> openCount -> cartCount -> orders -> buyoutCount
        const openCount = Math.floor(impressions * (Math.random() * 0.3 + 0.2)); // 20-50% открывают карточку
        const cartCount = Math.floor(openCount * (Math.random() * 0.25 + 0.1)); // 10-35% добавляют в корзину
        const buyoutCount = Math.floor(orders * (Math.random() * 0.2 + 0.7)); // 70-90% выкупают
        const buyoutSum = buyoutCount * (Math.random() * 3500 + 1000); // 1000-4500 руб за выкуп

        await this.prisma.productMetric.upsert({
          where: {
            productId_date: {
              productId: product.id,
              date,
            },
          },
          create: {
            productId: product.id,
            date,
            impressions,
            clicks,
            orders,
            revenue,
            openCount,
            cartCount,
            buyoutCount,
            buyoutSum,
          },
          update: {
            impressions,
            clicks,
            orders,
            revenue,
            openCount,
            cartCount,
            buyoutCount,
            buyoutSum,
          },
        });

        totalMetrics++;
      }
    }

    return {
      message: `Создано ${totalMetrics} метрик для ${products.length} продуктов за ${daysBack} дней`,
      productsCount: products.length,
      daysBack,
      totalMetrics,
    };
  }

  /**
   * Генерирует тестовые A/B тесты РЕКЛАМНЫХ кампаний (AbAd*) без реальных WB кампаний
   */
  async seedAbAdsTests(count: number = 5) {
    const products = await this.prisma.product.findMany({
      take: count,
      orderBy: { createdAt: 'desc' },
    });

    if (products.length === 0) {
      throw new Error('Нет продуктов для создания A/B рекламных тестов. Сначала создайте продукты.');
    }

    const tests = [] as any[]
    for (let i = 0; i < Math.min(count, products.length); i++) {
      const product = products[i]
      const test = await this.prisma.abAdTest.create({
        data: {
          productId: product.id,
          name: `AB-Ads #${i + 1} - ${product.name ?? 'Product'}`,
          status: 'draft',
          budget: 1000,
          variants: {
            create: [
              { variantName: 'A', nmIds: [Number(product.nmId)], dailyBudget: 500, status: 'draft' },
              { variantName: 'B', nmIds: [Number(product.nmId)], dailyBudget: 500, status: 'draft' },
            ] as any,
          },
        },
        include: { variants: true },
      })
      // Сгенерируем пару дней статистики как пример
      const today = new Date(); today.setHours(0,0,0,0)
      const yest = new Date(today); yest.setDate(today.getDate()-1)
      for (const v of test.variants) {
        await this.prisma.abAdStats.createMany({
          data: [
            { abAdVariantId: v.id, date: yest, impressions: 1000, clicks: 50, ctr: 5.0, conversions: 5, spend: 400 },
            { abAdVariantId: v.id, date: today, impressions: 1200, clicks: 72, ctr: 6.0, conversions: 6, spend: 450 },
          ],
        })
      }
      tests.push(test)
    }

    return {
      message: `Создано ${tests.length} AB-Ads тестов (черновики) с вариантами и демо-статистикой`,
      tests: tests.map(t => ({ id: t.id, name: t.name, status: t.status, variantsCount: t.variants.length })),
    }
  }

  /**
   * Полная генерация тестовых данных (продукты + метрики + A/B тесты)
   */
  async seedAll(options?: {
    productsCount?: number;
    metricsDays?: number;
    abTestsCount?: number;
  }) {
    const productsCount = options?.productsCount || 20;
    const metricsDays = options?.metricsDays || 30;
    const abTestsCount = options?.abTestsCount || 5;

    const productsResult = await this.seedProducts(productsCount);
    const metricsResult = await this.seedMetrics(metricsDays, productsCount);
    const abAdsResult = await this.seedAbAdsTests(abTestsCount);

    return {
      message: 'Все тестовые данные успешно созданы',
      summary: {
        products: productsResult.products.length,
        metrics: metricsResult.totalMetrics,
        abAdsTests: abAdsResult.tests.length,
      },
      details: {
        products: productsResult,
        metrics: metricsResult,
        abAdsTests: abAdsResult,
      },
    };
  }

  /**
   * Очистка всех тестовых данных
   */
  async clearAll() {
    await this.prisma.abAdStats.deleteMany();
    await this.prisma.abAdVariant.deleteMany();
    await this.prisma.abAdTest.deleteMany();
    await this.prisma.productMetric.deleteMany();
    await this.prisma.productImageHistory.deleteMany();
    await this.prisma.productImage.deleteMany();
    await this.prisma.product.deleteMany();

    return {
      message: 'Все тестовые данные успешно удалены',
    };
  }

  /**
   * Получение статистики по тестовым данным
   */
  async getStats() {
    const [
      productsCount,
      metricsCount,
      abAdsTestsCount,
      abAdsVariantsCount,
      abAdsStatsCount,
    ] = await Promise.all([
      this.prisma.product.count(),
      this.prisma.productMetric.count(),
      this.prisma.abAdTest.count(),
      this.prisma.abAdVariant.count(),
      this.prisma.abAdStats.count(),
    ]);

    return {
      products: productsCount,
      productMetrics: metricsCount,
      abAdsTests: abAdsTestsCount,
      abAdsVariants: abAdsVariantsCount,
      abAdsStats: abAdsStatsCount,
    };
  }
}
