import { Injectable, Logger } from '@nestjs/common';
import { NodeSSH } from 'node-ssh';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ExecutorService {
  private readonly logger = new Logger(ExecutorService.name);
  private ssh: NodeSSH;

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
