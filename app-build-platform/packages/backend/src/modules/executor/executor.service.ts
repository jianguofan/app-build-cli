import { Injectable, Logger } from '@nestjs/common';
import { NodeSSH } from 'node-ssh';
import { ConfigService } from '@nestjs/config';
import { exec as execCb, spawn, ChildProcess } from 'child_process';
import * as fs from 'fs';

@Injectable()
export class ExecutorService {
  private readonly logger = new Logger(ExecutorService.name);
  private ssh: NodeSSH;
  private readonly processes: Map<string, ChildProcess> = new Map();

  constructor(private configService: ConfigService) {
    this.ssh = new NodeSSH();
  }

  async connect(): Promise<void> {
    const sshUser = this.configService.get<string>('SSH_USER');
    const sshKeyPath = this.configService.get<string>('SSH_KEY_PATH');

    if (!sshUser || !sshKeyPath) {
      throw new Error('SSH_USER and SSH_KEY_PATH must be configured');
    }

    try {
      await this.ssh.connect({
        host: 'localhost',
        port: 22,
        username: sshUser,
        privateKeyPath: sshKeyPath,
      });
      this.logger.log('SSH connection established');
    } catch (error: any) {
      this.logger.error(`SSH connection failed: ${error.message}`);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.ssh.isConnected()) {
      this.ssh.dispose();
      this.logger.log('SSH connection closed');
    }
  }

  // Local process execution (no SSH overhead)
  // Use the system's default shell (SHELL env var), fallback to /bin/zsh then /bin/bash
  private getShell(): string {
    return process.env.SHELL || '/bin/zsh';
  }

  /**
   * Build the environment for spawned build processes.
   *
   * The NestJS process may have been started from a context where RVM is not in
   * PATH (e.g. from an IDE, or nvm took precedence). But RVM env vars (GEM_HOME,
   * MY_RUBY_HOME, rvm_path) are still set. We need to ensure RVM's ruby and gem
   * bin directories are in PATH so that CocoaPods (pod) is found correctly.
   * Without this, Flutter's CocoaPods check runs `pod --version` with system
   * Ruby 2.6 (which has no cocoapods gem) and fails with "broken install".
   */
  private buildSpawnEnv(): NodeJS.ProcessEnv {
    const env: NodeJS.ProcessEnv = { ...process.env, GIT_TERMINAL_PROMPT: '0' };

    // Collect RVM bin directories from existing env vars
    const rvmDirs = new Set<string>();
    if (env.GEM_HOME) {
      rvmDirs.add(`${env.GEM_HOME}/bin`);
    }
    if (env.MY_RUBY_HOME) {
      rvmDirs.add(`${env.MY_RUBY_HOME}/bin`);
    }
    // Also check rvm_path for global gem bin
    if (env.rvm_path) {
      // ruby-3.3.0@global gems (fallback gems)
      const rubyVer = env.MY_RUBY_HOME?.split('/').pop() || '';
      if (rubyVer) {
        rvmDirs.add(`${env.rvm_path}/gems/${rubyVer}@global/bin`);
      }
      rvmDirs.add(`${env.rvm_path}/bin`);
    }

    // Prepend RVM directories to PATH if they aren't already there
    const currentPath = env.PATH || '';
    const missingDirs = [...rvmDirs].filter((dir) => !currentPath.startsWith(dir) && !currentPath.includes(`:${dir}:`) && !currentPath.includes(`:${dir}`));
    if (missingDirs.length > 0) {
      env.PATH = `${missingDirs.join(':')}:${currentPath}`;
    }

    return env;
  }

  async localExec(command: string): Promise<string> {
    return new Promise((resolve, reject) => {
      execCb(command, { shell: this.getShell(), env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } }, (error, stdout, stderr) => {
        if (error) {
          reject(new Error(stderr || error.message));
          return;
        }
        resolve(stdout.trim());
      });
    });
  }

  async localExecute(options: {
    taskId?: string;
    workspace: string;
    script: string;
    args: string[];
    onLog: (line: string) => void;
  }): Promise<{ code: number; stdout: string; stderr: string }> {
    const { taskId, workspace, script, args, onLog } = options;

    const keychainPwd = this.configService.get<string>('KEYCHAIN_PASSWORD') || '';
    if (keychainPwd) {
      try {
        await this.localExec(`security unlock-keychain -p '${keychainPwd}' ~/Library/Keychains/login.keychain-db`);
      } catch {
        this.logger.warn('Failed to unlock keychain');
      }
    }

    // Verify workspace directory and build script exist (use fs directly to avoid shell dependency)
    if (!fs.existsSync(workspace)) {
      throw new Error(`Workspace directory does not exist: ${workspace}`);
    }

    const scriptPath = `${workspace}/${script}`;
    if (!fs.existsSync(scriptPath)) {
      throw new Error(`Build script not found: ${scriptPath}`);
    }

    this.logger.log(`Executing: ${scriptPath} ${args.join(' ')}`);

    return new Promise((resolve, reject) => {
      const child = spawn(scriptPath, args, {
        cwd: workspace,
        shell: this.getShell(),
        env: this.buildSpawnEnv(),
      });

      // Store process reference if taskId provided
      if (taskId) {
        this.processes.set(taskId, child);
        this.logger.log(`Registered process for task ${taskId}`);
      }

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (chunk: Buffer) => {
        const lines = chunk.toString().split('\n');
        lines.forEach((line) => {
          if (line.trim()) {
            stdout += line + '\n';
            onLog(line);
          }
        });
      });

      child.stderr.on('data', (chunk: Buffer) => {
        const lines = chunk.toString().split('\n');
        lines.forEach((line) => {
          if (line.trim()) {
            stderr += line + '\n';
            onLog(`[ERROR] ${line}`);
          }
        });
      });

      child.on('close', (code) => {
        // Clean up process reference
        if (taskId) {
          this.processes.delete(taskId);
          this.logger.log(`Removed process for task ${taskId}`);
        }

        if (code === 0) {
          this.logger.log('Command executed successfully');
          resolve({ code, stdout, stderr });
        } else {
          this.logger.error(`Command failed with code ${code}`);
          reject(new Error(`Build failed with exit code ${code}`));
        }
      });

      child.on('error', (error) => {
        // Clean up process reference on error
        if (taskId) {
          this.processes.delete(taskId);
        }
        this.logger.error(`Command execution error: ${error.message}`);
        reject(error);
      });
    });
  }

  async localFileExists(path: string): Promise<boolean> {
    try {
      await this.localExec(`test -f ${path}`);
      return true;
    } catch {
      return false;
    }
  }

  async localDirectoryExists(path: string): Promise<boolean> {
    try {
      await this.localExec(`test -d ${path}`);
      return true;
    } catch {
      return false;
    }
  }

  async cancelProcess(taskId: string): Promise<boolean> {
    const child = this.processes.get(taskId);
    if (!child) {
      this.logger.warn(`Process for task ${taskId} not found`);
      return false;
    }

    this.logger.log(`Cancelling process for task ${taskId}`);

    // Send SIGTERM for graceful termination
    child.kill('SIGTERM');

    // Escalate to SIGKILL after 5 seconds if process doesn't exit
    const killTimeout = setTimeout(() => {
      if (!child.killed) {
        this.logger.warn(`Process ${taskId} didn't respond to SIGTERM, sending SIGKILL`);
        child.kill('SIGKILL');
      }
    }, 5000);

    // Clear timeout when process exits
    child.once('exit', () => {
      clearTimeout(killTimeout);
      this.processes.delete(taskId);
      this.logger.log(`Process for task ${taskId} terminated`);
    });

    return true;
  }

  // SSH-based execution (kept for backward compatibility)

  async execute(options: {
    workspace: string;
    script: string;
    args: string[];
    onLog: (line: string) => void;
  }): Promise<{ code: number; stdout: string; stderr: string }> {
    const { workspace, script, args, onLog } = options;

    // 确保连接
    if (!this.ssh.isConnected()) {
      await this.connect();
    }

    // Unlock Keychain for iOS codesign, source shell profile
    const keychainPwd = this.configService.get<string>('KEYCHAIN_PASSWORD') || '';
    const unlockKeychain = keychainPwd
      ? `security unlock-keychain -p '${keychainPwd}' ~/Library/Keychains/login.keychain-db 2>/dev/null; `
      : '';
    const command = `${unlockKeychain}source ~/.zshrc 2>/dev/null || source ~/.bashrc 2>/dev/null; cd ${workspace} && ./${script} ${args.join(' ')}`;
    this.logger.log(`Executing command: ${command}`);

    return new Promise((resolve, reject) => {
      let stdout = '';
      let stderr = '';

      this.ssh
        .execCommand(command, {
          onStdout: (chunk) => {
            const lines = chunk.toString().split('\n');
            lines.forEach((line) => {
              if (line.trim()) {
                stdout += line + '\n';
                onLog(line);
              }
            });
          },
          onStderr: (chunk) => {
            const lines = chunk.toString().split('\n');
            lines.forEach((line) => {
              if (line.trim()) {
                stderr += line + '\n';
                onLog(`[ERROR] ${line}`);
              }
            });
          },
        })
        .then((result) => {
          if (result.code === 0) {
            this.logger.log(`Command executed successfully`);
            resolve({ code: result.code, stdout, stderr });
          } else {
            this.logger.error(`Command failed with code ${result.code}`);
            reject(new Error(`Build failed with exit code ${result.code}`));
          }
        })
        .catch((error) => {
          this.logger.error(`Command execution error: ${error.message}`);
          reject(error);
        });
    });
  }

  async exec(command: string): Promise<string> {
    if (!this.ssh.isConnected()) {
      await this.connect();
    }

    const wrappedCmd = `source ~/.zshrc 2>/dev/null || source ~/.bashrc 2>/dev/null; ${command}`;
    const result = await this.ssh.execCommand(wrappedCmd);
    if (result.code !== 0) {
      throw new Error(`Command failed: ${result.stderr}`);
    }
    return result.stdout;
  }

  async fileExists(path: string): Promise<boolean> {
    try {
      await this.exec(`test -f ${path}`);
      return true;
    } catch {
      return false;
    }
  }

  async directoryExists(path: string): Promise<boolean> {
    try {
      await this.exec(`test -d ${path}`);
      return true;
    } catch {
      return false;
    }
  }
}
