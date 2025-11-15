import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerBehindProxyGuard } from './common/guards/throttler-behind-proxy.guard';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CoreModule } from './core/core.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { WbModule } from './wb/wb.module';
import { AbTestsModule } from './abtests/abtests.module';
import { QueuesModule } from './queues/queues.module';
import { ProductsModule } from './products/products.module';
import { AbTestModule } from './ab-test/ab-test.module';
import { SeedModule } from './seed/seed.module';

@Module({
  imports: [
    // Core modules (Config, Prisma, etc.)
    CoreModule,
    
    // Rate limiting
    ThrottlerModule.forRoot({
      throttlers: [{
        ttl: 60 * 1000, // 1 minute in milliseconds
        limit: 100, // 100 requests per minute
      }],
    }),

    // Schedule module for cron jobs
    ScheduleModule.forRoot(),

    // Feature modules
    AuthModule,
    UsersModule,
    WbModule,
    AbTestsModule,
    QueuesModule,
    ProductsModule,
    AbTestModule,
    SeedModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerBehindProxyGuard,
    },
  ],
})
export class AppModule {}
