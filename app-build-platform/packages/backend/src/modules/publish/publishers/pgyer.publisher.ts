import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BasePublisher, PublishResult, PublishStatus } from './base.publisher';
import axios from 'axios';
import * as fs from 'fs';
import FormData from 'form-data';

@Injectable()
export class PgyerPublisher extends BasePublisher {
  readonly platform = 'pgyer';
  private readonly apiUrl = 'https://www.pgyer.com/apiv2/app/upload';

  constructor(configService: ConfigService) {
    super(configService);
  }

  async upload(artifactPath: string, config: any): Promise<PublishResult> {
    try {
      await this.validateConfig(config, ['apiKey']);

      this.logger.log(`Uploading to Pgyer: ${artifactPath}`);

      // 检查文件是否存在
      if (!fs.existsSync(artifactPath)) {
        throw new Error(`Artifact file not found: ${artifactPath}`);
      }

      // 创建表单数据
      const form = new FormData();
      form.append('_api_key', config.apiKey);
      form.append('file', fs.createReadStream(artifactPath));
      form.append('buildInstallType', '2'); // 公开
      form.append('buildPassword', ''); // 无密码

      // 上传文件
      const response = await axios.post(this.apiUrl, form, {
        headers: {
          ...form.getHeaders(),
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        timeout: 600000, // 10 分钟超时
      });

      if (response.data.code === 0) {
        const downloadUrl = `https://www.pgyer.com/${response.data.data.buildShortcutUrl}`;
        this.logger.log(`Upload to Pgyer successful: ${downloadUrl}`);

        return {
          success: true,
          downloadUrl,
          uploadId: response.data.data.buildKey,
        };
      } else {
        throw new Error(response.data.message || 'Upload failed');
      }
    } catch (error: any) {
      this.logger.error(`Pgyer upload failed: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async checkStatus(uploadId: string): Promise<PublishStatus> {
    // 蒲公英上传后立即可用，无需审核
    return {
      status: 'approved',
      message: 'Available immediately',
    };
  }
}
