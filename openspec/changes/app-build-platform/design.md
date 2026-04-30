# Design - App Build Platform

## 设计概述

本文档描述 App Build Platform 的详细设计，包括功能设计、界面设计、API 设计和数据模型设计。

---

## 功能设计

### Phase 1: 核心功能

#### 1. 用户认证

**功能描述**:
- 简化的登录系统，使用硬编码的管理员账号

**用户故事**:
```
作为用户，我希望能够登录系统，以便访问构建和发布功能。
```

**功能规格**:
- 登录页面，输入用户名和密码
- 硬编码账号: `admin` / `snapmaker@2016`
- 登录成功后生成 JWT token
- Token 有效期 24 小时
- Token 存储在 localStorage
- 自动登录（token 未过期时）
- 登出功能

**验收标准**:
- ✅ 使用正确账号密码可以登录
- ✅ 使用错误账号密码显示错误提示
- ✅ 登录后跳转到仪表盘
- ✅ Token 过期后自动跳转到登录页
- ✅ 登出后清除 token

---

#### 2. 构建任务管理

**功能描述**:
- 创建、查看、管理构建任务

**用户故事**:
```
作为产品经理，我希望能够通过 Web 界面创建构建任务，
选择平台（iOS/Android）、环境（dev/pre/prod）、渠道（oversea/cn），
然后一键触发构建，无需手动执行脚本。
```

**功能规格**:

##### 2.1 创建构建任务

**表单字段**:
- **平台** (platform): iOS / Android（单选）
- **渠道** (flavor): oversea / cn（单选）
- **环境** (env): dev / pre / prod（单选）
- **构建类型** (buildMode): debug / release（单选）
- **分支** (branch): 文本输入，默认 `main`
- **语言** (language): zh / en（可选，默认 zh）
- **地区** (region): CN / US（可选，默认 CN）

**表单验证**:
- 所有必填字段不能为空
- 分支名称格式验证

**提交行为**:
- 点击"开始构建"按钮
- 显示加载状态
- 成功后跳转到任务详情页
- 失败显示错误提示

##### 2.2 构建任务列表

**列表字段**:
| 字段 | 说明 | 示例 |
|------|------|------|
| ID | 任务 ID（前 8 位） | `a1b2c3d4` |
| 平台 | iOS / Android | `iOS` |
| 渠道 | oversea / cn | `oversea` |
| 环境 | dev / pre / prod | `prod` |
| 状态 | pending / running / success / failed | `running` |
| 创建时间 | 时间戳 | `2026-04-29 10:30:00` |
| 耗时 | 构建时长 | `15m 32s` |
| 操作 | 查看详情 / 下载产物 | 按钮 |

**状态标识**:
- `pending`: 灰色，等待中
- `running`: 蓝色，进行中（带动画）
- `success`: 绿色，成功
- `failed`: 红色，失败

**列表功能**:
- 分页（每页 20 条）
- 按状态筛选
- 按平台筛选
- 按时间排序（默认最新在前）
- 刷新按钮
- 自动刷新（30 秒）

##### 2.3 构建任务详情

**详情页布局**:
```
┌─────────────────────────────────────────────────────────┐
│  任务详情                                    [下载产物]   │
├─────────────────────────────────────────────────────────┤
│  基本信息                                                │
│  • 任务 ID: a1b2c3d4-e5f6-7890-abcd-ef1234567890        │
│  • 平台: iOS                                             │
│  • 渠道: oversea                                         │
│  • 环境: prod                                            │
│  • 构建类型: release                                     │
│  • 分支: main                                            │
│  • 状态: 成功 ✓                                          │
│  • 创建时间: 2026-04-29 10:30:00                        │
│  • 开始时间: 2026-04-29 10:30:05                        │
│  • 完成时间: 2026-04-29 10:45:37                        │
│  • 耗时: 15m 32s                                         │
├─────────────────────────────────────────────────────────┤
│  构建产物                                                │
│  • iOS: Runner.ipa (125.3 MB) [下载]                    │
├─────────────────────────────────────────────────────────┤
│  构建日志                                    [下载日志]   │
│  ┌───────────────────────────────────────────────────┐ │
│  │ [2026-04-29 10:30:05] Starting build...          │ │
│  │ [2026-04-29 10:30:06] Cloning repository...      │ │
│  │ [2026-04-29 10:30:10] Checking out branch main   │ │
│  │ [2026-04-29 10:30:12] Running flutter pub get... │ │
│  │ [2026-04-29 10:32:45] Building iOS app...        │ │
│  │ ...                                               │ │
│  │ [2026-04-29 10:45:35] Build succeeded!           │ │
│  └───────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

**日志查看器功能**:
- 实时滚动（构建进行中）
- 自动滚动到底部
- 手动滚动时暂停自动滚动
- 搜索功能（Ctrl+F）
- 下载完整日志
- 日志高亮（错误行标红）

---

#### 3. 发布管理

**功能描述**:
- 构建完成后自动发布到各平台
- 查看发布状态和历史

**用户故事**:
```
作为测试人员，我希望构建完成后能自动上传到蒲公英和各大应用商店，
并能查看每个平台的发布状态，无需手动上传。
```

**功能规格**:

##### 3.1 发布状态看板

**看板布局**:
```
┌─────────────────────────────────────────────────────────┐
│  发布状态 - 任务 #a1b2c3d4                               │
├─────────────────────────────────────────────────────────┤
│  iOS 平台                                                │
│  ┌─────────────┐  ┌─────────────┐                      │
│  │  蒲公英      │  │ App Store   │                      │
│  │  ✓ 已发布   │  │  ⏳ 审核中  │                      │
│  │  下载链接    │  │  提交时间    │                      │
│  └─────────────┘  └─────────────┘                      │
├─────────────────────────────────────────────────────────┤
│  Android 平台                                            │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐         │
│  │ 蒲公英│ │ 小米 │ │ 华为 │ │ VIVO │ │ OPPO │         │
│  │ ✓    │ │ ✓    │ │ ⏳   │ │ ✓    │ │ ✗    │         │
│  └──────┘ └──────┘ └──────┘ └──────┘ └──────┘         │
│  ┌──────┐                                               │
│  │ 应用宝│                                               │
│  │ ✓    │                                               │
│  └──────┘                                               │
└─────────────────────────────────────────────────────────┘
```

**状态图标**:
- ✓ (绿色): 发布成功
- ⏳ (蓝色): 进行中（上传中/审核中）
- ✗ (红色): 发布失败
- ⊘ (灰色): 未发布

**卡片信息**:
- 平台名称
- 状态
- 下载链接（成功时）
- 错误信息（失败时）
- 审核状态（审核中时）

##### 3.2 发布历史

**列表字段**:
| 字段 | 说明 |
|------|------|
| 构建任务 | 关联的构建任务 ID |
| 平台 | 发布平台名称 |
| 状态 | 成功/失败/审核中 |
| 下载链接 | 成功时的下载地址 |
| 发布时间 | 时间戳 |
| 错误信息 | 失败原因 |

**筛选功能**:
- 按平台筛选
- 按状态筛选
- 按时间范围筛选

---

#### 4. 仪表盘

**功能描述**:
- 系统概览和关键指标

**仪表盘布局**:
```
┌─────────────────────────────────────────────────────────┐
│  仪表盘                                                  │
├─────────────────────────────────────────────────────────┤
│  统计卡片                                                │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │
│  │ 总构建数 │ │ 成功率   │ │ 进行中   │ │ 平均耗时 │  │
│  │   156    │ │  94.2%   │ │    3     │ │  18m     │  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘  │
├─────────────────────────────────────────────────────────┤
│  最近构建                                                │
│  ┌───────────────────────────────────────────────────┐ │
│  │ ID       平台  环境  状态    时间                  │ │
│  │ a1b2c3d4 iOS   prod  成功    2026-04-29 10:45    │ │
│  │ e5f67890 Android dev 进行中  2026-04-29 11:20    │ │
│  │ ...                                               │ │
│  └───────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

**统计指标**:
- 总构建数（全部时间）
- 构建成功率（最近 30 天）
- 当前进行中的任务数
- 平均构建耗时（最近 30 天）

**最近构建**:
- 显示最近 10 条构建记录
- 点击跳转到详情页

---

### Phase 2: 高级功能

#### 5. 用户管理

**功能描述**:
- 多用户支持
- 角色和权限管理

**角色定义**:
- **管理员** (Admin): 所有权限
- **开发** (Developer): 创建构建、查看日志、下载产物
- **测试** (Tester): 创建 dev/pre 构建、查看日志
- **产品** (Product): 查看构建状态和发布状态

**用户管理页面**:
- 用户列表（用户名、角色、创建时间）
- 添加用户
- 编辑用户（修改角色）
- 删除用户
- 重置密码

---

#### 6. 配置管理

**功能描述**:
- 管理系统配置和 API 凭证

**配置项**:
- Git 仓库地址
- SSH 配置
- 各平台 API 凭证（加密存储）
- 通知配置（钉钉、企业微信）

**凭证管理**:
- 凭证列表（名称、类型、创建时间）
- 添加凭证（加密存储）
- 更新凭证
- 删除凭证
- 测试凭证（验证是否有效）

---

#### 7. 通知系统

**功能描述**:
- 构建完成通知
- 发布状态通知

**通知渠道**:
- 钉钉机器人
- 企业微信机器人
- 邮件

**通知内容**:
```
【构建完成】
任务 ID: a1b2c3d4
平台: iOS
环境: prod
状态: 成功 ✓
耗时: 15m 32s
产物: Runner.ipa (125.3 MB)
查看详情: http://build.example.com/tasks/a1b2c3d4
```

---

## 界面设计

### 布局结构

```
┌─────────────────────────────────────────────────────────┐
│  Header                                                  │
│  [Logo] App Build Platform          [用户] [登出]       │
├──────┬──────────────────────────────────────────────────┤
│      │                                                   │
│ Side │  Content Area                                    │
│ bar  │                                                   │
│      │                                                   │
│ 仪表盘│                                                   │
│ 构建  │                                                   │
│ 发布  │                                                   │
│ 配置  │                                                   │
│      │                                                   │
└──────┴──────────────────────────────────────────────────┘
```

### 主题和样式

**颜色方案**:
- 主色: `#1890ff` (Ant Design 蓝)
- 成功: `#52c41a` (绿)
- 警告: `#faad14` (橙)
- 错误: `#f5222d` (红)
- 文本: `#262626` (深灰)
- 背景: `#f0f2f5` (浅灰)

**字体**:
- 中文: `-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB'`
- 英文: `'Roboto', 'Helvetica Neue', Arial`
- 代码: `'Fira Code', 'Consolas', 'Monaco', monospace`

---

## API 设计

### RESTful API

**Base URL**: `/api`

#### 认证 API

```
POST /auth/login
Request:
{
  "username": "admin",
  "password": "snapmaker@2016"
}

Response:
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expires_in": 86400
}
```

#### 构建任务 API

```
# 创建构建任务
POST /builds
Request:
{
  "platform": "ios",
  "flavor": "oversea",
  "env": "prod",
  "buildMode": "release",
  "branch": "main",
  "language": "zh",
  "region": "CN"
}

Response:
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "status": "pending",
  "createdAt": "2026-04-29T10:30:00Z"
}

# 获取任务列表
GET /builds?page=1&limit=20&status=success&platform=ios

Response:
{
  "data": [
    {
      "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "platform": "ios",
      "flavor": "oversea",
      "env": "prod",
      "status": "success",
      "createdAt": "2026-04-29T10:30:00Z",
      "completedAt": "2026-04-29T10:45:37Z",
      "duration": 937
    }
  ],
  "total": 156,
  "page": 1,
  "limit": 20
}

# 获取任务详情
GET /builds/:id

Response:
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "platform": "ios",
  "flavor": "oversea",
  "env": "prod",
  "buildMode": "release",
  "branch": "main",
  "status": "success",
  "createdAt": "2026-04-29T10:30:00Z",
  "startedAt": "2026-04-29T10:30:05Z",
  "completedAt": "2026-04-29T10:45:37Z",
  "duration": 937,
  "logFile": "/workspace/logs/a1b2c3d4.log",
  "artifacts": {
    "ipa": "/workspace/builds/ios/a1b2c3d4.ipa"
  }
}

# 获取任务日志
GET /builds/:id/logs

Response:
{
  "logs": [
    "[2026-04-29 10:30:05] Starting build...",
    "[2026-04-29 10:30:06] Cloning repository...",
    ...
  ]
}

# 下载构建产物
GET /builds/:id/download
# 支持 ?token=xxx query param 认证（浏览器直接下载）

# 获取构建统计
GET /builds/stats

Response:
{
  "totalBuilds": 156,
  "successRate": 94.2,
  "runningBuilds": 3,
  "avgDuration": 1080
}

# 获取最近构建
GET /builds/recent
```

#### 配置 API

```
# 获取系统配置概览
GET /config

Response:
{
  "git": { "repoUrl": "git@github.com:..." },
  "workspace": { "dir": "/Users/.../workspace" },
  "ssh": { "user": "jgfan" },
  "publishing": { "pgyer": true, "appstore": false, ... }
}

# 获取环境变量配置列表（密钥脱敏）
GET /config/env
```

#### 发布 API

```
# 获取发布状态
GET /publishes/:buildId

Response:
{
  "buildId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "publishes": [
    {
      "platform": "pgyer",
      "status": "success",
      "downloadUrl": "https://www.pgyer.com/xxx",
      "publishedAt": "2026-04-29T10:46:00Z"
    },
    {
      "platform": "appstore",
      "status": "reviewing",
      "publishedAt": "2026-04-29T10:47:00Z"
    }
  ]
}

# 获取发布历史
GET /publishes?page=1&limit=20&platform=xiaomi

Response:
{
  "data": [
    {
      "id": "pub-123",
      "buildId": "a1b2c3d4",
      "platform": "xiaomi",
      "status": "success",
      "downloadUrl": "https://app.mi.com/xxx",
      "publishedAt": "2026-04-29T10:46:00Z"
    }
  ],
  "total": 89,
  "page": 1,
  "limit": 20
}
```

#### 统计 API

```
# 获取仪表盘统计
GET /stats/dashboard

Response:
{
  "totalBuilds": 156,
  "successRate": 94.2,
  "runningBuilds": 3,
  "avgDuration": 1080,
  "recentBuilds": [...]
}
```

### WebSocket API

**连接**: `ws://localhost/builds`

**事件**:

```javascript
// 客户端订阅任务日志
socket.emit('subscribe', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890');

// 服务端推送日志
socket.on('log', (data) => {
  // data: { taskId, log, timestamp }
});

// 服务端推送状态变更
socket.on('status', (data) => {
  // data: { taskId, status, timestamp }
});
```

---

## 数据模型设计

### Phase 1: 内存存储

```typescript
// 构建任务
interface BuildTask {
  id: string;                    // UUID
  platform: 'ios' | 'android';
  flavor: 'oversea' | 'cn';
  buildMode: 'debug' | 'profile' | 'release';
  env: 'dev' | 'pre' | 'prod';
  branch: string;
  language?: string;
  region?: string;
  pgyerAccountType?: string;
  status: 'pending' | 'running' | 'success' | 'failed';
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  duration?: number;             // 秒
  logFile?: string;
  artifacts?: {
    ipa?: string;
    apk?: string;
  };
  error?: string;
}

// 发布记录
interface PublishRecord {
  id: string;
  buildId: string;
  platform: string;              // pgyer, appstore, xiaomi, etc.
  status: 'pending' | 'uploading' | 'success' | 'failed' | 'reviewing';
  downloadUrl?: string;
  error?: string;
  publishedAt?: Date;
}

// 内存存储
class MemoryStorage {
  private builds: Map<string, BuildTask> = new Map();
  private publishes: Map<string, PublishRecord[]> = new Map();
  
  // CRUD 方法
  createBuild(task: BuildTask): void;
  getBuild(id: string): BuildTask | undefined;
  updateBuild(id: string, updates: Partial<BuildTask>): void;
  listBuilds(filters?: any): BuildTask[];
  
  createPublish(record: PublishRecord): void;
  getPublishes(buildId: string): PublishRecord[];
  updatePublish(id: string, updates: Partial<PublishRecord>): void;
}
```

### Phase 2: 数据库模型

```prisma
// schema.prisma

model User {
  id        String   @id @default(uuid())
  username  String   @unique
  password  String   // bcrypt hash
  role      Role     @default(DEVELOPER)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  builds    Build[]
}

enum Role {
  ADMIN
  DEVELOPER
  TESTER
  PRODUCT
}

model Build {
  id          String      @id @default(uuid())
  platform    Platform
  flavor      Flavor
  buildMode   BuildMode
  env         Environment
  branch      String
  language    String?
  region      String?
  status      BuildStatus @default(PENDING)
  createdAt   DateTime    @default(now())
  startedAt   DateTime?
  completedAt DateTime?
  duration    Int?        // 秒
  logFile     String?
  artifacts   Json?       // { ipa?: string, apk?: string }
  error       String?
  
  createdBy   String
  user        User        @relation(fields: [createdBy], references: [id])
  publishes   Publish[]
  
  @@index([status, createdAt])
  @@index([platform, env])
}

enum Platform {
  IOS
  ANDROID
}

enum Flavor {
  OVERSEA
  CN
}

enum BuildMode {
  DEBUG
  RELEASE
}

enum Environment {
  DEV
  PRE
  PROD
}

enum BuildStatus {
  PENDING
  RUNNING
  SUCCESS
  FAILED
}

model Publish {
  id          String        @id @default(uuid())
  buildId     String
  platform    String        // pgyer, appstore, xiaomi, etc.
  status      PublishStatus @default(PENDING)
  downloadUrl String?
  error       String?
  publishedAt DateTime?
  
  build       Build         @relation(fields: [buildId], references: [id])
  
  @@index([buildId])
  @@index([platform, status])
}

enum PublishStatus {
  PENDING
  UPLOADING
  SUCCESS
  FAILED
  REVIEWING
}

model Config {
  id          String   @id @default(uuid())
  key         String   @unique
  value       Json
  description String?
  updatedAt   DateTime @updatedAt
  updatedBy   String
}

model Credential {
  id            String   @id @default(uuid())
  name          String   @unique
  type          String   // ssh, api_key, etc.
  encryptedData String   // AES-256-GCM encrypted
  createdAt     DateTime @default(now())
  createdBy     String
}
```

---

## 错误处理设计

### HTTP 错误码

| 状态码 | 说明 | 示例 |
|--------|------|------|
| 200 | 成功 | 请求成功 |
| 201 | 创建成功 | 创建构建任务成功 |
| 400 | 请求错误 | 参数验证失败 |
| 401 | 未认证 | Token 无效或过期 |
| 403 | 无权限 | 无权限创建生产构建 |
| 404 | 不存在 | 任务不存在 |
| 500 | 服务器错误 | 内部错误 |

### 错误响应格式

```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "errors": [
    {
      "field": "platform",
      "message": "platform must be one of: ios, android"
    }
  ]
}
```

---

## 性能指标

### 目标指标

| 指标 | 目标值 |
|------|--------|
| 构建成功率 | > 95% |
| 平均构建时长 | < 20 分钟 |
| API 响应时间 | < 200ms (P95) |
| 日志推送延迟 | < 1 秒 |
| 并发构建数 | 1 (Phase 1), 3+ (Phase 2) |

---

## 总结

本设计文档详细描述了 App Build Platform 的功能、界面、API 和数据模型设计。

**Phase 1** 专注于核心功能的快速实现，使用简化的认证和内存存储。

**Phase 2** 补齐企业级特性，包括多用户、数据库持久化、高级功能等。

设计遵循简洁、实用、可扩展的原则，确保系统易于开发、部署和维护。
