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
   * Persistent build number counter file, stored outside the git repo
   * to survive repo resets. Tracks the last used counter for each date prefix.
   * Format: { "13260623": 3, "13260624": 1 }
   */
  private get counterFile(): string {
    return path.join(this.baseDir, '.build-counter.json');
  }

  private readCounter(): Record<string, number> {
    try {
      if (fs.existsSync(this.counterFile)) {
        return JSON.parse(fs.readFileSync(this.counterFile, 'utf-8'));
      }
    } catch {
      this.logger.warn('Failed to read build counter file, starting fresh');
    }
    return {};
  }

  private writeCounter(counters: Record<string, number>): void {
    fs.writeFileSync(this.counterFile, JSON.stringify(counters, null, 2), 'utf-8');
  }
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

    const currentBuildNumber = match[2];
    const now = new Date();
    const yy = String(now.getFullYear()).slice(-2);
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const datePrefix = `13${yy}${mm}${dd}`;

    // Determine the starting counter from two sources:
    //   a) The current pubspec.yaml build number (from git — may be stale after repo reset)
    //   b) The persistent counter file (survives repo resets, tracks actually-used numbers)
    let counterFromPubspec = -1;
    if (currentBuildNumber.startsWith(datePrefix)) {
      const parsed = parseInt(currentBuildNumber.slice(-2), 10);
      if (!isNaN(parsed)) {
        counterFromPubspec = parsed;
      }
    }

    const counters = this.readCounter();
    const counterFromPersist = counters[datePrefix] ?? -1;

    // Take the max of both sources and increment by 1
    const counter = Math.max(counterFromPubspec, counterFromPersist) + 1;

    // Pad to 2 digits; if we exceed 99 builds in a day, wrap with a warning
    if (counter > 99) {
      this.logger.warn(
        `Build counter for ${datePrefix} exceeded 99 (${counter}). Consider a different versioning scheme.`,
      );
    }
    const nn = String(counter % 100).padStart(2, '0');
    const newBuildNumber = `${datePrefix}${nn}`;

    // Persist the counter so the next build (even after repo reset) won't reuse this number
    counters[datePrefix] = counter;
    this.writeCounter(counters);

    content = content.replace(versionRegex, `$1${newBuildNumber}`);
    fs.writeFileSync(pubspecPath, content, 'utf-8');
    this.logger.log(`Bumped build number from ${currentBuildNumber} to ${newBuildNumber} in pubspec.yaml`);

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
  ): Promise<{ ipa?: string; apk?: string; aab?: string }> {
    const artifacts: { ipa?: string; apk?: string; aab?: string } = {};
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
        if (task.androidArtifact === 'appbundle') {
          const aabPath = `${workspace}/build/app/outputs/bundle/${task.flavor}${task.buildMode === 'release' ? '' : task.buildMode}Release/app-${task.flavor}-${task.buildMode}.aab`;
          // Also try the standard flavor path
          const aabPaths = [
            aabPath,
            `${workspace}/build/app/outputs/bundle/${task.flavor}Release/app-${task.flavor}-release.aab`,
            `${workspace}/build/app/outputs/bundle/release/app-release.aab`,
          ];
          for (const ap of aabPaths) {
            if (await this.fileExists(ap)) {
              const destName = `${task.flavor}-${task.buildMode}-${task.env}${versionSuffix}-${task.id.substring(0, 8)}.aab`;
              const destPath = `${this.baseDir}/builds/android/${destName}`;
              await this.exec(`mkdir -p ${this.baseDir}/builds/android`);
              await this.exec(`cp ${ap} ${destPath}`);
              artifacts.aab = destPath;
              this.logger.log(`Collected Android AAB artifact: ${destPath}`);
              break;
            }
          }
          // Also look for APK as fallback (some build scripts produce both)
          const apkPath = `${workspace}/build/app/outputs/flutter-apk/app-${task.flavor}-${task.buildMode}.apk`;
          if (await this.fileExists(apkPath)) {
            const destName = `${task.flavor}-${task.buildMode}-${task.env}${versionSuffix}-${task.id.substring(0, 8)}.apk`;
            const destPath = `${this.baseDir}/builds/android/${destName}`;
            await this.exec(`mkdir -p ${this.baseDir}/builds/android`);
            await this.exec(`cp ${apkPath} ${destPath}`);
            artifacts.apk = destPath;
            this.logger.log(`Collected Android APK artifact (fallback): ${destPath}`);
          }
        } else {
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

  async getCommitHash(workspace: string): Promise<string> {
    try {
      const hash = await this.exec(`cd ${workspace} && git rev-parse HEAD`);
      return hash.trim();
    } catch (error: any) {
      this.logger.warn(`Failed to get commit hash: ${error.message}`);
      return '';
    }
  }

  async getBundleId(workspace: string, platform: string): Promise<string> {
    try {
      if (platform === 'android') {
        const buildGradlePath = path.join(workspace, 'android', 'app', 'build.gradle');
        if (fs.existsSync(buildGradlePath)) {
          const content = fs.readFileSync(buildGradlePath, 'utf-8');
          const match = content.match(/applicationId\s+["']([^"']+)["']/);
          if (match) return match[1];
        }
      } else if (platform === 'ios') {
        const pbxprojPath = path.join(workspace, 'ios', 'Runner.xcodeproj', 'project.pbxproj');
        if (fs.existsSync(pbxprojPath)) {
          const content = fs.readFileSync(pbxprojPath, 'utf-8');
          const match = content.match(/PRODUCT_BUNDLE_IDENTIFIER\s*=\s*["']?([^"';]+)["']?/);
          if (match) return match[1].trim();
        }
      }
    } catch (error: any) {
      this.logger.warn(`Failed to extract bundleId: ${error.message}`);
    }
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
      const logDir = `${this.baseDir}/logs`;
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }
      fs.writeFileSync(logFile, logs.join('\n'), 'utf-8');
      this.logger.log(`Saved logs to: ${logFile}`);
      return logFile;
    } catch (error: any) {
      this.logger.error(`Failed to save logs: ${error.message}`);
      throw error;
    }
  }
}
