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
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiParam,
  ApiBody,
  ApiResponse,
} from '@nestjs/swagger';
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
    label: 'App Store Connect (CN)',
    fields: [
      { key: 'apple_id', label: 'Apple ID', secret: false },
      { key: 'bundle_id', label: 'Bundle ID', secret: false },
      { key: 'issuer_id', label: 'Issuer ID', secret: false },
      { key: 'key_id', label: 'Key ID', secret: false },
      { key: 'private_key', label: 'Private Key (P8)', secret: true },
    ],
  },
  appstore_over: {
    label: 'App Store Connect (OVER)',
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

const STORE_URLS: Record<string, string> = {
  appstore: 'https://appstoreconnect.apple.com/',
  appstore_over: 'https://appstoreconnect.apple.com/',
  xiaomi: 'https://developer.xiaomi.com/',
  huawei: 'https://developer.huawei.com/consumer/cn/',
  oppo: 'https://open.oppomobile.com/',
  vivo: 'https://developer.vivo.com.cn/',
  tencent: 'https://op.open.qq.com/',
  qihu360: 'https://dev.360.cn/',
  honor: 'https://developer.honor.com/',
  samsung: 'https://seller.samsungapps.com/',
};

const APPLE_PLATFORMS = ['appstore', 'appstore_over'];

@ApiTags('config')
@ApiBearerAuth()
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
  @ApiOperation({ summary: '获取 Git 分支列表', description: '从配置的 Git 仓库获取所有远程分支' })
  @ApiResponse({ status: 200, description: '返回分支名称数组' })
  async getBranches() {
    const workspaceDir = this.configService.get<string>('WORKSPACE_DIR') || '';
    const repoDir = `${workspaceDir}/repo`;

    try {
      // Only list already-fetched remote branches (git fetch is too slow for on-demand UI)
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
  @ApiOperation({ summary: '获取系统配置', description: '返回 Git、工作空间、SSH 及发布平台配置状态' })
  async getConfig() {
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
      const cred = await this.storageService.getPublishingCredential(platform);
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
  @ApiOperation({ summary: '获取环境变量列表', description: '返回所有系统环境变量及其配置状态' })
  async getEnvList() {
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
      const cred = await this.storageService.getPublishingCredential(platform);
      for (const field of meta.fields) {
        configs.push({
          key: `PUBLISH_${platform.toUpperCase()}_${field.key.toUpperCase()}`,
          label: `${meta.label} - ${field.label}`,
          type: 'publishing',
          secret: field.secret,
        });
      }
    }

    return await Promise.all(configs.map(async (c) => {
      // For fastlane platform credentials, check storage
      if (c.key.startsWith('PUBLISH_')) {
        const parts = c.key.split('_');
        const platform = parts[1].toLowerCase();
        const fieldKey = parts.slice(2).join('_').toLowerCase();
        const cred = await this.storageService.getPublishingCredential(platform);
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
    }));
  }

  // ==================== Publishing Credentials ====================

  @Get('publishing')
  @ApiOperation({ summary: '获取发布平台配置', description: '返回所有应用商店的凭证配置状态和字段定义' })
  async getPublishingConfig() {
    const result: Record<string, any> = {};

    for (const [platform, meta] of Object.entries(PLATFORM_META)) {
      const cred = await this.storageService.getPublishingCredential(platform);
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
  @ApiOperation({ summary: '保存发布平台凭证', description: '保存或更新指定应用商店的 API 凭证（密钥字段为空时不覆盖原值）' })
  @ApiParam({ name: 'platform', description: '平台标识', enum: ['appstore', 'appstore_over', 'xiaomi', 'huawei', 'oppo', 'vivo', 'tencent', 'qihu360', 'honor', 'samsung'] })
  @ApiBody({ schema: { type: 'object', properties: { credentials: { type: 'object', description: '凭证键值对' } } } })
  async savePublishingCredential(
    @Param('platform') platform: string,
    @Body() body: { credentials: Record<string, string> },
  ) {
    const meta = PLATFORM_META[platform];
    if (!meta) throw new NotFoundException(`Unknown platform: ${platform}`);

    const record = await this.storageService.savePublishingCredential(platform, body.credentials);
    return {
      platform: record.platform,
      enabled: record.enabled,
      configured: Object.keys(record.credentials).length > 0,
    };
  }

  @Delete('publishing/:platform')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '删除发布平台凭证', description: '清除指定应用商店的所有凭证' })
  @ApiParam({ name: 'platform', description: '平台标识' })
  async deletePublishingCredential(@Param('platform') platform: string) {
    const meta = PLATFORM_META[platform];
    if (!meta) throw new NotFoundException(`Unknown platform: ${platform}`);

    await this.storageService.deletePublishingCredential(platform);
  }

  @Put('publishing/:platform/toggle')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '切换发布平台启用状态', description: '启用或禁用指定应用商店的发布功能' })
  @ApiParam({ name: 'platform', description: '平台标识' })
  @ApiBody({ schema: { type: 'object', properties: { enabled: { type: 'boolean' } } } })
  async togglePublishingPlatform(
    @Param('platform') platform: string,
    @Body() body: { enabled: boolean },
  ) {
    const meta = PLATFORM_META[platform];
    if (!meta) throw new NotFoundException(`Unknown platform: ${platform}`);

    const record = await this.storageService.togglePublishingPlatform(platform, body.enabled);
    if (!record) throw new NotFoundException(`Platform ${platform} not configured yet`);
    return { platform: record.platform, enabled: record.enabled };
  }

  // ==================== Store Accounts ====================

  @Get('store-accounts')
  @ApiOperation({ summary: '获取应用商店账号信息', description: '返回所有应用商店的开发者控制台地址和凭证（Apple 平台不返回凭证）' })
  async getStoreAccounts() {
    return await Promise.all(Object.entries(PLATFORM_META).map(async ([platform, meta]) => {
      const cred = await this.storageService.getPublishingCredential(platform);
      const isApple = APPLE_PLATFORMS.includes(platform);

      return {
        platform,
        label: meta.label,
        url: STORE_URLS[platform] || '',
        isApple,
        configured: !!(cred && Object.keys(cred.credentials).length > 0),
        fields: isApple
          ? []
          : meta.fields.map((f) => ({
              ...f,
              value: cred?.credentials?.[f.key] || '',
              configured: !!cred?.credentials?.[f.key],
            })),
      };
    }));
  }

  // ==================== Option Groups ====================

  @Get('option-groups')
  @ApiOperation({ summary: '获取构建选项组', description: '返回所有可自定义的构建参数选项组' })
  async getOptionGroups() {
    return await this.storageService.listOptionGroups();
  }

  @Post('option-groups')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '创建选项组', description: '创建新的构建参数选项组' })
  @ApiBody({ type: CreateOptionGroupDto })
  async createOptionGroup(@Body() dto: CreateOptionGroupDto) {
    return await this.storageService.createOptionGroup(dto);
  }

  @Put('option-groups/:id')
  @ApiOperation({ summary: '更新选项组', description: '更新指定选项组的名称或选项值列表' })
  @ApiParam({ name: 'id', description: '选项组 ID' })
  @ApiBody({ type: UpdateOptionGroupDto })
  async updateOptionGroup(@Param('id') id: string, @Body() dto: UpdateOptionGroupDto) {
    const group = await this.storageService.updateOptionGroup(id, dto);
    if (!group) throw new NotFoundException(`Option group ${id} not found`);
    return group;
  }

  @Delete('option-groups/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '删除选项组', description: '删除指定的构建参数选项组' })
  @ApiParam({ name: 'id', description: '选项组 ID' })
  async deleteOptionGroup(@Param('id') id: string) {
    const deleted = await this.storageService.deleteOptionGroup(id);
    if (!deleted) throw new NotFoundException(`Option group ${id} not found`);
  }

  @Post('option-groups/:id/values')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '添加选项值', description: '为指定选项组添加一个新的可选值' })
  @ApiParam({ name: 'id', description: '选项组 ID' })
  @ApiBody({ type: AddOptionValueDto })
  async addOptionValue(@Param('id') id: string, @Body() dto: AddOptionValueDto) {
    const group = await this.storageService.addOptionValue(id, dto);
    if (!group) throw new NotFoundException(`Option group ${id} not found`);
    return group;
  }

  @Delete('option-groups/:id/values/:value')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '删除选项值', description: '从指定选项组中移除一个可选值' })
  @ApiParam({ name: 'id', description: '选项组 ID' })
  @ApiParam({ name: 'value', description: '选项值' })
  async removeOptionValue(@Param('id') id: string, @Param('value') value: string) {
    const group = await this.storageService.removeOptionValue(id, value);
    if (!group) throw new NotFoundException(`Option group ${id} not found`);
  }
}
