export interface BuildTask {
  id: string;
  platform: 'ios' | 'android';
  flavor: 'oversea' | 'cn';
  buildMode: 'debug' | 'profile' | 'release';
  env: 'dev' | 'pre' | 'prod';
  branch: string;
  language?: string;
  region?: string;
  pgyerAccountType?: string;
  status: 'pending' | 'running' | 'success' | 'failed';
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  duration?: number; // 秒
  logFile?: string;
  artifacts?: {
    ipa?: string;
    apk?: string;
  };
  error?: string;
}

export interface PublishRecord {
  id: string;
  buildId: string;
  platform: string; // pgyer, appstore, xiaomi, huawei, etc.
  status: 'pending' | 'uploading' | 'success' | 'failed' | 'reviewing';
  downloadUrl?: string;
  error?: string;
  publishedAt?: Date;
}
