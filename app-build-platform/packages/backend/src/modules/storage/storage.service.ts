import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { BuildTask, BuildOptionGroup, BuildOptionValue, PublishRecord } from './models';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private builds: Map<string, BuildTask> = new Map();
  private publishes: Map<string, PublishRecord[]> = new Map();
  private optionGroups: Map<string, BuildOptionGroup> = new Map();

  onModuleInit() {
    this.initializeOptionDefaults();
  }

  // ==================== Build Tasks ====================

  createBuild(task: BuildTask): void {
    this.builds.set(task.id, task);
    this.logger.log(`Created build task: ${task.id}`);
  }

  getBuild(id: string): BuildTask | undefined {
    return this.builds.get(id);
  }

  updateBuild(id: string, updates: Partial<BuildTask>): void {
    const task = this.builds.get(id);
    if (task) {
      Object.assign(task, updates);
      this.builds.set(id, task);
      this.logger.log(`Updated build task: ${id}`);
    }
  }

  listBuilds(filters?: {
    status?: string;
    platform?: string;
    limit?: number;
    offset?: number;
  }): { data: BuildTask[]; total: number } {
    let tasks = Array.from(this.builds.values());

    if (filters?.status) {
      tasks = tasks.filter((t) => t.status === filters.status);
    }
    if (filters?.platform) {
      tasks = tasks.filter((t) => t.platform === filters.platform);
    }

    tasks.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const total = tasks.length;

    if (filters?.limit) {
      const offset = filters.offset || 0;
      tasks = tasks.slice(offset, offset + filters.limit);
    }

    return { data: tasks, total };
  }

  deleteBuild(id: string): boolean {
    const deleted = this.builds.delete(id);
    if (deleted) {
      this.logger.log(`Deleted build task: ${id}`);
    }
    return deleted;
  }

  // ==================== Publish Records ====================

  createPublish(record: PublishRecord): void {
    const records = this.publishes.get(record.buildId) || [];
    records.push(record);
    this.publishes.set(record.buildId, records);
    this.logger.log(`Created publish record: ${record.id} for build: ${record.buildId}`);
  }

  getPublishes(buildId: string): PublishRecord[] {
    return this.publishes.get(buildId) || [];
  }

  updatePublish(id: string, updates: Partial<PublishRecord>): void {
    for (const [buildId, records] of this.publishes.entries()) {
      const record = records.find((r) => r.id === id);
      if (record) {
        Object.assign(record, updates);
        this.publishes.set(buildId, records);
        this.logger.log(`Updated publish record: ${id}`);
        return;
      }
    }
  }

  listAllPublishes(filters?: {
    platform?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }): { data: PublishRecord[]; total: number } {
    let records: PublishRecord[] = [];
    for (const publishList of this.publishes.values()) {
      records.push(...publishList);
    }

    if (filters?.platform) {
      records = records.filter((r) => r.platform === filters.platform);
    }
    if (filters?.status) {
      records = records.filter((r) => r.status === filters.status);
    }

    records.sort((a, b) => {
      const timeA = a.publishedAt?.getTime() || 0;
      const timeB = b.publishedAt?.getTime() || 0;
      return timeB - timeA;
    });

    const total = records.length;

    if (filters?.limit) {
      const offset = filters.offset || 0;
      records = records.slice(offset, offset + filters.limit);
    }

    return { data: records, total };
  }

  // ==================== Option Groups ====================

  private initializeOptionDefaults(): void {
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
    defaults.forEach((g) => this.optionGroups.set(g.id, g));
    this.logger.log(`Initialized ${defaults.length} default option groups`);
  }

  listOptionGroups(): BuildOptionGroup[] {
    return Array.from(this.optionGroups.values()).sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
    );
  }

  getOptionGroup(id: string): BuildOptionGroup | undefined {
    return this.optionGroups.get(id);
  }

  getOptionGroupByKey(key: string): BuildOptionGroup | undefined {
    return this.listOptionGroups().find((g) => g.key === key);
  }

  createOptionGroup(data: {
    key: string;
    label: string;
    values?: BuildOptionValue[];
    required?: boolean;
  }): BuildOptionGroup {
    if (this.getOptionGroupByKey(data.key)) {
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

    this.optionGroups.set(group.id, group);
    this.logger.log(`Created option group: ${group.key}`);
    return group;
  }

  updateOptionGroup(
    id: string,
    updates: Partial<Pick<BuildOptionGroup, 'label' | 'values' | 'required'>>,
  ): BuildOptionGroup | undefined {
    const group = this.optionGroups.get(id);
    if (!group) return undefined;

    if (updates.label !== undefined) group.label = updates.label;
    if (updates.values !== undefined) group.values = updates.values;
    if (updates.required !== undefined) group.required = updates.required;
    group.updatedAt = new Date();

    this.optionGroups.set(id, group);
    this.logger.log(`Updated option group: ${group.key}`);
    return group;
  }

  deleteOptionGroup(id: string): boolean {
    const group = this.optionGroups.get(id);
    if (!group) return false;
    if (group.isStandard) {
      throw new BadRequestException('Cannot delete standard option group');
    }
    const deleted = this.optionGroups.delete(id);
    if (deleted) this.logger.log(`Deleted option group: ${group.key}`);
    return deleted;
  }

  addOptionValue(groupId: string, value: BuildOptionValue): BuildOptionGroup | undefined {
    const group = this.optionGroups.get(groupId);
    if (!group) return undefined;

    if (group.values.some((v) => v.value === value.value)) {
      throw new BadRequestException(`Value "${value.value}" already exists in group "${group.key}"`);
    }

    group.values.push(value);
    group.updatedAt = new Date();
    this.optionGroups.set(groupId, group);
    this.logger.log(`Added value "${value.value}" to group "${group.key}"`);
    return group;
  }

  removeOptionValue(groupId: string, value: string): BuildOptionGroup | undefined {
    const group = this.optionGroups.get(groupId);
    if (!group) return undefined;

    group.values = group.values.filter((v) => v.value !== value);
    group.updatedAt = new Date();
    this.optionGroups.set(groupId, group);
    this.logger.log(`Removed value "${value}" from group "${group.key}"`);
    return group;
  }

  // ==================== Statistics ====================

  getStats() {
    const builds = Array.from(this.builds.values());
    const total = builds.length;
    const success = builds.filter((b) => b.status === 'success').length;
    const running = builds.filter((b) => b.status === 'running').length;

    const successRate = total > 0 ? (success / total) * 100 : 0;

    const successBuilds = builds.filter((b) => b.status === 'success' && b.duration);
    const avgDuration =
      successBuilds.length > 0
        ? successBuilds.reduce((sum, b) => sum + (b.duration || 0), 0) / successBuilds.length
        : 0;

    return {
      totalBuilds: total,
      successRate: parseFloat(successRate.toFixed(2)),
      runningBuilds: running,
      avgDuration: Math.round(avgDuration),
    };
  }
}
