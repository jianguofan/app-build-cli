import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { v4 as uuidv4 } from 'uuid';
import { StorageService } from '../storage/storage.service';
import { BuildTask } from '../storage/models';
import { CreateBuildDto } from './dto/create-build.dto';
import { ExecutorService } from '../executor/executor.service';

@Injectable()
export class BuildService {
  private readonly logger = new Logger(BuildService.name);
  private readonly liveLogs: Map<string, string[]> = new Map();

  constructor(
    @InjectQueue('build') private buildQueue: Queue,
    private storageService: StorageService,
    private executorService: ExecutorService,
  ) {}

  initLiveLogs(taskId: string): void {
    this.liveLogs.set(taskId, []);
  }

  appendLiveLog(taskId: string, line: string): void {
    const logs = this.liveLogs.get(taskId);
    if (logs) logs.push(line);
  }

  getLiveLogs(taskId: string): string[] | undefined {
    return this.liveLogs.get(taskId);
  }

  clearLiveLogs(taskId: string): void {
    this.liveLogs.delete(taskId);
  }

  async create(createBuildDto: CreateBuildDto): Promise<BuildTask> {
    // Validate against option groups
    const groups = await this.storageService.listOptionGroups();
    const groupMap = new Map(groups.map((g) => [g.key, g]));

    for (const fieldKey of ['platform', 'flavor', 'buildMode', 'env']) {
      const group = groupMap.get(fieldKey);
      if (group && group.values.length > 0) {
        const allowed = group.values.map((v) => v.value);
        if (!allowed.includes(createBuildDto[fieldKey])) {
          throw new BadRequestException(
            `${fieldKey} 必须是以下值之一: ${allowed.join(', ')}`,
          );
        }
      }
    }

    if (createBuildDto.customParams) {
      for (const [key, value] of Object.entries(createBuildDto.customParams)) {
        const group = groupMap.get(key);
        if (!group) {
          throw new BadRequestException(`未知的配置项: ${key}`);
        }
        const allowed = group.values.map((v) => v.value);
        if (group.values.length > 0 && !allowed.includes(value)) {
          throw new BadRequestException(
            `${key} 必须是以下值之一: ${allowed.join(', ')}`,
          );
        }
      }
    }

    const task: BuildTask = {
      id: uuidv4(),
      platform: createBuildDto.platform,
      flavor: createBuildDto.flavor,
      buildMode: createBuildDto.buildMode,
      env: createBuildDto.env,
      androidArtifact: createBuildDto.androidArtifact as 'apk' | 'appbundle' | undefined,
      branch: createBuildDto.branch,
      language: createBuildDto.language,
      region: createBuildDto.region,
      pgyerAccountType: createBuildDto.pgyerAccountType,
      customParams: createBuildDto.customParams,
      publishTargets: createBuildDto.publishTargets,
      status: 'pending',
      createdAt: new Date(),
    };

    // 保存到内存存储
    await this.storageService.createBuild(task);

    // 加入队列
    await this.buildQueue.add('execute', task, {
      jobId: task.id,
      removeOnComplete: false,
      removeOnFail: false,
    });

    this.logger.log(`Created build task: ${task.id}`);

    return task;
  }

  async findAll(filters?: {
    status?: string;
    platform?: string;
    page?: number;
    limit?: number;
  }) {
    const page = filters?.page || 1;
    const limit = filters?.limit || 20;
    const offset = (page - 1) * limit;

    const result = await this.storageService.listBuilds({
      status: filters?.status,
      platform: filters?.platform,
      limit,
      offset,
    });

    return {
      data: result.data,
      total: result.total,
      page,
      limit,
      totalPages: Math.ceil(result.total / limit),
    };
  }

  async findOne(id: string): Promise<BuildTask> {
    const task = await this.storageService.getBuild(id);
    if (!task) {
      throw new NotFoundException(`Build task ${id} not found`);
    }
    return task;
  }

  async updateStatus(
    id: string,
    status: BuildTask['status'],
    updates?: Partial<BuildTask>,
  ): Promise<void> {
    const task = await this.storageService.getBuild(id);
    if (!task) {
      throw new NotFoundException(`Build task ${id} not found`);
    }

    const updateData: Partial<BuildTask> = {
      status,
      ...updates,
    };

    // 根据状态更新时间戳
    if (status === 'running' && !task.startedAt) {
      updateData.startedAt = new Date();
    } else if ((status === 'success' || status === 'failed' || status === 'cancelled') && !task.completedAt) {
      updateData.completedAt = new Date();
      if (task.startedAt) {
        updateData.duration = Math.floor(
          (updateData.completedAt.getTime() - task.startedAt.getTime()) / 1000,
        );
      }
    }

    await this.storageService.updateBuild(id, updateData);
    this.logger.log(`Updated build task ${id} status to ${status}`);
  }

  async rebuild(id: string): Promise<BuildTask> {
    const original = await this.storageService.getBuild(id);
    if (!original) {
      throw new NotFoundException(`Build task ${id} not found`);
    }

    const dto: CreateBuildDto = {
      platform: original.platform,
      flavor: original.flavor,
      buildMode: original.buildMode,
      env: original.env,
      androidArtifact: original.androidArtifact,
      branch: original.branch,
      language: original.language,
      region: original.region,
      pgyerAccountType: original.pgyerAccountType,
      customParams: original.customParams,
      publishTargets: original.publishTargets,
    };

    return this.create(dto);
  }

  async delete(id: string): Promise<void> {
    const task = await this.storageService.getBuild(id);
    if (!task) {
      throw new NotFoundException(`Build task ${id} not found`);
    }

    // 如果任务正在运行，尝试从队列中移除
    if (task.status === 'pending' || task.status === 'running') {
      const job = await this.buildQueue.getJob(id);
      if (job) {
        await job.remove();
        this.logger.log(`Removed job ${id} from queue`);
      }
    }

    await this.storageService.deleteBuild(id);
    this.logger.log(`Deleted build task: ${id}`);
  }

  async cancel(id: string): Promise<void> {
    const task = await this.storageService.getBuild(id);
    if (!task) {
      throw new NotFoundException(`Build task ${id} not found`);
    }

    // Only allow cancellation of pending or running builds
    if (task.status !== 'pending' && task.status !== 'running') {
      throw new BadRequestException(
        `Cannot cancel build with status: ${task.status}`,
      );
    }

    // For pending builds: remove from queue
    if (task.status === 'pending') {
      const job = await this.buildQueue.getJob(id);
      if (job) {
        await job.remove();
        this.logger.log(`Removed pending job ${id} from queue`);
      }
    }

    // For running builds: signal the executor to kill the process
    if (task.status === 'running') {
      const killed = await this.executorService.cancelProcess(id);
      if (!killed) {
        this.logger.warn(
          `Process for build ${id} not found, may have already completed`,
        );
      }
    }

    // Update status to cancelled
    await this.updateStatus(id, 'cancelled');
    this.logger.log(`Cancelled build task: ${id}`);
  }

  async getLogs(id: string): Promise<string[]> {
    const task = await this.storageService.getBuild(id);
    if (!task) {
      throw new NotFoundException(`Build task ${id} not found`);
    }

    // 构建运行中：返回内存中的实时日志
    const liveLogs = this.liveLogs.get(id);
    if (liveLogs && liveLogs.length > 0) {
      return liveLogs;
    }

    // 构建已完成：从文件系统读取
    if (task.logFile) {
      try {
        const logContent = await this.executorService.localExec(`cat ${task.logFile}`);
        return logContent.split('\n').filter(line => line.trim());
      } catch (error: any) {
        this.logger.warn(`Failed to read log file: ${error.message}`);
      }
    }

    // 刚创建还没开始构建的 pending 状态
    return [
      `[${new Date().toISOString()}] Build task ${id} created`,
      `[${new Date().toISOString()}] Platform: ${task.platform}`,
      `[${new Date().toISOString()}] Environment: ${task.env}`,
      `[${new Date().toISOString()}] Status: ${task.status}`,
    ];
  }

  async getStats() {
    return await this.storageService.getStats();
  }

  async getRecentBuilds(limit = 10) {
    return await this.storageService.listBuilds({ limit });
  }
}
