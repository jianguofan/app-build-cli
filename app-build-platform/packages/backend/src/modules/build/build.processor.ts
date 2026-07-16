import { Processor, Process } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { BuildTask } from '../storage/models';
import { BuildService } from './build.service';
import { BuildGateway } from './build.gateway';
import { ExecutorService } from '../executor/executor.service';
import { WorkspaceService } from '../executor/workspace.service';
import { PublishService } from '../publish/publish.service';
import { StorageService } from '../storage/storage.service';

@Processor('build')
export class BuildProcessor {
  private readonly logger = new Logger(BuildProcessor.name);

  constructor(
    private buildService: BuildService,
    private buildGateway: BuildGateway,
    private executorService: ExecutorService,
    private workspaceService: WorkspaceService,
    private publishService: PublishService,
    private storageService: StorageService,
  ) {}

  @Process('execute')
  async handleBuild(job: Job<BuildTask>) {
    const task = job.data;
    this.logger.log(`Processing build task: ${task.id}`);

    // 初始化日志数组
    this.buildService.initLiveLogs(task.id);

    const logLine = (message: string) => {
      const timestamp = new Date().toISOString();
      const line = `[${timestamp}] ${message}`;
      this.buildService.appendLiveLog(task.id, line);
      this.buildGateway.emitLog(task.id, line);
    };

    let workspace: string | undefined;

    try {
      // 1. 更新状态为 running
      await this.buildService.updateStatus(task.id, 'running');
      this.buildGateway.emitStatusChange(task.id, 'running');
      logLine('Build started');

      // 2. 准备工作空间
      logLine('Preparing workspace...');
      workspace = await this.workspaceService.prepare(task);
      logLine(`Workspace ready: ${workspace}`);

      // 2.5 提取 commitId 和 bundleId，检查构建缓存
      const commitId = await this.workspaceService.getCommitHash(workspace);
      const bundleId = await this.workspaceService.getBundleId(workspace, task.platform);

      // Persist commitId and bundleId to task
      await this.storageService.updateBuild(task.id, { commitId, bundleId });
      logLine(`Commit: ${commitId}, BundleId: ${bundleId}`);

      // 检查是否有可复用的缓存构建（相同 platform/flavor/buildMode/env/commitId/bundleId）
      if (commitId && bundleId) {
        const cachedBuild = await this.storageService.findMatchingBuild({
          platform: task.platform,
          flavor: task.flavor,
          buildMode: task.buildMode,
          env: task.env,
          commitId,
          bundleId,
        });

        if (cachedBuild && cachedBuild.artifacts) {
          const artifactPath = cachedBuild.artifacts.ipa || cachedBuild.artifacts.aab || cachedBuild.artifacts.apk;
          if (artifactPath && await this.executorService.localFileExists(artifactPath)) {
            logLine(`Cache hit! Matching build ${cachedBuild.id} exists, skipping build`);

            const logFile = await this.workspaceService.saveLogs(
              task.id,
              this.buildService.getLiveLogs(task.id) || [],
            );

            await this.buildService.updateStatus(task.id, 'success', {
              artifacts: cachedBuild.artifacts,
              logFile,
            });

            this.buildGateway.emitStatusChange(task.id, 'success');
            logLine('Build skipped (cached artifact reused)');

            logLine('Starting publish process...');
            await this.publishService.publish(task.id, cachedBuild.artifacts, task.pgyerAccountType);
            logLine('Publish tasks created');
            return;
          }
        }
      }

      // 2.6 自动递增 Build Number（13YYMMDDNN 格式），确保每个构建有唯一版本号
      const newBuildNumber = await this.workspaceService.bumpBuildNumber(workspace);
      logLine(`Auto-incremented build number to ${newBuildNumber}`);

      // 3. 执行构建脚本
      logLine('Executing build script...');
      logLine(`Platform: ${task.platform}, Flavor: ${task.flavor}, Env: ${task.env}${task.androidArtifact ? `, Artifact: ${task.androidArtifact}` : ''}`);

      // Map platform to build_app.sh format: ios→ipa, android→apk or appbundle
      const scriptPlatform = task.platform === 'ios' ? 'ipa' : (task.androidArtifact || 'apk');

      const customArgs = task.customParams
        ? Object.entries(task.customParams).map(([k, v]) => `--${k}=${v}`)
        : [];

      await this.executorService.localExecute({
        taskId: task.id,
        workspace,
        script: 'build_app.sh',
        args: [
          `--platform=${scriptPlatform}`,
          `--build_mode=${task.buildMode}`,
          `--flavor=${task.flavor}`,
          `--env=${task.env}`,
          `--language=${task.language || 'en'}`,
          ...(task.region ? [`--region=${task.region}`] : []),
          ...customArgs,
        ],
        onLog: (line) => logLine(line),
      });

      // 4. 收集产物
      logLine('Collecting build artifacts...');
      const artifacts = await this.workspaceService.collectArtifacts(workspace, task);

      if (artifacts.ipa || artifacts.apk || artifacts.aab) {
        logLine(`Artifacts collected: ${JSON.stringify(artifacts)}`);
      } else {
        logLine('Warning: No artifacts found');
      }

      // 5. 保存日志
      const logFile = await this.workspaceService.saveLogs(
        task.id,
        this.buildService.getLiveLogs(task.id) || [],
      );

      // 6. 更新状态为 success
      await this.buildService.updateStatus(task.id, 'success', {
        artifacts,
        logFile,
      });

      this.buildGateway.emitStatusChange(task.id, 'success');
      logLine('Build completed successfully');

      // 7. 触发发布流程
      logLine('Starting publish process...');
      await this.publishService.publish(task.id, artifacts, task.pgyerAccountType);
      logLine('Publish tasks created');

      this.logger.log(`Build task ${task.id} completed successfully`);
    } catch (error: any) {
      // Check if build was cancelled
      const currentTask = await this.buildService.findOne(task.id);
      if (currentTask.status === 'cancelled') {
        logLine('Build was cancelled by user');
        // Save partial logs
        try {
          const logFile = await this.workspaceService.saveLogs(
            task.id,
            this.buildService.getLiveLogs(task.id) || [],
          );
          await this.buildService.updateStatus(task.id, 'cancelled', { logFile });
        } catch (logError: any) {
          // Status already set to 'cancelled' by cancel method
        }
        this.buildGateway.emitStatusChange(task.id, 'cancelled');
        return; // Exit gracefully
      }

      // Handle normal failures
      this.logger.error(`Build task ${task.id} failed: ${error.message}`);

      logLine(`Build failed: ${error.message}`);

      // 保存失败日志
      try {
        const logFile = await this.workspaceService.saveLogs(
          task.id,
          this.buildService.getLiveLogs(task.id) || [],
        );

        await this.buildService.updateStatus(task.id, 'failed', {
          error: error.message,
          logFile,
        });
      } catch (logError: any) {
        await this.buildService.updateStatus(task.id, 'failed', {
          error: error.message,
        });
      }

      this.buildGateway.emitStatusChange(task.id, 'failed');
    } finally {
      // Clean up workspace for cancelled or failed builds
      if (workspace) {
        const finalTask = await this.buildService.findOne(task.id);
        if (finalTask.status === 'cancelled' || finalTask.status === 'failed') {
          try {
            await this.workspaceService.cleanup(workspace);
          } catch (cleanupError: any) {
            this.logger.warn(`Workspace cleanup failed: ${cleanupError.message}`);
          }
        }
      }
      // 清理日志缓存
      this.buildService.clearLiveLogs(task.id);
    }
  }
}
