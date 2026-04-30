import { Processor, Process } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { PublishService } from './publish.service';
import { ConfigService } from '@nestjs/config';

@Processor('publish')
export class PublishProcessor {
  private readonly logger = new Logger(PublishProcessor.name);

  constructor(
    private publishService: PublishService,
    private configService: ConfigService,
  ) {}

  @Process('upload')
  async handlePublish(
    job: Job<{
      recordId: string;
      buildId: string;
      platform: string;
      artifactPath: string;
    }>,
  ) {
    const { recordId, buildId, platform, artifactPath } = job.data;

    this.logger.log(`Processing publish task: ${recordId} for platform: ${platform}`);

    try {
      // 更新状态为 uploading
      await this.publishService.updatePublishStatus(recordId, 'uploading');

      // 获取发布器
      const publisher = this.publishService.getPublisher(platform);

      // 获取配置
      const config = this.getPublishConfig(platform);

      // 执行上传
      const result = await publisher.upload(artifactPath, config);

      if (result.success) {
        // 上传成功
        await this.publishService.updatePublishStatus(recordId, 'success', {
          downloadUrl: result.downloadUrl,
        });

        this.logger.log(`Publish task ${recordId} completed successfully`);
      } else {
        // 上传失败
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

  private getPublishConfig(platform: string): any {
    // Phase 1: 从环境变量读取配置
    // Phase 2: 从数据库读取加密的配置
    switch (platform) {
      case 'pgyer':
        return {
          apiKey: this.configService.get<string>('PGYER_API_KEY'),
        };
      case 'appstore':
        return {
          issuerId: this.configService.get<string>('APPSTORE_ISSUER_ID'),
          keyId: this.configService.get<string>('APPSTORE_KEY_ID'),
          privateKey: this.configService.get<string>('APPSTORE_PRIVATE_KEY'),
          bundleId: this.configService.get<string>('APPSTORE_BUNDLE_ID'),
        };
      case 'xiaomi':
        return {
          appId: this.configService.get<string>('XIAOMI_APP_ID'),
          appKey: this.configService.get<string>('XIAOMI_APP_KEY'),
          appSecret: this.configService.get<string>('XIAOMI_APP_SECRET'),
        };
      case 'huawei':
        return {
          clientId: this.configService.get<string>('HUAWEI_CLIENT_ID'),
          clientSecret: this.configService.get<string>('HUAWEI_CLIENT_SECRET'),
          appId: this.configService.get<string>('HUAWEI_APP_ID'),
        };
      case 'tencent':
        return {
          organizationId: this.configService.get<string>('TENCENT_ORGANIZATION_ID'),
          appKey: this.configService.get<string>('TENCENT_APP_KEY'),
        };
      case 'vivo':
        return {
          accessKey: this.configService.get<string>('VIVO_ACCESS_KEY'),
          accessSecret: this.configService.get<string>('VIVO_ACCESS_SECRET'),
          packageName: this.configService.get<string>('VIVO_PACKAGE_NAME'),
        };
      case 'oppo':
        return {
          appKey: this.configService.get<string>('OPPO_APP_KEY'),
          appSecret: this.configService.get<string>('OPPO_APP_SECRET'),
          packageName: this.configService.get<string>('OPPO_PACKAGE_NAME'),
        };
      case 'qihu360':
        return {
          accessToken: this.configService.get<string>('QIHU360_ACCESS_TOKEN'),
          appId: this.configService.get<string>('QIHU360_APP_ID'),
        };
      default:
        return {};
    }
  }
}
