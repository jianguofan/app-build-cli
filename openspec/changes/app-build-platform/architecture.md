# Architecture - App Build Platform

## 系统架构概览

### 整体架构图

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           宿主机 (macOS)                                  │
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    Docker Compose 环境                            │   │
│  │                                                                   │   │
│  │   ┌──────────┐      ┌──────────┐      ┌──────────┐             │   │
│  │   │  Nginx   │─────▶│ Frontend │      │ Backend  │             │   │
│  │   │  :80     │      │  React   │◀────▶│  NestJS  │             │   │
│  │   └──────────┘      └──────────┘      └─────┬────┘             │   │
│  │                                              │                   │   │
│  │                                         ┌────┴────┐              │   │
│  │                                         │  Redis  │              │   │
│  │                                         │ (Queue) │              │   │
│  │                                         └─────────┘              │   │
│  └───────────────────────────────────────────┼───────────────────────┘   │
│                                              │                           │
│                                              │ SSH (localhost:22)        │
│                                              ▼                           │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    构建工作空间                                    │   │
│  │              ~/app-build-workspace/                              │   │
│  │                                                                   │   │
│  │  ├── projects/                  # Git 仓库克隆                    │   │
│  │  │   └── lava-app-{task-id}/                                     │   │
│  │  │                                                                │   │
│  │  ├── builds/                    # 构建产物                        │   │
│  │  │   ├── ios/                                                     │   │
│  │  │   │   └── {task-id}.ipa                                       │   │
│  │  │   └── android/                                                 │   │
│  │  │       └── {task-id}.apk                                       │   │
│  │  │                                                                │   │
│  │  └── logs/                      # 构建日志                        │   │
│  │      └── {task-id}.log                                           │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                           │
│  系统环境 (已安装):                                                        │
│  • Xcode + iOS SDK                                                       │
│  • Android Studio + Android SDK                                          │
│  • Flutter SDK                                                           │
│  • CocoaPods, Gradle                                                     │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Phase 1 架构（无数据库版本）

### 简化架构

```
┌─────────────────────────────────────────────────────────────┐
│                    Docker Compose                            │
│                                                               │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐              │
│  │  Nginx   │───▶│ Frontend │───▶│ Backend  │              │
│  │  :80     │    │  (Vite)  │    │ (NestJS) │              │
│  └──────────┘    └──────────┘    └─────┬────┘              │
│                                         │                    │
│                                    ┌────┴────┐               │
│                                    │  Redis  │               │
│                                    │ (Bull)  │               │
│                                    └─────────┘               │
└─────────────────────────────────────┼───────────────────────┘
                                      │
                                      │ SSH
                                      ▼
                            宿主机构建环境
```

**关键特性**:
- ✅ 无 PostgreSQL 依赖
- ✅ 数据存储在内存中（Map/Object）
- ✅ 硬编码认证（admin/snapmaker@2016）
- ✅ 构建任务通过 Bull + Redis 队列管理
- ✅ 日志和产物存储在宿主机文件系统

---

## 核心组件设计

### 1. Frontend (React + Vite)

**技术栈**:
- React 18 + TypeScript
- Ant Design 5.x (UI 组件库)
- Zustand (轻量状态管理)
- Socket.io-client (实时日志)
- Axios (HTTP 客户端)

**目录结构**:
```
packages/frontend/
├── src/
│   ├── components/          # 可复用组件
│   │   ├── Layout/          # 布局组件
│   │   ├── BuildTaskList/   # 构建任务列表
│   │   ├── LogViewer/       # 日志查看器
│   │   └── PublishStatus/   # 发布状态
│   ├── pages/               # 页面组件
│   │   ├── Login/           # 登录页
│   │   ├── Dashboard/       # 仪表盘
│   │   ├── BuildTasks/      # 构建任务管理
│   │   └── PublishHistory/  # 发布历史
│   ├── stores/              # Zustand stores
│   │   ├── authStore.ts
│   │   ├── buildStore.ts
│   │   └── logStore.ts
│   ├── services/            # API 服务
│   │   ├── api.ts           # Axios 实例
│   │   ├── buildService.ts
│   │   └── socketService.ts
│   └── App.tsx
└── package.json
```

**核心功能模块**:

1. **认证模块** (Phase 1: 简化版)
   - 登录表单（用户名/密码）
   - JWT token 存储（localStorage）
   - 路由守卫

2. **构建任务模块**
   - 创建构建任务表单
   - 任务列表（状态、进度）
   - 实时日志查看器
   - 产物下载

3. **发布管理模块**
   - 发布状态看板
   - 各平台发布进度
   - 发布历史记录

---

### 2. Backend (NestJS)

**技术栈**:
- NestJS + TypeScript
- Bull (任务队列)
- Redis (队列存储)
- Socket.io (WebSocket)
- JWT (认证)
- node-ssh (SSH 连接)

**目录结构**:
```
packages/backend/
├── src/
│   ├── modules/
│   │   ├── auth/                    # 认证模块
│   │   │   ├── auth.controller.ts
│   │   │   ├── auth.service.ts
│   │   │   ├── jwt.strategy.ts
│   │   │   └── auth.guard.ts
│   │   │
│   │   ├── build/                   # 构建模块
│   │   │   ├── build.controller.ts
│   │   │   ├── build.service.ts
│   │   │   ├── build.processor.ts   # Bull 队列处理器
│   │   │   └── build.gateway.ts     # WebSocket 网关
│   │   │
│   │   ├── publish/                 # 发布模块
│   │   │   ├── publish.controller.ts
│   │   │   ├── publish.service.ts
│   │   │   ├── publishers/          # 各平台发布器
│   │   │   │   ├── base.publisher.ts
│   │   │   │   ├── appstore.publisher.ts
│   │   │   │   ├── pgyer.publisher.ts
│   │   │   │   ├── xiaomi.publisher.ts
│   │   │   │   ├── huawei.publisher.ts
│   │   │   │   ├── tencent.publisher.ts
│   │   │   │   ├── vivo.publisher.ts
│   │   │   │   └── oppo.publisher.ts
│   │   │   └── publish.processor.ts
│   │   │
│   │   ├── executor/                # 构建执行器
│   │   │   ├── executor.service.ts  # SSH 执行
│   │   │   ├── workspace.service.ts # 工作空间管理
│   │   │   └── script.service.ts    # 脚本执行
│   │   │
│   │   └── storage/                 # 存储模块 (Phase 1: 内存)
│   │       ├── storage.service.ts   # 内存存储
│   │       └── models.ts            # 数据模型
│   │
│   ├── common/
│   │   ├── decorators/
│   │   ├── filters/
│   │   └── interceptors/
│   │
│   └── main.ts
└── package.json
```

**核心服务设计**:

#### 2.1 认证服务 (AuthService)

**Phase 1 实现**:
```typescript
// 硬编码用户
const ADMIN_USER = {
  username: 'admin',
  password: 'snapmaker@2016', // 实际存储时应该 hash
};

@Injectable()
class AuthService {
  async login(username: string, password: string) {
    if (username === ADMIN_USER.username && 
        password === ADMIN_USER.password) {
      return {
        access_token: this.jwtService.sign({ 
          sub: 'admin', 
          username: 'admin' 
        }),
      };
    }
    throw new UnauthorizedException();
  }
}
```

#### 2.2 构建服务 (BuildService)

**职责**:
- 管理构建任务（CRUD）
- 将任务加入 Bull 队列
- 查询任务状态
- 提供日志流

**数据模型** (Phase 1: 内存存储):
```typescript
interface BuildTask {
  id: string;                    // UUID
  platform: 'ios' | 'android';
  flavor: 'oversea' | 'cn';
  buildMode: 'debug' | 'release';
  env: 'dev' | 'pre' | 'prod';
  branch: string;
  status: 'pending' | 'running' | 'success' | 'failed';
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  logFile?: string;              // 日志文件路径
  artifacts?: {                  // 构建产物
    ipa?: string;
    apk?: string;
  };
  error?: string;
}
```

**API 端点**:
```
POST   /api/builds              # 创建构建任务
GET    /api/builds              # 获取任务列表
GET    /api/builds/:id          # 获取任务详情
GET    /api/builds/:id/logs     # 获取任务日志
DELETE /api/builds/:id          # 取消任务
```

#### 2.3 构建处理器 (BuildProcessor)

**职责**:
- 从 Bull 队列消费任务
- 调用 ExecutorService 执行构建
- 实时推送日志到 WebSocket
- 更新任务状态

**流程**:
```typescript
@Processor('build')
class BuildProcessor {
  @Process('execute')
  async handleBuild(job: Job<BuildTask>) {
    const task = job.data;
    
    try {
      // 1. 更新状态为 running
      await this.buildService.updateStatus(task.id, 'running');
      
      // 2. 准备工作空间
      const workspace = await this.workspaceService.prepare(task);
      
      // 3. 执行构建脚本
      const result = await this.executorService.execute({
        workspace,
        script: 'build_app.sh',
        args: [task.platform, task.flavor, task.buildMode, task.env],
        onLog: (line) => {
          // 实时推送日志
          this.buildGateway.emitLog(task.id, line);
        },
      });
      
      // 4. 收集产物
      const artifacts = await this.workspaceService.collectArtifacts(workspace);
      
      // 5. 更新状态为 success
      await this.buildService.updateStatus(task.id, 'success', {
        artifacts,
      });
      
      // 6. 触发发布流程
      await this.publishService.publish(task.id, artifacts);
      
    } catch (error) {
      await this.buildService.updateStatus(task.id, 'failed', {
        error: error.message,
      });
    }
  }
}
```

#### 2.4 执行器服务 (ExecutorService)

**职责**:
- SSH 连接到宿主机
- 执行 shell 命令
- 流式读取输出

**实现**:
```typescript
@Injectable()
class ExecutorService {
  private ssh: NodeSSH;
  
  async connect() {
    await this.ssh.connect({
      host: 'localhost',
      port: 22,
      username: process.env.SSH_USER,
      privateKey: process.env.SSH_KEY_PATH,
    });
  }
  
  async execute(options: {
    workspace: string;
    script: string;
    args: string[];
    onLog: (line: string) => void;
  }) {
    const { workspace, script, args, onLog } = options;
    
    const command = `cd ${workspace} && ./${script} ${args.join(' ')}`;
    
    return new Promise((resolve, reject) => {
      this.ssh.execCommand(command, {
        onStdout: (chunk) => {
          const lines = chunk.toString().split('\n');
          lines.forEach(line => onLog(line));
        },
        onStderr: (chunk) => {
          const lines = chunk.toString().split('\n');
          lines.forEach(line => onLog(`[ERROR] ${line}`));
        },
      }).then(result => {
        if (result.code === 0) {
          resolve(result);
        } else {
          reject(new Error(`Build failed with code ${result.code}`));
        }
      }).catch(reject);
    });
  }
}
```

#### 2.5 工作空间服务 (WorkspaceService)

**职责**:
- 创建隔离的构建目录
- 克隆 Git 仓库
- 清理旧的工作空间

**实现**:
```typescript
@Injectable()
class WorkspaceService {
  private baseDir = '~/app-build-workspace';
  
  async prepare(task: BuildTask): Promise<string> {
    const workspaceDir = `${this.baseDir}/projects/lava-app-${task.id}`;
    
    // 1. 创建目录
    await this.executorService.exec(`mkdir -p ${workspaceDir}`);
    
    // 2. 克隆仓库
    await this.executorService.exec(
      `git clone ${process.env.GIT_REPO_URL} ${workspaceDir}`
    );
    
    // 3. 切换分支
    await this.executorService.exec(
      `cd ${workspaceDir} && git checkout ${task.branch}`
    );
    
    return workspaceDir;
  }
  
  async collectArtifacts(workspace: string) {
    const artifacts: any = {};
    
    // iOS 产物
    const ipaPath = `${workspace}/build/ios/Runner.ipa`;
    if (await this.fileExists(ipaPath)) {
      const destPath = `${this.baseDir}/builds/ios/${task.id}.ipa`;
      await this.executorService.exec(`cp ${ipaPath} ${destPath}`);
      artifacts.ipa = destPath;
    }
    
    // Android 产物
    const apkPath = `${workspace}/build/app/outputs/flutter-apk/app-release.apk`;
    if (await this.fileExists(apkPath)) {
      const destPath = `${this.baseDir}/builds/android/${task.id}.apk`;
      await this.executorService.exec(`cp ${apkPath} ${destPath}`);
      artifacts.apk = destPath;
    }
    
    return artifacts;
  }
}
```

#### 2.6 发布服务 (PublishService)

**职责**:
- 协调各平台发布
- 管理发布记录
- 追踪发布状态

**发布器抽象**:
```typescript
abstract class BasePublisher {
  abstract platform: string;
  
  abstract async upload(artifact: string, config: any): Promise<{
    success: boolean;
    downloadUrl?: string;
    error?: string;
  }>;
  
  abstract async checkStatus(uploadId: string): Promise<{
    status: 'pending' | 'reviewing' | 'approved' | 'rejected';
    message?: string;
  }>;
}
```

**各平台发布器**:

1. **蒲公英发布器** (PgyerPublisher)
   - 复用现有上传代码
   - API: https://www.pgyer.com/doc/view/api

2. **App Store 发布器** (AppStorePublisher)
   - 使用 App Store Connect API
   - 上传 IPA 到 TestFlight/App Store

3. **小米发布器** (XiaomiPublisher)
   - 小米开放平台 API
   - 上传 APK + 提交审核

4. **华为发布器** (HuaweiPublisher)
   - AppGallery Connect API
   - 上传 APK + 提交审核

5. **腾讯发布器** (TencentPublisher)
   - 应用宝 API
   - 上传 APK + 提交审核

6. **VIVO 发布器** (VivoPublisher)
7. **OPPO 发布器** (OppoPublisher)

---

### 3. 任务队列 (Bull + Redis)

**队列设计**:

```typescript
// 构建队列
const buildQueue = new Queue('build', {
  redis: {
    host: 'redis',
    port: 6379,
  },
  defaultJobOptions: {
    attempts: 1,           // 构建失败不自动重试
    timeout: 1800000,      // 30 分钟超时
    removeOnComplete: 100, // 保留最近 100 个完成任务
    removeOnFail: 100,     // 保留最近 100 个失败任务
  },
});

// 发布队列
const publishQueue = new Queue('publish', {
  redis: {
    host: 'redis',
    port: 6379,
  },
  defaultJobOptions: {
    attempts: 3,           // 发布失败重试 3 次
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
  },
});
```

---

### 4. WebSocket 网关 (BuildGateway)

**职责**:
- 实时推送构建日志
- 推送任务状态变更
- 推送发布进度

**实现**:
```typescript
@WebSocketGateway({ namespace: '/builds' })
class BuildGateway {
  @WebSocketServer()
  server: Server;
  
  emitLog(taskId: string, log: string) {
    this.server.to(`task-${taskId}`).emit('log', {
      taskId,
      log,
      timestamp: new Date(),
    });
  }
  
  emitStatusChange(taskId: string, status: string) {
    this.server.to(`task-${taskId}`).emit('status', {
      taskId,
      status,
      timestamp: new Date(),
    });
  }
  
  @SubscribeMessage('subscribe')
  handleSubscribe(client: Socket, taskId: string) {
    client.join(`task-${taskId}`);
  }
}
```

---

## 数据流

### 构建流程数据流

```
用户操作
   │
   ▼
[Frontend] 创建构建任务
   │
   │ HTTP POST /api/builds
   ▼
[Backend] BuildController.create()
   │
   ▼
[Backend] BuildService.create()
   │
   │ 1. 生成任务 ID
   │ 2. 保存到内存存储
   │ 3. 加入 Bull 队列
   ▼
[Redis] Bull Queue
   │
   ▼
[Backend] BuildProcessor.handleBuild()
   │
   │ 1. 更新状态: running
   │ 2. 准备工作空间
   │ 3. SSH 执行构建
   │ 4. 实时推送日志 (WebSocket)
   │ 5. 收集产物
   │ 6. 更新状态: success/failed
   ▼
[Backend] PublishService.publish()
   │
   │ 并行发布到各平台
   ├─▶ [蒲公英]
   ├─▶ [App Store]
   ├─▶ [小米]
   ├─▶ [华为]
   ├─▶ [VIVO]
   ├─▶ [OPPO]
   └─▶ [应用宝]
   │
   ▼
[Frontend] 显示发布结果
```

### 日志流数据流

```
[宿主机] build_app.sh 执行
   │
   │ stdout/stderr
   ▼
[Backend] ExecutorService (SSH)
   │
   │ 逐行读取
   ▼
[Backend] BuildProcessor
   │
   │ 调用 BuildGateway.emitLog()
   ▼
[Backend] WebSocket Server
   │
   │ Socket.io emit
   ▼
[Frontend] LogViewer 组件
   │
   ▼
用户界面显示
```

---

## 部署架构

### Docker Compose 配置

```yaml
version: '3.8'

services:
  # Nginx 反向代理
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
    depends_on:
      - frontend
      - backend

  # 前端
  frontend:
    build: ./packages/frontend
    environment:
      - VITE_API_URL=http://localhost/api

  # 后端
  backend:
    build: ./packages/backend
    environment:
      - REDIS_HOST=redis
      - REDIS_PORT=6379
      - SSH_USER=${SSH_USER}
      - SSH_KEY_PATH=/root/.ssh/id_rsa
      - GIT_REPO_URL=${GIT_REPO_URL}
    volumes:
      - ~/.ssh:/root/.ssh:ro
      - ~/app-build-workspace:/workspace
    depends_on:
      - redis

  # Redis (任务队列)
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
```

---

## 安全设计

### Phase 1 安全措施

1. **认证**:
   - JWT token 认证
   - Token 过期时间: 24 小时
   - 存储在 localStorage

2. **SSH 连接**:
   - 使用 SSH 密钥认证（不使用密码）
   - 密钥只读挂载到容器

3. **API 安全**:
   - 所有 API 需要 JWT 认证
   - CORS 配置限制来源

4. **文件系统**:
   - 工作空间隔离
   - 构建产物权限控制

### Phase 2 增强安全

1. **数据加密**:
   - API 密钥加密存储
   - 使用 AES-256-GCM

2. **HTTPS**:
   - 生产环境强制 HTTPS
   - Let's Encrypt 证书

3. **审计日志**:
   - 记录所有操作
   - 包含用户、时间、操作类型

---

## 性能优化

### Phase 1 优化

1. **构建性能**:
   - 复用现有 build_app.sh（已优化）
   - 工作空间隔离避免冲突

2. **日志推送**:
   - WebSocket 批量推送（200ms 缓冲）
   - 前端虚拟滚动

3. **队列管理**:
   - 单队列顺序执行（避免资源竞争）
   - 超时机制（30 分钟）

### Phase 2 优化

1. **构建缓存**:
   - Flutter build cache
   - Gradle cache
   - CocoaPods cache

2. **并发构建**:
   - 多队列支持
   - 资源限制

3. **数据库优化**:
   - 索引优化
   - 查询缓存

---

## 监控与日志

### 日志策略

1. **应用日志**:
   - 使用 Winston/Pino
   - 日志级别: debug, info, warn, error
   - 输出到 stdout（Docker 收集）

2. **构建日志**:
   - 存储在宿主机文件系统
   - 路径: `~/app-build-workspace/logs/{task-id}.log`
   - 保留 30 天

3. **访问日志**:
   - Nginx access log
   - 记录所有 HTTP 请求

### 监控指标

1. **系统指标**:
   - CPU、内存使用率
   - 磁盘空间
   - 网络流量

2. **业务指标**:
   - 构建成功率
   - 平均构建时长
   - 队列长度

3. **错误监控**:
   - Phase 2 集成 Sentry
   - 捕获未处理异常

---

## 扩展性设计

### 水平扩展

**Phase 1**: 单机部署，不支持扩展

**Phase 2**: 支持多实例
- 使用 Redis 作为共享状态
- Bull 队列支持多 worker
- 负载均衡（Nginx）

### 垂直扩展

- 增加宿主机资源（CPU、内存）
- 调整 Docker 资源限制
- 优化构建脚本

---

## 故障恢复

### 构建失败处理

1. **脚本执行失败**:
   - 捕获错误信息
   - 更新任务状态为 failed
   - 保留日志供排查

2. **SSH 连接失败**:
   - 重试机制（3 次）
   - 指数退避

3. **超时处理**:
   - 30 分钟超时
   - 自动终止进程
   - 清理工作空间

### 发布失败处理

1. **上传失败**:
   - 重试 3 次
   - 记录错误信息

2. **审核失败**:
   - 记录审核意见
   - 通知用户

### 系统故障恢复

1. **容器重启**:
   - Docker 自动重启策略
   - 队列任务持久化在 Redis

2. **数据恢复**:
   - Phase 1: 重启后数据丢失（内存存储）
   - Phase 2: 数据库持久化

---

## 总结

本架构设计遵循以下原则：

1. **渐进式实现**: Phase 1 简化版 → Phase 2 完整版
2. **容器化**: 所有服务运行在 Docker 中
3. **解耦**: 前后端分离，模块化设计
4. **可扩展**: 支持新增发布平台
5. **可维护**: 清晰的代码结构和文档

Phase 1 专注于核心功能，快速交付可用系统。Phase 2 补齐数据库、用户管理等企业级特性。
