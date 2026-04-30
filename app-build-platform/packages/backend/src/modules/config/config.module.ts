import { Module } from '@nestjs/common';
import { ConfigController } from './config.controller';
import { ExecutorModule } from '../executor/executor.module';

@Module({
  imports: [ExecutorModule],
  controllers: [ConfigController],
})
export class ConfigModule {}
