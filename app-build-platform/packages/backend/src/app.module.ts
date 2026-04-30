import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bull';
import { AuthModule } from './modules/auth/auth.module';
import { BuildModule } from './modules/build/build.module';
import { PublishModule } from './modules/publish/publish.module';
import { ExecutorModule } from './modules/executor/executor.module';
import { HealthModule } from './modules/health/health.module';
import { StorageModule } from './modules/storage/storage.module';
import { ConfigModule as AppConfigModule } from './modules/config/config.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),

    BullModule.forRoot({
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
      },
    }),

    AuthModule,
    BuildModule,
    PublishModule,
    ExecutorModule,
    HealthModule,
    StorageModule,
    AppConfigModule,
  ],
})
export class AppModule {}
