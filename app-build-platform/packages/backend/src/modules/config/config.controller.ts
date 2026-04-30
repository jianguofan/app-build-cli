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

@Controller('config')
@UseGuards(JwtAuthGuard)
export class ConfigController {
  constructor(
    private configService: ConfigService,
    private storageService: StorageService,
    private executorService: ExecutorService,
  ) {}

  // ==================== System Config ====================

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

  @Get()
  getConfig() {
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

    return {
      git: { repoUrl: this.configService.get('GIT_REPO_URL') || '' },
      workspace: { dir: this.configService.get('WORKSPACE_DIR') || '' },
      ssh: { user: this.configService.get('SSH_USER') || '' },
      publishing: {
        pgyer: pgyerConfigured,
        appstore: !!(this.configService.get('APPSTORE_ISSUER_ID') && this.configService.get('APPSTORE_ISSUER_ID') !== 'your_issuer_id'),
        xiaomi: !!(this.configService.get('XIAOMI_APP_ID') && this.configService.get('XIAOMI_APP_ID') !== 'your_app_id'),
        huawei: !!(this.configService.get('HUAWEI_CLIENT_ID') && this.configService.get('HUAWEI_CLIENT_ID') !== 'your_client_id'),
        tencent: !!(this.configService.get('TENCENT_ORGANIZATION_ID') && this.configService.get('TENCENT_ORGANIZATION_ID') !== 'your_organization_id'),
        vivo: !!(this.configService.get('VIVO_ACCESS_KEY') && this.configService.get('VIVO_ACCESS_KEY') !== 'your_access_key'),
        oppo: !!(this.configService.get('OPPO_APP_KEY') && this.configService.get('OPPO_APP_KEY') !== 'your_app_key'),
        qihu360: !!(this.configService.get('QIHU360_ACCESS_TOKEN') && this.configService.get('QIHU360_ACCESS_TOKEN') !== 'your_access_token'),
      },
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
      { key: 'APPSTORE_ISSUER_ID', label: 'App Store Issuer ID', type: 'publishing', secret: false },
      { key: 'APPSTORE_KEY_ID', label: 'App Store Key ID', type: 'publishing', secret: false },
      { key: 'XIAOMI_APP_ID', label: '小米 App ID', type: 'publishing', secret: false },
      { key: 'HUAWEI_CLIENT_ID', label: '华为 Client ID', type: 'publishing', secret: false },
      { key: 'TENCENT_ORGANIZATION_ID', label: '应用宝 Organization ID', type: 'publishing', secret: false },
      { key: 'VIVO_ACCESS_KEY', label: 'VIVO Access Key', type: 'publishing', secret: true },
      { key: 'OPPO_APP_KEY', label: 'OPPO App Key', type: 'publishing', secret: false },
      { key: 'QIHU360_ACCESS_TOKEN', label: '360 Access Token', type: 'publishing', secret: true },
    ];

    return configs.map((c) => {
      const value = this.configService.get(c.key) || '';
      const isPlaceholder = value.startsWith('your_') || value === '';
      return {
        ...c,
        configured: !isPlaceholder,
        value: c.secret ? (isPlaceholder ? '' : '******') : (isPlaceholder ? '' : value),
      };
    });
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
