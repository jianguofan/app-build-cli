import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { v4 as uuidv4 } from 'uuid';
import { StorageService } from '../storage/storage.service';
import { PublishRecord } from '../storage/models';
import { PgyerPublisher } from './publishers/pgyer.publisher';
import { FastlanePublisher } from './publishers/fastlane.publisher';

const FASTLANE_PLATFORMS = [
  'appstore',
  'xiaomi',
  'huawei',
  'oppo',
  'vivo',
  'tencent',
  'qihu360',
  'honor',
  'samsung',
] as const;

@Injectable()
export class PublishService {
  private readonly logger = new Logger(PublishService.name);

  constructor(
    @InjectQueue('publish') private publishQueue: Queue,
    private storageService: StorageService,
    private pgyerPublisher: PgyerPublisher,
    private fastlanePublisher: FastlanePublisher,
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

    const targets = build.publishTargets || [];
    if (targets.length === 0) {
      this.logger.log(`No publish targets specified for build ${buildId}, skipping publish`);
      return;
    }

    const artifactPath = build.platform === 'ios' ? artifacts.ipa : artifacts.apk;
    if (!artifactPath) {
      this.logger.warn(`No artifact found for build ${buildId}`);
      return;
    }

    const enabledPlatforms = this.getEnabledFastlanePlatforms();

    for (const platform of targets) {
      // Pgyer uses its own publisher, always allowed
      if (platform === 'pgyer') {
        await this.createPublishTask(buildId, 'pgyer', artifactPath, pgyerAccountType);
        continue;
      }

      // Fastlane platforms: must be enabled AND have credentials
      if (enabledPlatforms.includes(platform)) {
        await this.createPublishTask(buildId, platform, artifactPath);
      } else {
        this.logger.warn(`Platform ${platform} not enabled or missing credentials, skipping`);
      }
    }
  }

  private getEnabledFastlanePlatforms(): string[] {
    const certs = this.storageService.listPublishingCredentials();
    return FASTLANE_PLATFORMS.filter((p) => {
      const cred = certs.find((c) => c.platform === p);
      return cred && cred.enabled && Object.keys(cred.credentials).length > 0;
    });
  }

  private async createPublishTask(
    buildId: string,
    platform: string,
    artifactPath: string,
    pgyerAccountType?: string,
    releaseNotes?: string,
  ): Promise<string> {
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
        releaseNotes,
      },
      {
        jobId: record.id,
        removeOnComplete: false,
        removeOnFail: false,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
      },
    );

    this.logger.log(`Created publish task: ${record.id} for platform: ${platform}`);
    return record.id;
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
      case 'xiaomi':
      case 'huawei':
      case 'tencent':
      case 'vivo':
      case 'oppo':
      case 'qihu360':
      case 'honor':
      case 'samsung':
        return this.fastlanePublisher;
      default:
        throw new Error(`Unknown platform: ${platform}`);
    }
  }

  async republish(buildId: string, platforms: string[]): Promise<void> {
    this.logger.log(`Republishing build ${buildId} to platforms: ${platforms.join(', ')}`);

    const build = this.storageService.getBuild(buildId);
    if (!build) {
      throw new NotFoundException(`Build ${buildId} not found`);
    }

    if (!build.artifacts || (!build.artifacts.ipa && !build.artifacts.apk)) {
      throw new Error(`Build ${buildId} has no artifacts, cannot republish`);
    }

    const artifactPath = build.platform === 'ios' ? build.artifacts.ipa : build.artifacts.apk;
    if (!artifactPath) {
      throw new Error(`No artifact found for build ${buildId}`);
    }

    const enabledPlatforms = this.getEnabledFastlanePlatforms();

    for (const platform of platforms) {
      // Pgyer uses its own publisher, always allowed
      if (platform === 'pgyer') {
        await this.createPublishTask(buildId, 'pgyer', artifactPath, build.pgyerAccountType);
        continue;
      }

      // Fastlane platforms: must be enabled AND have credentials
      if (enabledPlatforms.includes(platform)) {
        await this.createPublishTask(buildId, platform, artifactPath);
      } else {
        this.logger.warn(`Platform ${platform} not enabled or missing credentials, skipping`);
      }
    }
  }

  async directUpload(buildId: string, platform: string): Promise<void> {
    this.logger.log(`Direct upload build ${buildId} to platform: ${platform}`);

    const build = this.storageService.getBuild(buildId);
    if (!build) {
      throw new NotFoundException(`Build ${buildId} not found`);
    }

    if (!build.artifacts || (!build.artifacts.ipa && !build.artifacts.apk)) {
      throw new Error(`Build ${buildId} has no artifacts, cannot upload`);
    }

    const artifactPath = build.platform === 'ios' ? build.artifacts.ipa : build.artifacts.apk;
    if (!artifactPath) {
      throw new Error(`No artifact found for build ${buildId}`);
    }

    if (platform === 'pgyer') {
      await this.createPublishTask(buildId, 'pgyer', artifactPath, build.pgyerAccountType);
      return;
    }

    await this.createPublishTask(buildId, platform, artifactPath);
  }

  async retryPublish(publishId: string): Promise<void> {
    this.logger.log(`Retrying publish record: ${publishId}`);

    // Find all publishes to locate the one to retry
    const allPublishes = this.storageService.listAllPublishes({});
    const record = allPublishes.data.find((p) => p.id === publishId);
    if (!record) {
      throw new NotFoundException(`Publish record ${publishId} not found`);
    }

    if (record.status !== 'failed') {
      throw new Error(`Publish record ${publishId} is not in failed status`);
    }

    const build = this.storageService.getBuild(record.buildId);
    if (!build) {
      throw new NotFoundException(`Build ${record.buildId} not found for publish record`);
    }

    const artifactPath = build.platform === 'ios' ? build.artifacts?.ipa : build.artifacts?.apk;
    if (!artifactPath) {
      throw new Error(`Build ${record.buildId} has no artifacts, cannot retry`);
    }

    await this.createPublishTask(record.buildId, record.platform, artifactPath, build.pgyerAccountType);
  }

  async uploadFile(filePath: string, platform: string, releaseNotes?: string): Promise<{ buildId: string; recordId: string; platform: string }> {
    this.logger.log(`Uploading file ${filePath} to platform: ${platform}`);

    // Create a temporary build record for tracking
    const buildId = `upload-${Date.now()}`;

    // Create publish task directly
    const recordId = await this.createPublishTask(buildId, platform, filePath, undefined, releaseNotes);

    return { buildId, recordId, platform };
  }
}
