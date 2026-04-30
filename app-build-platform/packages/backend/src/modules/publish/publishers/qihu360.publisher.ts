import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BasePublisher, PublishResult, PublishStatus } from './base.publisher';
import axios from 'axios';
import * as fs from 'fs';
import FormData from 'form-data';
import * as crypto from 'crypto';

@Injectable()
export class QihuPublisher extends BasePublisher {
  readonly platform = 'qihu360';
  private readonly apiUrl = 'https://dev.360.cn/api/upload';

  constructor(configService: ConfigService) {
    super(configService);
  }

  async upload(artifactPath: string, config: any): Promise<PublishResult> {
    try {
      await this.validateConfig(config, ['accessToken', 'appId']);

      this.logger.log(`Uploading to 360 Mobile Assistant: ${artifactPath}`);

      // 检查文件是否存在
      if (!fs.existsSync(artifactPath)) {
        throw new Error(`Artifact file not found: ${artifactPath}`);
      }

      // 创建表单数据
      const form = new FormData();
      form.append('access_token', config.accessToken);
      form.append('app_id', config.appId);
      form.append('apk', fs.createReadStream(artifactPath));

      // Phase 1: 模拟上传
      this.logger.log('360 Mobile Assistant upload simulated (Phase 1)');

      // Phase 2: 实际上传
      // const response = await axios.post(this.apiUrl, form, {
      //   headers: {
      //     ...form.getHeaders(),
      //   },
      //   maxContentLength: Infinity,
      //   maxBodyLength: Infinity,
      //   timeout: 600000,
      // });

      return {
        success: true,
        uploadId: `qihu360-${Date.now()}`,
        downloadUrl: undefined,
      };
    } catch (error: any) {
      this.logger.error(`360 upload failed: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async checkStatus(uploadId: string): Promise<PublishStatus> {
    // Phase 1: 返回模拟状态
    // Phase 2: 调用 360 API 查询审核状态
    return {
      status: 'reviewing',
      message: 'Submitted for review',
    };
  }
}
