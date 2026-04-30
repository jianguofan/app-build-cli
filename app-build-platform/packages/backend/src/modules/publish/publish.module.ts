import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { PublishController } from './publish.controller';
import { PublishService } from './publish.service';
import { PublishProcessor } from './publish.processor';
import { PgyerPublisher } from './publishers/pgyer.publisher';
import { AppStorePublisher } from './publishers/appstore.publisher';
import { XiaomiPublisher } from './publishers/xiaomi.publisher';
import { HuaweiPublisher } from './publishers/huawei.publisher';
import { TencentPublisher } from './publishers/tencent.publisher';
import { VivoPublisher } from './publishers/vivo.publisher';
import { OppoPublisher } from './publishers/oppo.publisher';
import { QihuPublisher } from './publishers/qihu360.publisher';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'publish',
    }),
  ],
  controllers: [PublishController],
  providers: [
    PublishService,
    PublishProcessor,
    PgyerPublisher,
    AppStorePublisher,
    XiaomiPublisher,
    HuaweiPublisher,
    TencentPublisher,
    VivoPublisher,
    OppoPublisher,
    QihuPublisher,
  ],
  exports: [PublishService],
})
export class PublishModule {}
