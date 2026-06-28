import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { ApiKeyModule } from './modules/api_key.module';
import { DbModule } from './db/db.module';
import { CacheModule } from './infra/cache.module';
import { RedisModule } from './infra/redis.module';
import { ScheduleModule } from '@nestjs/schedule';
import { ApiKeyUsageCron } from './scheduler/api_key.cron';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ScheduleModule.forRoot(),
    DbModule,
    CacheModule,
    RedisModule,
    ApiKeyModule,
  ],
  controllers: [AppController],
  providers: [AppService, ApiKeyUsageCron],
})
export class AppModule {}
