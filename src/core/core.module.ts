import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '../config/config.module';
import { PrismaModule } from '../prisma/prisma.module';

@Global()
@Module({
  imports: [
    ConfigModule,
    PrismaModule,
  ],
  exports: [
    ConfigModule,
    PrismaModule,
  ],
})
export class CoreModule {}
