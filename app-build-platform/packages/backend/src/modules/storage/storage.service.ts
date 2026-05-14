import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Repository, FindOptionsWhere } from 'typeorm';
import { BuildTask, BuildOptionGroup, BuildOptionValue, PublishRecord, PublishingCredential } from './models';
import {
  BuildTaskEntity,
  PublishRecordEntity,
  BuildOptionGroupEntity,
  PublishingCredentialEntity,
} from './entities';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);

  constructor(
    @InjectRepository(BuildTaskEntity)
    private buildRepo: Repository<BuildTaskEntity>,
    @InjectRepository(PublishRecordEntity)
    private publishRepo: Repository<PublishRecordEntity>,
    @InjectRepository(BuildOptionGroupEntity)
    private optionGroupRepo: Repository<BuildOptionGroupEntity>,
    @InjectRepository(PublishingCredentialEntity)
    private credentialRepo: Repository<PublishingCredentialEntity>,
    private configService: ConfigService,
  ) {}

  async onModuleInit() {
    await this.initializeOptionDefaults();
    await this.migrateCredentialsFromFile();
  }

  private async migrateCredentialsFromFile(): Promise<void> {
    const count = await this.credentialRepo.count();
    if (count > 0) return; // Already has data, skip migration

    const path = require('path');
    const fs = require('fs');
    const workspaceDir = this.configService.get<string>('WORKSPACE_DIR') || process.cwd();
    const credentialsPath = path.join(workspaceDir, 'publishing-credentials.json');

    try {
      if (fs.existsSync(credentialsPath)) {
        const raw = fs.readFileSync(credentialsPath, 'utf-8');
        const list: PublishingCredential[] = JSON.parse(raw);
        for (const cred of list) {
          cred.updatedAt = new Date(cred.updatedAt);
          await this.credentialRepo.save(this.toCredentialEntity(cred));
        }
        this.logger.log(`Migrated ${list.length} publishing credentials from ${credentialsPath}`);
      }
    } catch (err: any) {
      this.logger.warn(`Failed to migrate credentials from file: ${err.message}`);
    }
  }

  // ==================== Build Tasks ====================

  createBuild(task: BuildTask): void {
    this.buildRepo.save(this.toBuildEntity(task)).catch((err) => {
      this.logger.error(`Failed to save build task: ${err.message}`);
    });
    this.logger.log(`Created build task: ${task.id}`);
  }

  async getBuild(id: string): Promise<BuildTask | undefined> {
    const entity = await this.buildRepo.findOneBy({ id });
    return entity ? this.toBuildModel(entity) : undefined;
  }

  async updateBuild(id: string, updates: Partial<BuildTask>): Promise<void> {
    await this.buildRepo.update(id, this.toBuildEntity(updates));
    this.logger.log(`Updated build task: ${id}`);
  }

  async listBuilds(filters?: {
    status?: string;
    platform?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ data: BuildTask[]; total: number }> {
    const where: FindOptionsWhere<BuildTaskEntity> = {};
    if (filters?.status) where.status = filters.status;
    if (filters?.platform) where.platform = filters.platform;

    const [entities, total] = await this.buildRepo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      take: filters?.limit,
      skip: filters?.offset,
    });

    return { data: entities.map((e) => this.toBuildModel(e)), total };
  }

  async findMatchingBuild(filters: {
    platform: string;
    flavor: string;
    buildMode: string;
    env: string;
    commitId: string;
    bundleId: string;
  }): Promise<BuildTask | undefined> {
    const entity = await this.buildRepo.findOne({
      where: {
        status: 'success',
        platform: filters.platform,
        flavor: filters.flavor,
        buildMode: filters.buildMode,
        env: filters.env,
        commitId: filters.commitId,
        bundleId: filters.bundleId,
      },
      order: { createdAt: 'DESC' },
    });

    if (entity && entity.artifacts && (entity.artifacts.ipa || entity.artifacts.apk)) {
      return this.toBuildModel(entity);
    }
    return undefined;
  }

  async deleteBuild(id: string): Promise<boolean> {
    const result = await this.buildRepo.delete(id);
    if (result.affected && result.affected > 0) {
      this.logger.log(`Deleted build task: ${id}`);
      return true;
    }
    return false;
  }

  // ==================== Publish Records ====================

  createPublish(record: PublishRecord): void {
    this.publishRepo.save(this.toPublishEntity(record)).catch((err) => {
      this.logger.error(`Failed to save publish record: ${err.message}`);
    });
    this.logger.log(`Created publish record: ${record.id} for build: ${record.buildId}`);
  }

  async getPublishes(buildId: string): Promise<PublishRecord[]> {
    const entities = await this.publishRepo.find({
      where: { buildId },
      order: { publishedAt: 'DESC' },
    });
    return entities.map((e) => this.toPublishModel(e));
  }

  async getPublishById(id: string): Promise<PublishRecord | undefined> {
    const entity = await this.publishRepo.findOneBy({ id });
    return entity ? this.toPublishModel(entity) : undefined;
  }

  async updatePublish(id: string, updates: Partial<PublishRecord>): Promise<void> {
    await this.publishRepo.update(id, this.toPublishEntity(updates));
    this.logger.log(`Updated publish record: ${id}`);
  }

  async listAllPublishes(filters?: {
    platform?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ data: PublishRecord[]; total: number }> {
    const where: FindOptionsWhere<PublishRecordEntity> = {};
    if (filters?.platform) where.platform = filters.platform;
    if (filters?.status) where.status = filters.status;

    const [entities, total] = await this.publishRepo.findAndCount({
      where,
      order: { publishedAt: 'DESC' },
      take: filters?.limit,
      skip: filters?.offset,
    });

    return { data: entities.map((e) => this.toPublishModel(e)), total };
  }

  // ==================== Option Groups ====================

  private async initializeOptionDefaults(): Promise<void> {
    const count = await this.optionGroupRepo.count();
    if (count > 0) {
      this.logger.log(`Option groups already initialized (${count} rows)`);
      return;
    }

    const now = new Date();
    const defaults: BuildOptionGroup[] = [
      {
        id: uuidv4(), key: 'platform', label: '平台',
        values: [{ value: 'ios', label: 'iOS' }, { value: 'android', label: 'Android' }],
        required: true, isStandard: true, createdAt: now, updatedAt: now,
      },
      {
        id: uuidv4(), key: 'flavor', label: '渠道',
        values: [{ value: 'oversea', label: 'Oversea (海外)' }, { value: 'cn', label: 'CN (国内)' }],
        required: true, isStandard: true, createdAt: now, updatedAt: now,
      },
      {
        id: uuidv4(), key: 'buildMode', label: '构建类型',
        values: [
          { value: 'debug', label: 'Debug' },
          { value: 'profile', label: 'Profile' },
          { value: 'release', label: 'Release' },
        ],
        required: true, isStandard: true, createdAt: now, updatedAt: now,
      },
      {
        id: uuidv4(), key: 'env', label: '环境',
        values: [
          { value: 'dev', label: 'Development (开发)' },
          { value: 'pre', label: 'Pre-production (预发布)' },
          { value: 'prod', label: 'Production (生产)' },
        ],
        required: true, isStandard: true, createdAt: now, updatedAt: now,
      },
      {
        id: uuidv4(), key: 'language', label: '语言',
        values: [{ value: 'zh', label: '中文' }, { value: 'en', label: 'English' }],
        required: false, isStandard: true, createdAt: now, updatedAt: now,
      },
      {
        id: uuidv4(), key: 'region', label: '地区',
        values: [{ value: 'CN', label: '中国' }, { value: 'US', label: '美国' }],
        required: false, isStandard: true, createdAt: now, updatedAt: now,
      },
      {
        id: uuidv4(), key: 'pgyerAccountType', label: '蒲公英账号',
        values: [
          { value: 'none', label: '不上传' },
          { value: 'lupeilong', label: 'LuPeiLong' },
          { value: 'allenli', label: 'AllenLi' },
          { value: 'alanwu', label: 'AlanWu' },
          { value: 'lb', label: 'LB' },
          { value: 'jianguo', label: 'JianGuo' },
        ],
        required: false, isStandard: true, createdAt: now, updatedAt: now,
      },
    ];

    const entities = defaults.map((g) => this.toOptionGroupEntity(g));
    await this.optionGroupRepo.save(entities);
    this.logger.log(`Initialized ${entities.length} default option groups`);
  }

  async listOptionGroups(): Promise<BuildOptionGroup[]> {
    const entities = await this.optionGroupRepo.find({ order: { createdAt: 'ASC' } });
    return entities.map((e) => this.toOptionGroupModel(e));
  }

  async getOptionGroup(id: string): Promise<BuildOptionGroup | undefined> {
    const entity = await this.optionGroupRepo.findOneBy({ id });
    return entity ? this.toOptionGroupModel(entity) : undefined;
  }

  async getOptionGroupByKey(key: string): Promise<BuildOptionGroup | undefined> {
    const entity = await this.optionGroupRepo.findOneBy({ key });
    return entity ? this.toOptionGroupModel(entity) : undefined;
  }

  async createOptionGroup(data: {
    key: string;
    label: string;
    values?: BuildOptionValue[];
    required?: boolean;
  }): Promise<BuildOptionGroup> {
    const existing = await this.getOptionGroupByKey(data.key);
    if (existing) {
      throw new BadRequestException(`Option group key "${data.key}" already exists`);
    }

    const group: BuildOptionGroup = {
      id: uuidv4(),
      key: data.key,
      label: data.label,
      values: data.values || [],
      required: data.required ?? false,
      isStandard: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await this.optionGroupRepo.save(this.toOptionGroupEntity(group));
    this.logger.log(`Created option group: ${group.key}`);
    return group;
  }

  async updateOptionGroup(
    id: string,
    updates: Partial<Pick<BuildOptionGroup, 'label' | 'values' | 'required'>>,
  ): Promise<BuildOptionGroup | undefined> {
    const entity = await this.optionGroupRepo.findOneBy({ id });
    if (!entity) return undefined;

    if (updates.label !== undefined) entity.label = updates.label;
    if (updates.values !== undefined) entity.values = updates.values;
    if (updates.required !== undefined) entity.required = updates.required;
    entity.updatedAt = new Date();

    await this.optionGroupRepo.save(entity);
    this.logger.log(`Updated option group: ${entity.key}`);
    return this.toOptionGroupModel(entity);
  }

  async deleteOptionGroup(id: string): Promise<boolean> {
    const entity = await this.optionGroupRepo.findOneBy({ id });
    if (!entity) return false;
    if (entity.isStandard) {
      throw new BadRequestException('Cannot delete standard option group');
    }
    await this.optionGroupRepo.delete(id);
    this.logger.log(`Deleted option group: ${entity.key}`);
    return true;
  }

  async addOptionValue(groupId: string, value: BuildOptionValue): Promise<BuildOptionGroup | undefined> {
    const entity = await this.optionGroupRepo.findOneBy({ id: groupId });
    if (!entity) return undefined;

    if (entity.values.some((v) => v.value === value.value)) {
      throw new BadRequestException(`Value "${value.value}" already exists in group "${entity.key}"`);
    }

    entity.values.push(value);
    entity.updatedAt = new Date();
    await this.optionGroupRepo.save(entity);
    this.logger.log(`Added value "${value.value}" to group "${entity.key}"`);
    return this.toOptionGroupModel(entity);
  }

  async removeOptionValue(groupId: string, value: string): Promise<BuildOptionGroup | undefined> {
    const entity = await this.optionGroupRepo.findOneBy({ id: groupId });
    if (!entity) return undefined;

    entity.values = entity.values.filter((v) => v.value !== value);
    entity.updatedAt = new Date();
    await this.optionGroupRepo.save(entity);
    this.logger.log(`Removed value "${value}" from group "${entity.key}"`);
    return this.toOptionGroupModel(entity);
  }

  // ==================== Publishing Credentials ====================

  async listPublishingCredentials(): Promise<PublishingCredential[]> {
    const entities = await this.credentialRepo.find();
    return entities.map((e) => this.toCredentialModel(e));
  }

  async getPublishingCredential(platform: string): Promise<PublishingCredential | undefined> {
    const entity = await this.credentialRepo.findOneBy({ platform });
    return entity ? this.toCredentialModel(entity) : undefined;
  }

  async savePublishingCredential(platform: string, credentials: Record<string, string>): Promise<PublishingCredential> {
    const existing = await this.credentialRepo.findOneBy({ platform });
    const merged = existing?.credentials ? { ...existing.credentials } : {};

    for (const [key, value] of Object.entries(credentials)) {
      if (value !== undefined && value !== '') {
        merged[key] = value;
      }
    }

    const record: PublishingCredential = {
      platform,
      enabled: existing?.enabled ?? true,
      credentials: merged,
      updatedAt: new Date(),
    };

    await this.credentialRepo.save(this.toCredentialEntity(record));
    this.logger.log(`Saved publishing credential for platform: ${platform}`);
    return record;
  }

  async deletePublishingCredential(platform: string): Promise<boolean> {
    const result = await this.credentialRepo.delete(platform);
    if (result.affected && result.affected > 0) {
      this.logger.log(`Deleted publishing credential for platform: ${platform}`);
      return true;
    }
    return false;
  }

  async togglePublishingPlatform(platform: string, enabled: boolean): Promise<PublishingCredential | undefined> {
    const entity = await this.credentialRepo.findOneBy({ platform });
    if (!entity) return undefined;

    entity.enabled = enabled;
    entity.updatedAt = new Date();
    await this.credentialRepo.save(entity);
    this.logger.log(`Toggled platform ${platform} to ${enabled ? 'enabled' : 'disabled'}`);
    return this.toCredentialModel(entity);
  }

  // ==================== Statistics ====================

  async getStats() {
    const total = await this.buildRepo.count();
    const success = await this.buildRepo.count({ where: { status: 'success' } });
    const running = await this.buildRepo.count({ where: { status: 'running' } });

    const successRate = total > 0 ? (success / total) * 100 : 0;

    const successBuilds = await this.buildRepo.find({
      where: { status: 'success' },
      select: ['duration'],
    });
    const durations = successBuilds.filter((b) => b.duration != null).map((b) => b.duration);
    const avgDuration = durations.length > 0
      ? durations.reduce((sum, d) => sum + d, 0) / durations.length
      : 0;

    return {
      totalBuilds: total,
      successRate: parseFloat(successRate.toFixed(2)),
      runningBuilds: running,
      avgDuration: Math.round(avgDuration),
    };
  }

  // ==================== Entity ↔ Model mappers ====================

  private toBuildEntity(task: Partial<BuildTask>): any {
    const entity: any = {};
    if (task.id !== undefined) entity.id = task.id;
    if (task.platform !== undefined) entity.platform = task.platform;
    if (task.flavor !== undefined) entity.flavor = task.flavor;
    if (task.buildMode !== undefined) entity.buildMode = task.buildMode;
    if (task.env !== undefined) entity.env = task.env;
    if (task.branch !== undefined) entity.branch = task.branch;
    if (task.language !== undefined) entity.language = task.language;
    if (task.region !== undefined) entity.region = task.region;
    if (task.pgyerAccountType !== undefined) entity.pgyerAccountType = task.pgyerAccountType;
    if (task.customParams !== undefined) entity.customParams = task.customParams;
    if (task.publishTargets !== undefined) entity.publishTargets = task.publishTargets;
    if (task.commitId !== undefined) entity.commitId = task.commitId;
    if (task.bundleId !== undefined) entity.bundleId = task.bundleId;
    if (task.status !== undefined) entity.status = task.status;
    if (task.artifacts !== undefined) entity.artifacts = task.artifacts;
    if (task.logFile !== undefined) entity.logFile = task.logFile;
    if (task.error !== undefined) entity.error = task.error;
    if (task.createdAt !== undefined) entity.createdAt = task.createdAt;
    if (task.startedAt !== undefined) entity.startedAt = task.startedAt;
    if (task.completedAt !== undefined) entity.completedAt = task.completedAt;
    if (task.duration !== undefined) entity.duration = task.duration;
    return entity;
  }

  private toBuildModel(entity: BuildTaskEntity): BuildTask {
    return {
      id: entity.id,
      platform: entity.platform,
      flavor: entity.flavor,
      buildMode: entity.buildMode,
      env: entity.env,
      branch: entity.branch,
      language: entity.language,
      region: entity.region,
      pgyerAccountType: entity.pgyerAccountType,
      customParams: entity.customParams,
      publishTargets: entity.publishTargets,
      commitId: entity.commitId,
      bundleId: entity.bundleId,
      status: entity.status as BuildTask['status'],
      artifacts: entity.artifacts,
      logFile: entity.logFile,
      error: entity.error,
      createdAt: entity.createdAt,
      startedAt: entity.startedAt,
      completedAt: entity.completedAt,
      duration: entity.duration,
    };
  }

  private toPublishEntity(record: Partial<PublishRecord>): any {
    const entity: any = {};
    if (record.id !== undefined) entity.id = record.id;
    if (record.buildId !== undefined) entity.buildId = record.buildId;
    if (record.platform !== undefined) entity.platform = record.platform;
    if (record.status !== undefined) entity.status = record.status;
    if (record.downloadUrl !== undefined) entity.downloadUrl = record.downloadUrl;
    if (record.reviewUrl !== undefined) entity.reviewUrl = record.reviewUrl;
    if (record.error !== undefined) entity.error = record.error;
    if (record.publishedAt !== undefined) entity.publishedAt = record.publishedAt;
    return entity;
  }

  private toPublishModel(entity: PublishRecordEntity): PublishRecord {
    return {
      id: entity.id,
      buildId: entity.buildId,
      platform: entity.platform,
      status: entity.status as PublishRecord['status'],
      downloadUrl: entity.downloadUrl,
      reviewUrl: entity.reviewUrl,
      error: entity.error,
      publishedAt: entity.publishedAt,
    };
  }

  private toOptionGroupEntity(group: BuildOptionGroup): BuildOptionGroupEntity {
    return {
      id: group.id,
      key: group.key,
      label: group.label,
      values: group.values,
      required: group.required,
      isStandard: group.isStandard,
      createdAt: group.createdAt,
      updatedAt: group.updatedAt,
    };
  }

  private toOptionGroupModel(entity: BuildOptionGroupEntity): BuildOptionGroup {
    return {
      id: entity.id,
      key: entity.key,
      label: entity.label,
      values: entity.values,
      required: entity.required,
      isStandard: entity.isStandard,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }

  private toCredentialEntity(cred: PublishingCredential): PublishingCredentialEntity {
    return {
      platform: cred.platform,
      enabled: cred.enabled,
      credentials: cred.credentials,
      updatedAt: cred.updatedAt,
    };
  }

  private toCredentialModel(entity: PublishingCredentialEntity): PublishingCredential {
    return {
      platform: entity.platform,
      enabled: entity.enabled,
      credentials: entity.credentials,
      updatedAt: entity.updatedAt,
    };
  }
}
