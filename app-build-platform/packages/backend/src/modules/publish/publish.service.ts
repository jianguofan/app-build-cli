import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { v4 as uuidv4 } from 'uuid';
import { StorageService } from '../storage/storage.service';
import { PublishRecord } from '../storage/models';
import { PgyerPublisher } from './publishers/pgyer.publisher';
import { AppStorePublisher } from './publishers/appstore.publisher';
import { XiaomiPublisher } from './publishers/xiaomi.publisher';
import { HuaweiPublisher } from './publishers/huawei.publisher';
import { TencentPublisher } from './publishers/tencent.publisher';
import { VivoPublisher } from './publishers/vivo.publisher';
import { OppoPublisher } from './publishers/oppo.publisher';
import { QihuPublisher } from './publishers/qihu360.publisher';

@Injectable()
export class PublishService {
  private readonly logger = new Logger(PublishService.name);

  constructor(
    @InjectQueue('publish') private publishQueue: Queue,
    private storageService: StorageService,
    private pgyerPublisher: PgyerPublisher,
    private appStorePublisher: AppStorePublisher,
    private xiaomiPublisher: XiaomiPublisher,
    private huaweiPublisher: HuaweiPublisher,
    private tencentPublisher: TencentPublisher,
    private vivoPublisher: VivoPublisher,
    private oppoPublisher: OppoPublisher,
    private qihuPublisher: QihuPublisher,
  ) {}

  async publish(
    buildId: string,
    artifacts: { ipa?: string; apk?: string },
    pgyerAccountType?: string,
  ): Promise<void> {
    this.logger.log(`Starting publish for build: ${buildId}`);

    const build = this.storageService.getBuild(buildId);
    if (!build) {
      throw new NotFoundException(`Build ${buildId} not found`);
    }

    // iOS 发布
    if (build.platform === 'ios' && artifacts.ipa) {
      // 发布到蒲公英
      await this.createPublishTask(buildId, 'pgyer', artifacts.ipa, pgyerAccountType);

      // 发布到 App Store（仅生产环境）
      if (build.env === 'prod') {
        await this.createPublishTask(buildId, 'appstore', artifacts.ipa);
      }
    }

    // Android 发布
    if (build.platform === 'android' && artifacts.apk) {
      // 发布到蒲公英
      await this.createPublishTask(buildId, 'pgyer', artifacts.apk, pgyerAccountType);

      // 发布到主流应用商店（仅生产环境）
      if (build.env === 'prod') {
        await this.createPublishTask(buildId, 'xiaomi', artifacts.apk);
        await this.createPublishTask(buildId, 'huawei', artifacts.apk);
        await this.createPublishTask(buildId, 'tencent', artifacts.apk);
        await this.createPublishTask(buildId, 'vivo', artifacts.apk);
        await this.createPublishTask(buildId, 'oppo', artifacts.apk);
        // 360 可选
        // await this.createPublishTask(buildId, 'qihu360', artifacts.apk);
      }
    }
  }

  private async createPublishTask(
    buildId: string,
    platform: string,
    artifactPath: string,
    pgyerAccountType?: string,
  ): Promise<void> {
    const record: PublishRecord = {
      id: uuidv4(),
      buildId,
      platform,
      status: 'pending',
      publishedAt: undefined,
    };

    this.storageService.createPublish(record);

    // 加入发布队列
    await this.publishQueue.add(
      'upload',
      {
        recordId: record.id,
        buildId,
        platform,
        artifactPath,
        pgyerAccountType,
      },
      {
        jobId: record.id,
        removeOnComplete: false,
        removeOnFail: false,
        attempts: 3, // 失败重试 3 次
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
      },
    );

    this.logger.log(`Created publish task: ${record.id} for platform: ${platform}`);
  }

  async getPublishes(buildId: string): Promise<PublishRecord[]> {
    return this.storageService.getPublishes(buildId);
  }

  async getAllPublishes(filters?: {
    platform?: string;
    status?: string;
    page?: number;
    limit?: number;
  }) {
    const page = filters?.page || 1;
    const limit = filters?.limit || 20;
    const offset = (page - 1) * limit;

    const result = this.storageService.listAllPublishes({
      platform: filters?.platform,
      status: filters?.status,
      limit,
      offset,
    });

    return {
      data: result.data,
      total: result.total,
      page,
      limit,
      totalPages: Math.ceil(result.total / limit),
    };
  }

  async updatePublishStatus(
    recordId: string,
    status: PublishRecord['status'],
    updates?: Partial<PublishRecord>,
  ): Promise<void> {
    const updateData: Partial<PublishRecord> = {
      status,
      ...updates,
    };

    if (status === 'success' && !updates?.publishedAt) {
      updateData.publishedAt = new Date();
    }

    this.storageService.updatePublish(recordId, updateData);
    this.logger.log(`Updated publish record ${recordId} status to ${status}`);
  }

  getPublisher(platform: string) {
    switch (platform) {
      case 'pgyer':
        return this.pgyerPublisher;
      case 'appstore':
        return this.appStorePublisher;
      case 'xiaomi':
        return this.xiaomiPublisher;
      case 'huawei':
        return this.huaweiPublisher;
      case 'tencent':
        return this.tencentPublisher;
      case 'vivo':
        return this.vivoPublisher;
      case 'oppo':
        return this.oppoPublisher;
      case 'qihu360':
        return this.qihuPublisher;
      default:
        throw new Error(`Unknown platform: ${platform}`);
    }
  }
}
