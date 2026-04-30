import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ExecutorService } from './executor.service';
import { BuildTask } from '../storage/models';

@Injectable()
export class WorkspaceService {
  private readonly logger = new Logger(WorkspaceService.name);
  private readonly baseDir: string;
  private readonly gitRepoUrl: string;
  private readonly repoDir: string;

  constructor(
    private configService: ConfigService,
    private executorService: ExecutorService,
  ) {
    this.baseDir =
      this.configService.get<string>('WORKSPACE_DIR') || '~/app-build-workspace';
    this.gitRepoUrl = this.configService.get<string>('GIT_REPO_URL') || '';
    this.repoDir = `${this.baseDir}/repo`;
  }

  private exec = (cmd: string) => this.executorService.localExec(cmd);
  private fileExists = (p: string) => this.executorService.localFileExists(p);
  private dirExists = (p: string) => this.executorService.localDirectoryExists(p);

  async prepare(task: BuildTask): Promise<string> {
    if (!this.gitRepoUrl) {
      throw new Error('GIT_REPO_URL is not configured');
    }

    const repoExists = await this.dirExists(this.repoDir);

    if (!repoExists) {
      this.logger.log(`First time setup - cloning repository: ${this.gitRepoUrl}`);
      await this.exec(`mkdir -p ${this.baseDir}`);
      await this.exec(`git clone ${this.gitRepoUrl} ${this.repoDir}`);
    }

    // Fetch latest changes
    this.logger.log('Fetching latest changes...');
    await this.exec(`cd ${this.repoDir} && git fetch --all`);

    // Clean all untracked files and changes, then checkout target branch
    this.logger.log(`Checking out branch: ${task.branch}`);
    await this.exec(`cd ${this.repoDir} && git checkout -- .`);
    await this.exec(`cd ${this.repoDir} && git clean -fdx`);
    await this.exec(`cd ${this.repoDir} && git checkout ${task.branch}`);
    await this.exec(`cd ${this.repoDir} && git reset --hard origin/${task.branch}`);

    // Restore signing files (key.properties + keystore) from persistent storage
    const signingDir = `${this.baseDir}/signing`;
    const signingExists = await this.dirExists(signingDir);
    if (signingExists) {
      await this.exec(
        `cp ${signingDir}/key.properties ${this.repoDir}/android/key.properties 2>/dev/null || true`,
      );
      await this.exec(
        `cp ${signingDir}/signedkey.jks ${this.repoDir}/android/signedkey.jks 2>/dev/null || true`,
      );
      this.logger.log('Restored signing files');
    }

    this.logger.log(`Workspace ready: ${this.repoDir} (branch: ${task.branch})`);
    return this.repoDir;
  }

  async collectArtifacts(
    workspace: string,
    task: BuildTask,
  ): Promise<{ ipa?: string; apk?: string }> {
    const artifacts: { ipa?: string; apk?: string } = {};

    try {
      if (task.platform === 'ios') {
        const ipaPath = `${workspace}/build/ios/ipa/Snapmaker.ipa`;
        if (await this.fileExists(ipaPath)) {
          const destPath = `${this.baseDir}/builds/ios/${task.id}.ipa`;
          await this.exec(`mkdir -p ${this.baseDir}/builds/ios`);
          await this.exec(`cp ${ipaPath} ${destPath}`);
          artifacts.ipa = destPath;
          this.logger.log(`Collected iOS artifact: ${destPath}`);
        }
      } else if (task.platform === 'android') {
        const apkPath = `${workspace}/build/app/outputs/flutter-apk/app-${task.flavor}-${task.buildMode}.apk`;
        if (await this.fileExists(apkPath)) {
          const destPath = `${this.baseDir}/builds/android/${task.id}.apk`;
          await this.exec(`mkdir -p ${this.baseDir}/builds/android`);
          await this.exec(`cp ${apkPath} ${destPath}`);
          artifacts.apk = destPath;
          this.logger.log(`Collected Android artifact: ${destPath}`);
        }
      }

      return artifacts;
    } catch (error: any) {
      this.logger.error(`Failed to collect artifacts: ${error.message}`);
      return artifacts;
    }
  }

  async cleanup(workspace: string): Promise<void> {
    try {
      await this.exec(`cd ${workspace} && git checkout -- .`);
      await this.exec(`cd ${workspace} && git clean -fdx`);
      this.logger.log('Cleaned up working tree (repo kept for reuse)');
    } catch (error: any) {
      this.logger.warn(`Failed to cleanup workspace: ${error.message}`);
    }
  }

  async saveLogs(taskId: string, logs: string[]): Promise<string> {
    const logFile = `${this.baseDir}/logs/${taskId}.log`;

    try {
      await this.exec(`mkdir -p ${this.baseDir}/logs`);
      const logContent = logs.join('\n');
      await this.exec(
        `echo "${logContent.replace(/"/g, '\\"')}" > ${logFile}`,
      );
      this.logger.log(`Saved logs to: ${logFile}`);
      return logFile;
    } catch (error: any) {
      this.logger.error(`Failed to save logs: ${error.message}`);
      throw error;
    }
  }
}
