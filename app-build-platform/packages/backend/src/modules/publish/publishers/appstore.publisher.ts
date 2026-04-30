import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BasePublisher, PublishResult, PublishStatus } from './base.publisher';
import axios from 'axios';
import * as fs from 'fs';
import * as jwt from 'jsonwebtoken';

@Injectable()
export class AppStorePublisher extends BasePublisher {
  readonly platform = 'appstore';
  private readonly apiUrl = 'https://api.appstoreconnect.apple.com/v1';

  constructor(configService: ConfigService) {
    super(configService);
  }

  async upload(artifactPath: string, config: any): Promise<PublishResult> {
    try {
      await this.validateConfig(config, ['issuerId', 'keyId', 'privateKey', 'bundleId']);

      this.logger.log(`Uploading to App Store Connect: ${artifactPath}`);

      // 检查文件是否存在
      if (!fs.existsSync(artifactPath)) {
        throw new Error(`Artifact file not found: ${artifactPath}`);
      }

      // 生成 JWT token
      const token = this.generateToken(config);

      // Phase 1: 模拟上传（实际实现需要使用 Transporter API）
      // 实际流程:
      // 1. 获取上传 URL
      // 2. 上传 IPA 文件
      // 3. 提交构建版本

      this.logger.log('App Store Connect upload simulated (Phase 1)');

      return {
        success: true,
        uploadId: `appstore-${Date.now()}`,
        downloadUrl: undefined, // App Store 无直接下载链接
      };
    } catch (error: any) {
      this.logger.error(`App Store upload failed: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async checkStatus(uploadId: string): Promise<PublishStatus> {
    // Phase 1: 返回模拟状态
    // Phase 2: 实际调用 App Store Connect API 查询审核状态
    return {
      status: 'reviewing',
      message: 'Submitted for review',
    };
  }

  private generateToken(config: any): string {
    const now = Math.floor(Date.now() / 1000);

    const payload = {
      iss: config.issuerId,
      iat: now,
      exp: now + 1200, // 20 分钟有效期
      aud: 'appstoreconnect-v1',
    };

    const header = {
      alg: 'ES256',
      kid: config.keyId,
      typ: 'JWT',
    };

    return jwt.sign(payload, config.privateKey, {
      algorithm: 'ES256',
      header,
    });
  }

  private async getUploadUrl(token: string, bundleId: string): Promise<string> {
    // 实际实现: 调用 App Store Connect API 获取上传 URL
    const response = await axios.post(
      `${this.apiUrl}/builds`,
      {
        data: {
          type: 'builds',
          attributes: {
            bundleId,
          },
        },
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      },
    );

    return response.data.data.attributes.uploadUrl;
  }
}
