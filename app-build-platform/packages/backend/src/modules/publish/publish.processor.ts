import { Processor, Process } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { PublishService } from './publish.service';
import { StorageService } from '../storage/storage.service';

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
];

@Processor('publish')
export class PublishProcessor {
  private readonly logger = new Logger(PublishProcessor.name);

  constructor(
    private publishService: PublishService,
    private storageService: StorageService,
  ) {}

  @Process('upload')
  async handlePublish(
    job: Job<{
      recordId: string;
      buildId: string;
      platform: string;
      artifactPath: string;
      pgyerAccountType?: string;
      releaseNotes?: string;
    }>,
  ) {
    const { recordId, buildId, platform, artifactPath, pgyerAccountType, releaseNotes } = job.data;

    this.logger.log(`Processing publish task: ${recordId} for platform: ${platform}`);

    try {
      // 更新状态为 uploading
      await this.publishService.updatePublishStatus(recordId, 'uploading');

      // 获取发布器
      const publisher = this.publishService.getPublisher(platform);

      // 获取配置
      const config = this.getPublishConfig(platform, pgyerAccountType, releaseNotes);

      // 执行上传
      const result = await publisher.upload(artifactPath, config);

      if (result.success) {
        const updates: any = {
          downloadUrl: result.downloadUrl,
        };

        // For App Store, generate review URL from the apple_id in credentials
        if (platform === 'appstore') {
          const appleId = config.credentials?.apple_id;
          if (appleId) {
            updates.reviewUrl = `https://appstoreconnect.apple.com/apps/${appleId}/distribution/ios/version/inflight`;
            this.logger.log(`App Store review URL: ${updates.reviewUrl}`);
          }
        }

        await this.publishService.updatePublishStatus(recordId, 'success', updates);

        this.logger.log(`Publish task ${recordId} completed successfully`);
      } else {
        await this.publishService.updatePublishStatus(recordId, 'failed', {
          error: result.error,
        });

        this.logger.error(`Publish task ${recordId} failed: ${result.error}`);
        throw new Error(result.error);
      }
    } catch (error: any) {
      this.logger.error(`Publish task ${recordId} failed: ${error.message}`);

      await this.publishService.updatePublishStatus(recordId, 'failed', {
        error: error.message,
      });

      throw error;
    }
  }

  private getPublishConfig(platform: string, pgyerAccountType?: string, releaseNotes?: string): any {
    if (platform === 'pgyer') {
      return {
        apiKey: this.getPgyerApiKey(pgyerAccountType),
      };
    }

    if (FASTLANE_PLATFORMS.includes(platform)) {
      // Read credentials from the Settings page (StorageService)
      const allCreds = this.storageService.listPublishingCredentials();
      const cred = allCreds.find((c) => c.platform === platform);
      if (!cred || Object.keys(cred.credentials).length === 0) {
        throw new Error(`No credentials configured for platform: ${platform}`);
      }
      return {
        targetPlatform: platform,
        credentials: cred.credentials,
        releaseNotes,
      };
    }

    return {};
  }

  private getPgyerApiKey(accountType?: string): string | undefined {
    const { ConfigService } = require('@nestjs/config');
    // PGYER API keys remain in env vars since Pgyer publisher is unchanged
    const apiKey = process.env.PGYER_API_KEY;
    if (accountType) {
      const accountKey = process.env[`PGYER_API_KEY_${accountType.toUpperCase()}`];
      if (accountKey && !accountKey.startsWith('your_')) {
        return accountKey;
      }
    }
    return apiKey && !apiKey.startsWith('your_') ? apiKey : undefined;
  }
}
