import { Injectable, Logger } from '@nestjs/common';
import { BuildTask, PublishRecord } from './models';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private builds: Map<string, BuildTask> = new Map();
  private publishes: Map<string, PublishRecord[]> = new Map();

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

    // 应用过滤器
    if (filters?.status) {
      tasks = tasks.filter((t) => t.status === filters.status);
    }
    if (filters?.platform) {
      tasks = tasks.filter((t) => t.platform === filters.platform);
    }

    // 按创建时间倒序排序
    tasks.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const total = tasks.length;

    // 分页
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

    // 应用过滤器
    if (filters?.platform) {
      records = records.filter((r) => r.platform === filters.platform);
    }
    if (filters?.status) {
      records = records.filter((r) => r.status === filters.status);
    }

    // 按发布时间倒序排序
    records.sort((a, b) => {
      const timeA = a.publishedAt?.getTime() || 0;
      const timeB = b.publishedAt?.getTime() || 0;
      return timeB - timeA;
    });

    const total = records.length;

    // 分页
    if (filters?.limit) {
      const offset = filters.offset || 0;
      records = records.slice(offset, offset + filters.limit);
    }

    return { data: records, total };
  }

  // ==================== Statistics ====================

  getStats() {
    const builds = Array.from(this.builds.values());
    const total = builds.length;
    const success = builds.filter((b) => b.status === 'success').length;
    const failed = builds.filter((b) => b.status === 'failed').length;
    const running = builds.filter((b) => b.status === 'running').length;

    const successRate = total > 0 ? (success / total) * 100 : 0;

    // 计算平均构建时长（只统计成功的）
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
