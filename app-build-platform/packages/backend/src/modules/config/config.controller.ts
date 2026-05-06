import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { StorageService } from '../storage/storage.service';
import { ExecutorService } from '../executor/executor.service';
import {
  CreateOptionGroupDto,
  UpdateOptionGroupDto,
  AddOptionValueDto,
} from './dto/option-group.dto';

const PLATFORM_META: Record<string, { label: string; fields: { key: string; label: string; secret: boolean }[] }> = {
  appstore: {
    label: 'App Store Connect',
    fields: [
      { key: 'apple_id', label: 'Apple ID', secret: false },
      { key: 'bundle_id', label: 'Bundle ID', secret: false },
      { key: 'issuer_id', label: 'Issuer ID', secret: false },
      { key: 'key_id', label: 'Key ID', secret: false },
      { key: 'private_key', label: 'Private Key (P8)', secret: true },
    ],
  },
  xiaomi: {
    label: '小米应用商店',
    fields: [
      { key: 'app_id', label: 'App ID', secret: false },
      { key: 'app_key', label: 'App Key', secret: false },
      { key: 'app_secret', label: 'App Secret', secret: true },
    ],
  },
  huawei: {
    label: '华为应用市场',
    fields: [
      { key: 'client_id', label: 'Client ID', secret: false },
      { key: 'client_secret', label: 'Client Secret', secret: true },
      { key: 'app_id', label: 'App ID', secret: false },
    ],
  },
  oppo: {
    label: 'OPPO 软件商店',
    fields: [
      { key: 'app_key', label: 'App Key', secret: false },
      { key: 'app_secret', label: 'App Secret', secret: true },
      { key: 'package_name', label: 'Package Name', secret: false },
    ],
  },
  vivo: {
    label: 'VIVO 应用商店',
    fields: [
      { key: 'access_key', label: 'Access Key', secret: false },
      { key: 'access_secret', label: 'Access Secret', secret: true },
      { key: 'package_name', label: 'Package Name', secret: false },
    ],
  },
  tencent: {
    label: '应用宝',
    fields: [
      { key: 'organization_id', label: 'Organization ID', secret: false },
      { key: 'app_key', label: 'App Key', secret: true },
    ],
  },
  qihu360: {
    label: '360 手机助手',
    fields: [
      { key: 'access_token', label: 'Access Token', secret: true },
      { key: 'app_id', label: 'App ID', secret: false },
    ],
  },
  honor: {
    label: '荣耀应用市场',
    fields: [
      { key: 'client_id', label: 'Client ID', secret: false },
      { key: 'client_secret', label: 'Client Secret', secret: true },
      { key: 'app_id', label: 'App ID', secret: false },
    ],
  },
  samsung: {
    label: '三星应用商店',
    fields: [
      { key: 'access_token', label: 'Access Token', secret: true },
      { key: 'app_id', label: 'App ID', secret: false },
    ],
  },
};

@Controller('config')
@UseGuards(JwtAuthGuard)
export class ConfigController {
  constructor(
    private configService: ConfigService,
    private storageService: StorageService,
    private executorService: ExecutorService,
  ) {}

  // ==================== Branches ====================

  @Get('branches')
  async getBranches() {
    const workspaceDir = this.configService.get<string>('WORKSPACE_DIR') || '';
    const repoDir = `${workspaceDir}/repo`;

    try {
      const stdout = await this.executorService.localExec(
        `cd ${repoDir} && git branch -r`,
      );

      const branches = stdout
        .split('\n')
        .map((line: string) => line.trim())
        .filter((line: string) => line && !line.includes('->'))
        .map((line: string) => line.replace(/^origin\//, ''))
        .filter((v: string, i: number, a: string[]) => a.indexOf(v) === i);

      return branches;
    } catch {
      return [];
    }
  }

  // ==================== System Config ====================

  @Get()
  getConfig() {
    // PGYER status — still from env vars
    const pgyerKeys = [
      'PGYER_API_KEY',
      'PGYER_API_KEY_JIANGUO',
      'PGYER_API_KEY_LUPEILONG',
      'PGYER_API_KEY_ALLENLI',
      'PGYER_API_KEY_ALANWU',
      'PGYER_API_KEY_LB',
    ];
    const pgyerConfigured = pgyerKeys.some(
      (k) => this.configService.get(k) && !this.configService.get(k).startsWith('your_'),
    );

    // Fastlane platforms — from credential storage
    const publishing: Record<string, boolean> = { pgyer: pgyerConfigured };
    for (const platform of Object.keys(PLATFORM_META)) {
      const cred = this.storageService.getPublishingCredential(platform);
      publishing[platform] = !!(cred && cred.enabled && Object.keys(cred.credentials).length > 0);
    }

    return {
      git: { repoUrl: this.configService.get('GIT_REPO_URL') || '' },
      workspace: { dir: this.configService.get('WORKSPACE_DIR') || '' },
      ssh: { user: this.configService.get('SSH_USER') || '' },
      publishing,
    };
  }

  @Get('env')
  getEnvList() {
    const configs = [
      { key: 'GIT_REPO_URL', label: 'Git 仓库地址', type: 'git', secret: false },
      { key: 'WORKSPACE_DIR', label: '工作目录', type: 'workspace', secret: false },
      { key: 'SSH_USER', label: 'SSH 用户名', type: 'ssh', secret: false },
      { key: 'KEYCHAIN_PASSWORD', label: 'Keychain 密码', type: 'ssh', secret: true },
      { key: 'PGYER_API_KEY', label: '蒲公英 API Key (通用)', type: 'publishing', secret: true },
      { key: 'PGYER_API_KEY_JIANGUO', label: '蒲公英 API Key (jianguo)', type: 'publishing', secret: true },
      { key: 'PGYER_API_KEY_LUPEILONG', label: '蒲公英 API Key (lupeilong)', type: 'publishing', secret: true },
      { key: 'PGYER_API_KEY_ALLENLI', label: '蒲公英 API Key (allenli)', type: 'publishing', secret: true },
      { key: 'PGYER_API_KEY_ALANWU', label: '蒲公英 API Key (alanwu)', type: 'publishing', secret: true },
      { key: 'PGYER_API_KEY_LB', label: '蒲公英 API Key (lb)', type: 'publishing', secret: true },
    ];

    // Add fastlane platform credentials from storage
    for (const [platform, meta] of Object.entries(PLATFORM_META)) {
      const cred = this.storageService.getPublishingCredential(platform);
      for (const field of meta.fields) {
        configs.push({
          key: `PUBLISH_${platform.toUpperCase()}_${field.key.toUpperCase()}`,
          label: `${meta.label} - ${field.label}`,
          type: 'publishing',
          secret: field.secret,
        });
      }
    }

    return configs.map((c) => {
      // For fastlane platform credentials, check storage
      if (c.key.startsWith('PUBLISH_')) {
        const parts = c.key.split('_');
        const platform = parts[1].toLowerCase();
        const fieldKey = parts.slice(2).join('_').toLowerCase();
        const cred = this.storageService.getPublishingCredential(platform);
        const configured = !!(cred?.credentials[fieldKey]);
        return { ...c, configured, value: c.secret && configured ? '******' : (cred?.credentials[fieldKey] || '') };
      }

      const value = this.configService.get(c.key) || '';
      const isPlaceholder = value.startsWith('your_') || value === '';
      return {
        ...c,
        configured: !isPlaceholder,
        value: c.secret ? (isPlaceholder ? '' : '******') : (isPlaceholder ? '' : value),
      };
    });
  }

  // ==================== Publishing Credentials ====================

  @Get('publishing')
  getPublishingConfig() {
    const result: Record<string, any> = {};

    for (const [platform, meta] of Object.entries(PLATFORM_META)) {
      const cred = this.storageService.getPublishingCredential(platform);
      result[platform] = {
        label: meta.label,
        platform,
        enabled: cred?.enabled ?? false,
        configured: !!(cred && Object.keys(cred.credentials).length > 0),
        fields: meta.fields.map((f) => ({
          ...f,
          value: f.secret && cred?.credentials?.[f.key] ? '******' : (cred?.credentials?.[f.key] || ''),
          configured: !!cred?.credentials?.[f.key],
        })),
      };
    }

    return result;
  }

  @Put('publishing/:platform')
  @HttpCode(HttpStatus.OK)
  savePublishingCredential(
    @Param('platform') platform: string,
    @Body() body: { credentials: Record<string, string> },
  ) {
    const meta = PLATFORM_META[platform];
    if (!meta) throw new NotFoundException(`Unknown platform: ${platform}`);

    const record = this.storageService.savePublishingCredential(platform, body.credentials);
    return {
      platform: record.platform,
      enabled: record.enabled,
      configured: Object.keys(record.credentials).length > 0,
    };
  }

  @Delete('publishing/:platform')
  @HttpCode(HttpStatus.NO_CONTENT)
  deletePublishingCredential(@Param('platform') platform: string) {
    const meta = PLATFORM_META[platform];
    if (!meta) throw new NotFoundException(`Unknown platform: ${platform}`);

    this.storageService.deletePublishingCredential(platform);
  }

  @Put('publishing/:platform/toggle')
  @HttpCode(HttpStatus.OK)
  togglePublishingPlatform(
    @Param('platform') platform: string,
    @Body() body: { enabled: boolean },
  ) {
    const meta = PLATFORM_META[platform];
    if (!meta) throw new NotFoundException(`Unknown platform: ${platform}`);

    const record = this.storageService.togglePublishingPlatform(platform, body.enabled);
    if (!record) throw new NotFoundException(`Platform ${platform} not configured yet`);
    return { platform: record.platform, enabled: record.enabled };
  }

  // ==================== Option Groups ====================

  @Get('option-groups')
  getOptionGroups() {
    return this.storageService.listOptionGroups();
  }

  @Post('option-groups')
  @HttpCode(HttpStatus.CREATED)
  createOptionGroup(@Body() dto: CreateOptionGroupDto) {
    return this.storageService.createOptionGroup(dto);
  }

  @Put('option-groups/:id')
  updateOptionGroup(@Param('id') id: string, @Body() dto: UpdateOptionGroupDto) {
    const group = this.storageService.updateOptionGroup(id, dto);
    if (!group) throw new NotFoundException(`Option group ${id} not found`);
    return group;
  }

  @Delete('option-groups/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteOptionGroup(@Param('id') id: string) {
    const deleted = this.storageService.deleteOptionGroup(id);
    if (!deleted) throw new NotFoundException(`Option group ${id} not found`);
  }

  @Post('option-groups/:id/values')
  @HttpCode(HttpStatus.CREATED)
  addOptionValue(@Param('id') id: string, @Body() dto: AddOptionValueDto) {
    const group = this.storageService.addOptionValue(id, dto);
    if (!group) throw new NotFoundException(`Option group ${id} not found`);
    return group;
  }

  @Delete('option-groups/:id/values/:value')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeOptionValue(@Param('id') id: string, @Param('value') value: string) {
    const group = this.storageService.removeOptionValue(id, value);
    if (!group) throw new NotFoundException(`Option group ${id} not found`);
  }
}
