import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { PublishController } from './publish.controller';
import { PublishService } from './publish.service';
import { PublishProcessor } from './publish.processor';
import { PgyerPublisher } from './publishers/pgyer.publisher';
import { FastlanePublisher } from './publishers/fastlane.publisher';
import { ExecutorModule } from '../executor/executor.module';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'publish',
    }),
    ExecutorModule,
  ],
  controllers: [PublishController],
  providers: [
    PublishService,
    PublishProcessor,
    PgyerPublisher,
    FastlanePublisher,
  ],
  exports: [PublishService],
})
export class PublishModule {}
