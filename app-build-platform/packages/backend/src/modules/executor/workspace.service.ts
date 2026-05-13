import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ExecutorService } from './executor.service';
import { BuildTask } from '../storage/models';
import * as fs from 'fs';
import * as path from 'path';

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

  /**
   * Bump CFBundleVersion for iOS builds by updating pubspec.yaml's build number
   * to the current Unix timestamp, ensuring each upload has a unique version.
   */
  async bumpBuildNumber(workspace: string): Promise<string> {
    const pubspecPath = path.join(workspace, 'pubspec.yaml');

    if (!fs.existsSync(pubspecPath)) {
      this.logger.warn('pubspec.yaml not found, skipping build number bump');
      return '0';
    }

    let content = fs.readFileSync(pubspecPath, 'utf-8');
    const versionRegex = /^(version:\s*\S+\+)(\S+)$/m;
    const match = versionRegex.exec(content);

    if (!match) {
      this.logger.warn('Could not find version line in pubspec.yaml, skipping build number bump');
      return '0';
    }

    const newBuildNumber = String(Math.floor(Date.now() / 1000));
    content = content.replace(versionRegex, `$1${newBuildNumber}`);
    fs.writeFileSync(pubspecPath, content, 'utf-8');
    this.logger.log(`Bumped build number to ${newBuildNumber} in pubspec.yaml`);

    // Regenerate Generated.xcconfig so FLUTTER_BUILD_NUMBER picks up the new value
    await this.exec(`cd ${workspace} && flutter pub get`);
    this.logger.log('Regenerated Flutter xcconfig with new build number');

    return newBuildNumber;
  }

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
        `cp ${signingDir}/key.properties ${this.repoDir}/lava-app/android/key.properties 2>/dev/null || true`,
      );
      await this.exec(
        `cp ${signingDir}/signedkey.jks ${this.repoDir}/lava-app/android/signedkey.jks 2>/dev/null || true`,
      );
      this.logger.log('Restored signing files');
    }

    const projectDir = `${this.repoDir}/lava-app`;
    this.logger.log(`Workspace ready: ${projectDir} (branch: ${task.branch})`);
    return projectDir;
  }

  async collectArtifacts(
    workspace: string,
    task: BuildTask,
  ): Promise<{ ipa?: string; apk?: string }> {
    const artifacts: { ipa?: string; apk?: string } = {};
    const versionSuffix = this.getVersionSuffix(workspace);

    try {
      if (task.platform === 'ios') {
        const ipaPath = `${workspace}/build/ios/ipa/Snapmaker.ipa`;
        if (await this.fileExists(ipaPath)) {
          const destName = `${task.flavor}-${task.buildMode}-${task.env}${versionSuffix}-${task.id.substring(0, 8)}.ipa`;
          const destPath = `${this.baseDir}/builds/ios/${destName}`;
          await this.exec(`mkdir -p ${this.baseDir}/builds/ios`);
          await this.exec(`cp ${ipaPath} ${destPath}`);
          artifacts.ipa = destPath;
          this.logger.log(`Collected iOS artifact: ${destPath}`);
        }
      } else if (task.platform === 'android') {
        const apkPath = `${workspace}/build/app/outputs/flutter-apk/app-${task.flavor}-${task.buildMode}.apk`;
        if (await this.fileExists(apkPath)) {
          const destName = `${task.flavor}-${task.buildMode}-${task.env}${versionSuffix}-${task.id.substring(0, 8)}.apk`;
          const destPath = `${this.baseDir}/builds/android/${destName}`;
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

  private getVersionSuffix(workspace: string): string {
    try {
      const pubspecPath = path.join(workspace, 'pubspec.yaml');
      if (!fs.existsSync(pubspecPath)) return '';
      const content = fs.readFileSync(pubspecPath, 'utf-8');
      const match = content.match(/^version:\s*(\S+)\+(\S+)$/m);
      if (match) {
        return `-v${match[1]}-${match[2]}`;
      }
    } catch { /* ignore */ }
    return '';
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
