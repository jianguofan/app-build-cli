import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ExecutorService } from '../../executor/executor.service';
import { StorageService } from '../../storage/storage.service';
import { BasePublisher, PublishResult, PublishStatus } from './base.publisher';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

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
    this.fastlaneDir = this.resolveFastlaneDir(configService);
  }

  private resolveFastlaneDir(configService: ConfigService): string {
    // 1. Explicit FASTLANE_DIR env var takes priority
    const configured = configService.get<string>('FASTLANE_DIR');
    if (configured && fs.existsSync(configured)) {
      return configured;
    }

    // 2. Workspace fastlane directory (for production setups)
    const workspaceDir = configService.get<string>('WORKSPACE_DIR') || '';
    const workspaceFastlane = `${workspaceDir}/fastlane`;
    if (fs.existsSync(workspaceFastlane)) {
      return workspaceFastlane;
    }

    // 3. Project-bundled fastlane directory (for dev / monorepo setups)
    const projectFastlane = path.join(process.cwd(), 'fastlane');
    if (fs.existsSync(projectFastlane)) {
      return projectFastlane;
    }

    // 4. Default to workspace path (will error with clear message at upload time)
    return workspaceFastlane;
  }

  async upload(artifactPath: string, config: any): Promise<PublishResult> {
    const targetPlatform = config.targetPlatform;
    const cfg = PLATFORM_MAP[targetPlatform];

    if (!cfg) {
      return { success: false, error: `Unknown fastlane platform: ${targetPlatform}` };
    }

    let keyTempFile: string | null = null;

    try {
      await this.validateConfig(config.credentials, cfg.requiredFields);

      if (!fs.existsSync(artifactPath)) {
        throw new Error(`Artifact file not found: ${artifactPath}`);
      }

      // Build fastlane command with credentials as environment variables
      const credEnv: Record<string, string> = {};
      const credArgs: string[] = [];

      const credentials = { ...config.credentials } as Record<string, string>;

      // Write private_key to a temp file so it never touches shell expansion.
      // Also normalizes flattened PEM (single-line with spaces) to proper multi-line format.
      if (credentials.private_key) {
        const tmpDir = os.tmpdir();
        keyTempFile = path.join(tmpDir, `fastlane-authkey-${Date.now()}.p8`);

        // Normalize PEM: convert single-line PEM (spaces between sections) to proper multi-line format
        let keyContent = credentials.private_key;
        const beginMatch = keyContent.match(/-----BEGIN[^-]+-----/);
        const endMatch = keyContent.match(/-----END[^-]+-----/);
        if (beginMatch && endMatch) {
          const header = beginMatch[0];
          const footer = endMatch[0];
          const bodyStart = keyContent.indexOf(header) + header.length;
          const bodyEnd = keyContent.indexOf(footer);
          let body = keyContent.substring(bodyStart, bodyEnd).trim();

          // If body has no newlines, it's a flattened PEM — replace spaces with newlines
          if (!body.includes('\n')) {
            body = body.replace(/\s+/g, '\n');
            keyContent = `${header}\n${body}\n${footer}\n`;
          } else if (!keyContent.endsWith('\n')) {
            keyContent += '\n';
          }
        } else if (!keyContent.endsWith('\n')) {
          keyContent += '\n';
        }

        fs.writeFileSync(keyTempFile, keyContent, { mode: 0o600 });
        this.logger.log(`Wrote private key to temp file: ${keyTempFile}`);

        // Pass the file path instead of the key content
        credentials.private_key_path = keyTempFile;
        delete credentials.private_key;
      }

      Object.entries(credentials).forEach(([k, v]) => {
        // For multi-line values, use environment variables (private_key already handled above)
        if (v.includes('\n') || v.includes('-----BEGIN') || v.includes('-----END') || v.length > 200) {
          const envKey = `FL_${k.toUpperCase()}`;
          credEnv[envKey] = v;
          credArgs.push(`${k}:"$${envKey}"`);
          this.logger.log(`Using env var for ${k}: ${envKey} (length: ${v.length})`);
        } else {
          // For simple values, escape and pass directly
          const escapedValue = v.replace(/'/g, "'\\''");
          credArgs.push(`${k}:'${escapedValue}'`);
          this.logger.log(`Using direct value for ${k}: ${v.substring(0, 20)}...`);
        }
      });

      // Add release notes if provided
      if (config.releaseNotes) {
        const rn = config.releaseNotes as string;
        if (rn.includes('\n') || rn.length > 200) {
          credEnv['FL_RELEASE_NOTES'] = rn;
          credArgs.push(`release_notes:"$FL_RELEASE_NOTES"`);
        } else {
          const escapedValue = rn.replace(/'/g, "'\\''");
          credArgs.push(`release_notes:'${escapedValue}'`);
        }
        this.logger.log(`Including release notes (${rn.length} chars)`);
      }

      const command = `cd ${this.fastlaneDir} && bundle exec fastlane ${cfg.platform} ${cfg.lane} artifact_path:'${artifactPath}' ${credArgs.join(' ')}`;

      this.logger.log(`Command: ${command}`);
      this.logger.log(`Environment variables: ${Object.keys(credEnv).join(', ')}`);

      this.logger.log(`Executing fastlane: ${cfg.platform} ${cfg.lane} for platform ${targetPlatform}`);

      const result = await this.runFastlaneCommand(command, credEnv);

      if (result.success) {
        return { success: true, uploadId: `${targetPlatform}-${Date.now()}` };
      }
      return { success: false, error: result.error };
    } catch (error: any) {
      this.logger.error(`Fastlane upload failed for ${targetPlatform}: ${error.message}`);
      return { success: false, error: error.message };
    } finally {
      // Clean up temp key file
      if (keyTempFile) {
        try {
          fs.unlinkSync(keyTempFile);
          this.logger.log(`Cleaned up temp key file: ${keyTempFile}`);
        } catch {
          // Best-effort cleanup
        }
      }
    }
  }

  async checkStatus(uploadId: string): Promise<PublishStatus> {
    // Fastlane 完成后返回 uploaded 状态，各厂商审核需后续轮询
    return { status: 'reviewing', message: 'Submitted for review' };
  }

  private async runFastlaneCommand(
    command: string,
    additionalEnv: Record<string, string> = {},
  ): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve) => {
      const { exec } = require('child_process');
      exec(
        command,
        {
          timeout: 30 * 60 * 1000, // 30 minutes
          env: { ...process.env, ...additionalEnv, LC_ALL: 'en_US.UTF-8' },
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
