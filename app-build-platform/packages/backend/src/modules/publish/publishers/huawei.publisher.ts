import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BasePublisher, PublishResult, PublishStatus } from './base.publisher';
import axios from 'axios';
import * as fs from 'fs';
import FormData from 'form-data';

@Injectable()
export class HuaweiPublisher extends BasePublisher {
  readonly platform = 'huawei';
  private readonly authUrl = 'https://connect-api.cloud.huawei.com/api/oauth2/v1/token';
  private readonly uploadUrl = 'https://connect-api.cloud.huawei.com/api/publish/v2/upload-url';

  constructor(configService: ConfigService) {
    super(configService);
  }

  async upload(artifactPath: string, config: any): Promise<PublishResult> {
    try {
      await this.validateConfig(config, ['clientId', 'clientSecret', 'appId']);

      this.logger.log(`Uploading to Huawei AppGallery: ${artifactPath}`);

      // 检查文件是否存在
      if (!fs.existsSync(artifactPath)) {
        throw new Error(`Artifact file not found: ${artifactPath}`);
      }

      // 1. 获取 access token
      const accessToken = await this.getAccessToken(config.clientId, config.clientSecret);

      // 2. 获取上传 URL
      // const uploadUrl = await this.getUploadUrl(accessToken, config.appId);

      // 3. 上传 APK
      // await this.uploadApk(uploadUrl, artifactPath);

      // Phase 1: 模拟上传
      this.logger.log('Huawei AppGallery upload simulated (Phase 1)');

      return {
        success: true,
        uploadId: `huawei-${Date.now()}`,
        downloadUrl: undefined,
      };
    } catch (error: any) {
      this.logger.error(`Huawei upload failed: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async checkStatus(uploadId: string): Promise<PublishStatus> {
    // Phase 1: 返回模拟状态
    // Phase 2: 调用华为 API 查询审核状态
    return {
      status: 'reviewing',
      message: 'Submitted for review',
    };
  }

  private async getAccessToken(clientId: string, clientSecret: string): Promise<string> {
    const response = await axios.post(
      this.authUrl,
      {
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret,
      },
      {
        headers: {
          'Content-Type': 'application/json',
        },
      },
    );

    return response.data.access_token;
  }

  private async getUploadUrl(accessToken: string, appId: string): Promise<string> {
    const response = await axios.get(this.uploadUrl, {
      params: {
        appId,
        suffix: 'apk',
      },
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    return response.data.uploadUrl;
  }
}
