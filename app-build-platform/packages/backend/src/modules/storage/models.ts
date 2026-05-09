export interface BuildTask {
  id: string;
  platform: string;
  flavor: string;
  buildMode: string;
  env: string;
  branch: string;
  language?: string;
  region?: string;
  pgyerAccountType?: string;
  customParams?: Record<string, string>;
  publishTargets?: string[];
  status: 'pending' | 'running' | 'success' | 'failed';
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  duration?: number;
  logFile?: string;
  artifacts?: {
    ipa?: string;
    apk?: string;
  };
  error?: string;
}

export interface BuildOptionValue {
  value: string;
  label: string;
}

export interface BuildOptionGroup {
  id: string;
  key: string;
  label: string;
  values: BuildOptionValue[];
  required: boolean;
  isStandard: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface PublishRecord {
  id: string;
  buildId: string;
  platform: string;
  status: 'pending' | 'uploading' | 'success' | 'failed' | 'reviewing';
  downloadUrl?: string;
  reviewUrl?: string;
  error?: string;
  publishedAt?: Date;
}

export interface PublishingCredential {
  platform: string;
  enabled: boolean;
  credentials: Record<string, string>;
  updatedAt: Date;
}
