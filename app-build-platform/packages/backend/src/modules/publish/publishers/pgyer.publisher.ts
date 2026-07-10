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
    const maxRetries = 3;
    let lastError: any;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        this.logger.log(`Pgyer upload attempt ${attempt}/${maxRetries} - artifact: ${artifactPath}`);
        this.logger.log(`Config received: ${JSON.stringify({ hasApiKey: !!config.apiKey, apiKeyPrefix: config.apiKey?.substring(0, 10) })}`);

        await this.validateConfig(config, ['apiKey']);

        if (!config.apiKey) {
          throw new Error('Pgyer API key is missing from config');
        }

        if (config.apiKey.startsWith('your_')) {
          throw new Error(
            'Pgyer API key not configured. Please set PGYER_API_KEY or PGYER_API_KEY_{ACCOUNT} in .env',
          );
        }

        this.logger.log(`Uploading to Pgyer: ${artifactPath}`);
        this.logger.log(`Using API key: ${config.apiKey.substring(0, 10)}...`);

        // 检查文件是否存在
        if (!fs.existsSync(artifactPath)) {
          this.logger.error(`File does not exist at path: ${artifactPath}`);
          throw new Error(`Artifact file not found: ${artifactPath}`);
        }

        const fileStats = fs.statSync(artifactPath);
        const fileSizeMB = (fileStats.size / 1024 / 1024).toFixed(2);
        this.logger.log(`File found - size: ${fileSizeMB} MB`);

        // 创建表单数据
        const form = new FormData();
        form.append('_api_key', config.apiKey);
        form.append('file', fs.createReadStream(artifactPath));

        this.logger.log(`Sending POST request to ${this.apiUrl}...`);

        // 上传文件 - 增加超时时间和更好的错误处理
        const response = await axios.post(this.apiUrl, form, {
          headers: {
            ...form.getHeaders(),
          },
          maxContentLength: Infinity,
          maxBodyLength: Infinity,
          timeout: 900000, // 15 分钟超时
          // 添加重试配置
          validateStatus: (status) => status < 500, // 只对 5xx 错误抛出异常
          // 添加进度监控
          onUploadProgress: (progressEvent) => {
            if (progressEvent.total) {
              const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
              if (percentCompleted % 10 === 0) {
                this.logger.log(`Upload progress: ${percentCompleted}% (${(progressEvent.loaded / 1024 / 1024).toFixed(2)} MB / ${fileSizeMB} MB)`);
              }
            }
          },
        });

        this.logger.log(`Pgyer API response code: ${response.data.code}, message: ${response.data.message || 'success'}`);

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
        lastError = error;
        const errorMsg = error.message || 'Unknown error';
        const errorCode = error.code || 'NO_CODE';

        this.logger.error(`Pgyer upload attempt ${attempt}/${maxRetries} failed:`);
        this.logger.error(`  Error message: ${errorMsg}`);
        this.logger.error(`  Error code: ${errorCode}`);

        if (error.response) {
          this.logger.error(`  HTTP status: ${error.response.status}`);
          this.logger.error(`  Response data: ${JSON.stringify(error.response.data)}`);
        }

        // 对于网络错误或临时服务器错误，尝试重试
        const httpStatus = error.response?.status;
        const isRetryable = errorCode === 'ECONNRESET' ||
                           errorCode === 'ETIMEDOUT' ||
                           errorCode === 'ECONNABORTED' ||
                           errorMsg.includes('socket hang up') ||
                           errorMsg.includes('timeout') ||
                           httpStatus === 502 ||
                           httpStatus === 503 ||
                           httpStatus === 504;

        if (isRetryable && attempt < maxRetries) {
          const waitTime = attempt * 5000; // 递增等待时间：5s, 10s
          this.logger.log(`Retryable error detected (${errorCode || `HTTP ${httpStatus}`}), waiting ${waitTime/1000}s before retry...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          continue;
        }

        // 非网络错误或已达到最大重试次数，直接返回失败
        if (!isRetryable || attempt === maxRetries) {
          break;
        }
      }
    }

    // 所有重试都失败了
    const finalError = lastError?.message || 'Upload failed after multiple retries';
    this.logger.error(`Pgyer upload failed after ${maxRetries} attempts: ${finalError}`);

    return {
      success: false,
      error: `${finalError} (tried ${maxRetries} times)`,
    };
  }

  async checkStatus(uploadId: string): Promise<PublishStatus> {
    // 蒲公英上传后立即可用，无需审核
    return {
      status: 'approved',
      message: 'Available immediately',
    };
  }
}
