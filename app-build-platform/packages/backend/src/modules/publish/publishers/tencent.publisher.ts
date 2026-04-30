import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BasePublisher, PublishResult, PublishStatus } from './base.publisher';
import axios from 'axios';
import * as fs from 'fs';
import FormData from 'form-data';
import * as crypto from 'crypto';

@Injectable()
export class TencentPublisher extends BasePublisher {
  readonly platform = 'tencent';
  private readonly apiUrl = 'https://api.open.qq.com/v3/android/apk';

  constructor(configService: ConfigService) {
    super(configService);
  }

  async upload(artifactPath: string, config: any): Promise<PublishResult> {
    try {
      await this.validateConfig(config, ['organizationId', 'appKey']);

      this.logger.log(`Uploading to Tencent MyApp: ${artifactPath}`);

      // 检查文件是否存在
      if (!fs.existsSync(artifactPath)) {
        throw new Error(`Artifact file not found: ${artifactPath}`);
      }

      // 生成签名
      const timestamp = Math.floor(Date.now() / 1000);
      const sign = this.generateSign(config.appKey, timestamp);

      // 创建表单数据
      const form = new FormData();
      form.append('organizationId', config.organizationId);
      form.append('timestamp', timestamp.toString());
      form.append('sign', sign);
      form.append('apk', fs.createReadStream(artifactPath));

      // Phase 1: 模拟上传
      this.logger.log('Tencent MyApp upload simulated (Phase 1)');

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
        uploadId: `tencent-${Date.now()}`,
        downloadUrl: undefined,
      };
    } catch (error: any) {
      this.logger.error(`Tencent upload failed: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async checkStatus(uploadId: string): Promise<PublishStatus> {
    // Phase 1: 返回模拟状态
    // Phase 2: 调用应用宝 API 查询审核状态
    return {
      status: 'reviewing',
      message: 'Submitted for review',
    };
  }

  private generateSign(appKey: string, timestamp: number): string {
    const str = `appKey=${appKey}&timestamp=${timestamp}`;
    return crypto.createHash('md5').update(str).digest('hex');
  }
}
