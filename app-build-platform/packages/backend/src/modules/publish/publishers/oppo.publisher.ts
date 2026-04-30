import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BasePublisher, PublishResult, PublishStatus } from './base.publisher';
import axios from 'axios';
import * as fs from 'fs';
import FormData from 'form-data';
import * as crypto from 'crypto';

@Injectable()
export class OppoPublisher extends BasePublisher {
  readonly platform = 'oppo';
  private readonly apiUrl = 'https://oop-openapi.heytapmobi.com/resource/v1/app/upApk';

  constructor(configService: ConfigService) {
    super(configService);
  }

  async upload(artifactPath: string, config: any): Promise<PublishResult> {
    try {
      await this.validateConfig(config, ['appKey', 'appSecret', 'packageName']);

      this.logger.log(`Uploading to OPPO Store: ${artifactPath}`);

      // 检查文件是否存在
      if (!fs.existsSync(artifactPath)) {
        throw new Error(`Artifact file not found: ${artifactPath}`);
      }

      // 生成签名
      const timestamp = Math.floor(Date.now() / 1000);
      const sign = this.generateSign(config.appKey, config.appSecret, timestamp);

      // 创建表单数据
      const form = new FormData();
      form.append('appKey', config.appKey);
      form.append('timestamp', timestamp.toString());
      form.append('sign', sign);
      form.append('packageName', config.packageName);
      form.append('apk', fs.createReadStream(artifactPath));

      // Phase 1: 模拟上传
      this.logger.log('OPPO Store upload simulated (Phase 1)');

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
        uploadId: `oppo-${Date.now()}`,
        downloadUrl: undefined,
      };
    } catch (error: any) {
      this.logger.error(`OPPO upload failed: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async checkStatus(uploadId: string): Promise<PublishStatus> {
    // Phase 1: 返回模拟状态
    // Phase 2: 调用 OPPO API 查询审核状态
    return {
      status: 'reviewing',
      message: 'Submitted for review',
    };
  }

  private generateSign(appKey: string, appSecret: string, timestamp: number): string {
    const str = `appKey=${appKey}&timestamp=${timestamp}&appSecret=${appSecret}`;
    return crypto.createHash('md5').update(str).digest('hex');
  }
}
