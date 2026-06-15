import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { BuildController } from './build.controller';
import { BuildService } from './build.service';
import { BuildProcessor } from './build.processor';
import { BuildGateway } from './build.gateway';
import { ExecutorModule } from '../executor/executor.module';
import { PublishModule } from '../publish/publish.module';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'build',
    }),
    ExecutorModule,
    PublishModule,
  ],
  controllers: [BuildController],
  providers: [BuildService, BuildProcessor, BuildGateway],
  exports: [BuildService],
})
export class BuildModule {}
