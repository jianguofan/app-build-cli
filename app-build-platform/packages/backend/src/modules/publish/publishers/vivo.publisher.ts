import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BasePublisher, PublishResult, PublishStatus } from './base.publisher';
import axios from 'axios';
import * as fs from 'fs';
import FormData from 'form-data';
import * as crypto from 'crypto';

@Injectable()
export class VivoPublisher extends BasePublisher {
  readonly platform = 'vivo';
  private readonly apiUrl = 'https://developer-api.vivo.com.cn/router/rest';

  constructor(configService: ConfigService) {
    super(configService);
  }

  async upload(artifactPath: string, config: any): Promise<PublishResult> {
    try {
      await this.validateConfig(config, ['accessKey', 'accessSecret', 'packageName']);

      this.logger.log(`Uploading to VIVO Store: ${artifactPath}`);

      // 检查文件是否存在
      if (!fs.existsSync(artifactPath)) {
        throw new Error(`Artifact file not found: ${artifactPath}`);
      }

      // 生成签名
      const timestamp = Date.now();
      const sign = this.generateSign(config.accessKey, config.accessSecret, timestamp);

      // 创建表单数据
      const form = new FormData();
      form.append('access_key', config.accessKey);
      form.append('timestamp', timestamp.toString());
      form.append('sign', sign);
      form.append('method', 'app.upload.apk');
      form.append('package_name', config.packageName);
      form.append('apk', fs.createReadStream(artifactPath));

      // Phase 1: 模拟上传
      this.logger.log('VIVO Store upload simulated (Phase 1)');

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
        uploadId: `vivo-${Date.now()}`,
        downloadUrl: undefined,
      };
    } catch (error: any) {
      this.logger.error(`VIVO upload failed: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async checkStatus(uploadId: string): Promise<PublishStatus> {
    // Phase 1: 返回模拟状态
    // Phase 2: 调用 VIVO API 查询审核状态
    return {
      status: 'reviewing',
      message: 'Submitted for review',
    };
  }

  private generateSign(accessKey: string, accessSecret: string, timestamp: number): string {
    const str = `access_key=${accessKey}&timestamp=${timestamp}&access_secret=${accessSecret}`;
    return crypto.createHash('md5').update(str).digest('hex');
  }
}
