import { Controller, Post, Delete, Get, Body, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiQuery } from '@nestjs/swagger';
import { SeedService } from './seed.service';
import { Public } from '../common/decorators/public.decorator';

@ApiTags('Seed (Test Data)')
@Controller('seed')
@Public()
export class SeedController {
  constructor(private readonly seedService: SeedService) { }

  @Post('products')
  @ApiOperation({
    summary: 'Создать тестовые продукты',
    description: 'Генерирует указанное количество тестовых продуктов с изображениями'
  })
  @ApiQuery({ name: 'count', required: false, type: Number, description: 'Количество продуктов (по умолчанию 10)' })
  @ApiResponse({ status: 201, description: 'Продукты успешно созданы' })
  async seedProducts(@Query('count') count?: string) {
    const productsCount = count ? parseInt(count, 10) : 10;
    return this.seedService.seedProducts(productsCount);
  }

  @Post('metrics')
  @ApiOperation({
    summary: 'Создать тестовые метрики',
    description: 'Генерирует метрики для существующих продуктов за указанное количество дней'
  })
  @ApiQuery({ name: 'days', required: false, type: Number, description: 'Количество дней назад (по умолчанию 30)' })
  @ApiQuery({ name: 'productsCount', required: false, type: Number, description: 'Количество продуктов для метрик' })
  @ApiResponse({ status: 201, description: 'Метрики успешно созданы' })
  async seedMetrics(
    @Query('days') days?: string,
    @Query('productsCount') productsCount?: string,
  ) {
    const daysBack = days ? parseInt(days, 10) : 30;
    const prodCount = productsCount ? parseInt(productsCount, 10) : undefined;
    return this.seedService.seedMetrics(daysBack, prodCount);
  }

  @Post('ab-ads-tests')
  @ApiOperation({
    summary: 'Создать тестовые A/B рекламные тесты (AbAd*)',
    description: 'Создает черновики тестов рекламы с вариантами и демо-статистикой (без реальных WB кампаний)'
  })
  @ApiQuery({ name: 'count', required: false, type: Number, description: 'Количество A/B рекламных тестов (по умолчанию 5)' })
  @ApiResponse({ status: 201, description: 'A/B рекламные тесты успешно созданы' })
  async seedAbAdsTests(@Query('count') count?: string) {
    const testsCount = count ? parseInt(count, 10) : 5;
    return this.seedService.seedAbAdsTests(testsCount);
  }

  @Post('all')
  @ApiOperation({
    summary: 'Создать все тестовые данные',
    description: 'Генерирует полный набор тестовых данных: продукты, метрики и A/B рекламные тесты'
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        productsCount: { type: 'number', default: 20, description: 'Количество продуктов' },
        metricsDays: { type: 'number', default: 30, description: 'Количество дней метрик' },
        abTestsCount: { type: 'number', default: 5, description: 'Количество A/B рекламных тестов' },
      },
    },
    required: false,
  })
  @ApiResponse({ status: 201, description: 'Все тестовые данные успешно созданы' })
  async seedAll(
    @Body() body?: {
      productsCount?: number;
      metricsDays?: number;
      abTestsCount?: number;
    },
  ) {
    return this.seedService.seedAll(body);
  }

  @Delete('all')
  @ApiOperation({
    summary: 'Удалить все тестовые данные',
    description: 'Очищает базу данных от всех продуктов, метрик и A/B тестов'
  })
  @ApiResponse({ status: 200, description: 'Все данные успешно удалены' })
  async clearAll() {
    return this.seedService.clearAll();
  }

  @Get('stats')
  @ApiOperation({
    summary: 'Получить статистику по тестовым данным',
    description: 'Возвращает количество записей каждого типа в базе данных'
  })
  @ApiResponse({ status: 200, description: 'Статистика получена' })
  async getStats() {
    return this.seedService.getStats();
  }
}
