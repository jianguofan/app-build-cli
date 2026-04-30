import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface PublishResult {
  success: boolean;
  downloadUrl?: string;
  uploadId?: string;
  error?: string;
}

export interface PublishStatus {
  status: 'pending' | 'reviewing' | 'approved' | 'rejected';
  message?: string;
}

@Injectable()
export abstract class BasePublisher {
  protected readonly logger: Logger;
  abstract readonly platform: string;

  constructor(protected configService: ConfigService) {
    this.logger = new Logger(this.constructor.name);
  }

  abstract upload(artifactPath: string, config: any): Promise<PublishResult>;

  abstract checkStatus(uploadId: string): Promise<PublishStatus>;

  protected async validateConfig(config: any, requiredFields: string[]): Promise<void> {
    const missing = requiredFields.filter((field) => !config[field]);
    if (missing.length > 0) {
      throw new Error(`Missing required config fields: ${missing.join(', ')}`);
    }
  }
}
