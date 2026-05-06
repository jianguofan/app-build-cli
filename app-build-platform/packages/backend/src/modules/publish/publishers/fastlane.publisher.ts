import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ExecutorService } from '../../executor/executor.service';
import { StorageService } from '../../storage/storage.service';
import { BasePublisher, PublishResult, PublishStatus } from './base.publisher';
import * as fs from 'fs';

interface FastlanePlatformConfig {
  platform: string;
  lane: string;
  requiredFields: string[];
}

const PLATFORM_MAP: Record<string, FastlanePlatformConfig> = {
  appstore: {
    platform: 'ios',
    lane: 'publish_appstore',
    requiredFields: ['apple_id', 'bundle_id'],
  },
  xiaomi: {
    platform: 'android',
    lane: 'publish_xiaomi',
    requiredFields: ['app_id', 'app_key', 'app_secret'],
  },
  huawei: {
    platform: 'android',
    lane: 'publish_huawei',
    requiredFields: ['client_id', 'client_secret', 'app_id'],
  },
  oppo: {
    platform: 'android',
    lane: 'publish_oppo',
    requiredFields: ['app_key', 'app_secret', 'package_name'],
  },
  vivo: {
    platform: 'android',
    lane: 'publish_vivo',
    requiredFields: ['access_key', 'access_secret', 'package_name'],
  },
  tencent: {
    platform: 'android',
    lane: 'publish_tencent',
    requiredFields: ['organization_id', 'app_key'],
  },
  qihu360: {
    platform: 'android',
    lane: 'publish_qihu360',
    requiredFields: ['access_token', 'app_id'],
  },
  honor: {
    platform: 'android',
    lane: 'publish_honor',
    requiredFields: ['client_id', 'client_secret', 'app_id'],
  },
  samsung: {
    platform: 'android',
    lane: 'publish_samsung',
    requiredFields: ['access_token', 'app_id'],
  },
};

@Injectable()
export class FastlanePublisher extends BasePublisher {
  readonly platform = 'fastlane';
  private readonly fastlaneDir: string;

  constructor(
    configService: ConfigService,
    private executorService: ExecutorService,
    private storageService: StorageService,
  ) {
    super(configService);
    const workspaceDir = configService.get<string>('WORKSPACE_DIR') || '';
    this.fastlaneDir = `${workspaceDir}/fastlane`;
  }

  async upload(artifactPath: string, config: any): Promise<PublishResult> {
    const targetPlatform = config.targetPlatform;
    const cfg = PLATFORM_MAP[targetPlatform];

    if (!cfg) {
      return { success: false, error: `Unknown fastlane platform: ${targetPlatform}` };
    }

    try {
      await this.validateConfig(config.credentials, cfg.requiredFields);

      if (!fs.existsSync(artifactPath)) {
        throw new Error(`Artifact file not found: ${artifactPath}`);
      }

      // Build fastlane command with credentials
      const credArgs = Object.entries(config.credentials as Record<string, string>)
        .map(([k, v]) => `${k}:${v}`)
        .join(' ');

      const command = `cd ${this.fastlaneDir} && bundle exec fastlane ${cfg.platform} ${cfg.lane} artifact_path:${artifactPath} ${credArgs}`;

      this.logger.log(`Executing fastlane: ${cfg.platform} ${cfg.lane} for platform ${targetPlatform}`);

      const result = await this.runFastlaneCommand(command);

      if (result.success) {
        return { success: true, uploadId: `${targetPlatform}-${Date.now()}` };
      }
      return { success: false, error: result.error };
    } catch (error: any) {
      this.logger.error(`Fastlane upload failed for ${targetPlatform}: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  async checkStatus(uploadId: string): Promise<PublishStatus> {
    // Fastlane 完成后返回 uploaded 状态，各厂商审核需后续轮询
    return { status: 'reviewing', message: 'Submitted for review' };
  }

  private async runFastlaneCommand(
    command: string,
  ): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve) => {
      const { exec } = require('child_process');
      exec(
        command,
        {
          timeout: 30 * 60 * 1000, // 30 minutes
          env: { ...process.env, LC_ALL: 'en_US.UTF-8' },
        },
        (error: any, stdout: string, stderr: string) => {
          if (error) {
            this.logger.error(`Fastlane command failed: ${stderr || error.message}`);
            resolve({ success: false, error: stderr || error.message });
            return;
          }
          this.logger.log(`Fastlane output: ${stdout.slice(-500)}`);
          resolve({ success: true });
        },
      );
    });
  }
}
