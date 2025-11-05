import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import cookieParser from 'cookie-parser';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable cookie parsing (needed for auth cookies)
  app.use(cookieParser());

  // Enable CORS
  const isDevelopment = process.env.NODE_ENV !== 'production';
  
  const allowedOrigins = [
    'http://84.247.184.155',
    'http://84.247.184.155:3000',
    'http://84.247.184.155:3001',
    'https://84.247.184.155',
    'https://84.247.184.155:3000',
    'https://84.247.184.155:3001',
    'http://tezeris.duckdns.org',
    'https://tezeris.duckdns.org',
    'https://tezeris.duckdns.org:3000',
    'https://tezeris.duckdns.org:3001',
    'http://localhost:3000',
    'http://localhost:3001',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3001'
  ];

  app.enableCors({
    origin: (origin, callback) => {
      // В development режиме разрешаем все origins
      if (isDevelopment) {
        return callback(null, true);
      }
      
      // В production проверяем whitelist
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      
      console.error(`CORS blocked origin: ${origin}`);
      return callback(new Error(`Not allowed by CORS: ${origin}`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Accept',
      'X-Requested-With',
      'Origin',
    ],
    exposedHeaders: ['Content-Disposition'],
    optionsSuccessStatus: 204,
  });

  // Trust proxy for rate limiting
  app.getHttpAdapter().getInstance().set('trust proxy', 1);

  // Enable validation pipe globally
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
      forbidNonWhitelisted: true,
    }),
  );

  // Set global prefix
  app.setGlobalPrefix('api');

  // Swagger setup
  const config = new DocumentBuilder()
    .setTitle('Wildberries A/B Testing API')
    .setDescription('API documentation for Wildberries A/B Testing Service')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: { persistAuthorization: true, tagsSorter: 'alpha', operationsSorter: 'method' },
    useGlobalPrefix: true,
  });

  const port = process.env.PORT || 3001;
  await app.listen(port, '0.0.0.0');
  console.log(`🚀 Application is running on: http://localhost:${port}/api`);
}

bootstrap();
