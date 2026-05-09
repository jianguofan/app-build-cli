# 构建发布平台架构规范分析

## 一、职责分离

### 1.1 构建脚本 (build_app.sh) — 只做构建

```
职责边界：源代码 → 编译 → 产物（IPA/APK）
```

| 应该做 | 不应该做 |
|--------|----------|
| `flutter clean && flutter pub get` | 上传 IPA 到 App Store（altool） |
| `flutter build ipa/apk` | 上传 APK 到蒲公英（curl） |
| 上传 Firebase Crashlytics dSYM | 管理 API Key / 账号凭证 |
| 输出产物路径 | 任何发布/分发逻辑 |

**原因**：
- 构建脚本是通用资产，随源码仓库版本变化，不应夹带环境相关的凭证和发布逻辑
- 发布渠道会变化（新增/下线商店），改构建脚本零碎且容易出 bug
- 构建产物的上传是平台运维层面的事，不应跟编译过程耦合

### 1.2 后端 Publish 流水线 — 统一管理发布

```
职责边界：产物文件 + 凭证 → 各渠道 API → 发布结果
```

所有发布渠道通过后端统一调度，支持：
- **蒲公英**：`PgyerPublisher`，凭证走环境变量
- **App Store Connect**：`FastlanePublisher` → `fastlane deliver`，凭证走 Web UI 配置
- **安卓各厂商**：`FastlanePublisher` → Fastfile 中的 curl 调用，凭证走 Web UI 配置

**原因**：
- 发布是异步操作（可能耗时几分钟到几十分钟），需要队列（Bull）保证可靠性和重试
- 多个构建可能同时发布，队列排队的顺序保证不会互相冲突
- 发布状态（pending → uploading → success/failed/reviewing）需要持久化追踪
- 凭证安全性：敏感信息集中在后端存储，不在构建脚本中以明文硬编码

### 1.3 版本号递增 — 构建平台的职责

```
职责边界：检出代码 → 修改版本号 → 编译 → 上传
```

iOS 构建前自动递增 `CFBundleVersion`（pubspec.yaml 的 build number）：
- 位置：`build.processor.ts`，在 `workspaceService.prepare()` 之后、构建执行之前
- 逻辑：读取 `pubspec.yaml` → 替换 `version: X.Y.Z+BUILD` 中的 BUILD 为当前 Unix 时间戳 → `flutter pub get` 刷新生效
- 仅 iOS 触发，Android 不受影响（Android 商店无此限制）

**原因**：
- App Store Connect 强制要求每次上传的 `CFBundleVersion` 严格递增
- 时间戳方案天然保证唯一性和单调递增，无状态、无需查历史
- 放在构建平台而非构建脚本中，是因为这是平台运维逻辑，不应侵入源码仓库

---

## 二、数据持久化

### 2.1 凭证数据

```
源头：Web UI → REST API → StorageService（内存 Map）→ publishing-credentials.json
方向：启动时从 JSON 加载到内存，每次变更后写入 JSON
```

存储路径：`{WORKSPACE_DIR}/publishing-credentials.json`

格式：
```json
[
  {
    "platform": "appstore",
    "enabled": true,
    "credentials": {
      "apple_id": "...",
      "bundle_id": "...",
      "issuer_id": "...",
      "key_id": "...",
      "private_key": "-----BEGIN PRIVATE KEY-----\n..."
    },
    "updatedAt": "2026-05-08T..."
  }
]
```

**合理性**：
- 本地 JSON 文件适合单机部署场景，无需引入数据库依赖
- 重启后自动恢复，用户无感知
- 敏感字段（private_key、app_secret 等）以明文存储在本地文件，**未来应加密**（AES 对称加密 + 启动时配置密钥）

### 2.2 构建和发布记录

当前全部存储于内存 `Map`，重启丢失。这不是好设计，但因项目处于早期阶段，可以接受。

**建议**：后续引入 SQLite 或 PostgreSQL，持久化构建历史、发布记录、日志路径等。

---

## 三、凭证配置入口

### 3.1 现状

| 入口 | 位置 | 适合场景 |
|------|------|---------|
| **Settings 页面** | `/settings` → 发布平台配置 → 各平台卡片 → 「配置」按钮 | 首次配置、集中管理 |
| **NewBuild 页面** | 构建表单 → 发布平台标签点击 → 弹窗直接配置 | 快速补配、即时配置 |

### 3.2 合理性

- Settings 是主入口，提供完整的增删改查 + 开关
- NewBuild 作为快捷入口，消除「看到未配置 → 离开页面 → Settings → 找到平台 → 配置 → 返回」的认知断点
- 两个入口共享同一个 API（`PUT /config/publishing/:platform`），数据一致

**问题**：当前 `pgyer_account_type` 既是构建参数（决定用哪个蒲公英账号），又需要与后端的 API Key 对应。这里存在隐式耦合 — 构建表单选账号、后端拿对应的 `PGYER_API_KEY_${ACCOUNT}` 环境变量。如果账号发生变化（新增/删除/改名），需要同时改前端表单和后端环境变量。

---

## 四、端口规范

| 端口 | 服务 | 用途 |
|------|------|------|
| 3000 | NestJS 后端 | REST API + WebSocket |
| 5173 | Vite 前端 | 开发服务器 |
| 6379 | Redis | Bull 队列 |
| 80 | Nginx | 生产部署反向代理 |

**约定**：
- 开发环境：前端 5173 代理 API 请求到后端 3000
- 生产环境：Nginx 80 统一入口，`/api` 转发后端，其余走前端静态文件
- 端口不硬编码在前端代码中，通过 `VITE_API_URL` / `VITE_WS_URL` 环境变量注入

---

## 五、分支管理

### 5.1 现状

```
GET /config/branches → git fetch --all → git branch -r → 返回分支列表
```

前端分支下拉框每次打开时自动重新获取，确保新推送的分支立即可见。

### 5.2 合理性

- `git fetch --all` 确保远程新分支实时可见
- 前端 `onDropdownVisibleChange` 按需刷新，避免页面加载时卡顿
- 构建时 `git reset --hard origin/<branch>` 保证用远程最新代码，避免本地脏状态

**注意**：当前 Workspace 中的 `pubspec.yaml` 修改（版本号递增）是在 `git checkout` 之后对工作区做的临时修改，不会推回远程。每次构建都是全新检出 → 修改版本号 → 编译 → 丢弃修改。

---

## 六、安全考量

### 6.1 已做

- JWT 认证保护所有 API 端点
- 私钥字段在前端以 `******` 展示
- 凭证通过 HTTPS API 传输（生产环境需配置 SSL）

### 6.2 待做

| 风险 | 建议方案 |
|------|---------|
| `publishing-credentials.json` 明文存储密钥 | 使用 AES-256-GCM 加密，密钥从环境变量或 macOS Keychain 读取 |
| `build_app.sh` 中硬编码 Apple ID 密码（已删除的 altool 调用） | 已移除，改为通过 fastlane App Store Connect API Key 认证 |
| Redis 端口 6379 默认无密码 | 生产环境配置 `requirepass` |
| 前端直接访问后端 API，无 CSRF 保护 | 添加 CSRF token 或使用 SameSite Cookie |

---

## 七、整体流程

```
用户操作                  后端处理                         外部系统
────────                ────────                        ──────

1. 配置凭证
Settings/NewBuild
  ──PUT /config/       → StorageService.save()
    publishing/:platform  → persistCredentials()
                            → publishing-credentials.json

2. 创建构建
NewBuild 表单
  ──POST /builds        → BuildService.create()
                           → BuildTask (status: pending)
                           → Bull Queue 'build'

3. 构建执行
                         BuildProcessor:
                           prepare() → git clone/fetch/checkout
                           bumpBuildNumber() → pubspec.yaml (iOS only)
                           localExecute('build_app.sh')
                           collectArtifacts() → IPA/APK 文件
                           saveLogs()
                           status → 'success'

4. 发布执行
                           PublishService.publish()
                           → Bull Queue 'publish'
                           PublishProcessor:
                             FastlanePublisher.upload()
                               → fastlane deliver (App Store)
                               → curl (安卓商店)
                             PgyerPublisher.upload()
                               → POST pgyer.com (蒲公英)
```

---

## 八、关键文件索引

| 文件 | 职责 |
|------|------|
| `packages/backend/src/modules/build/build.processor.ts` | 构建流程编排，含版本号递增 |
| `packages/backend/src/modules/executor/workspace.service.ts` | 工作空间准备，含版本号修改逻辑 |
| `packages/backend/src/modules/executor/executor.service.ts` | Shell 命令执行（本地 + SSH） |
| `packages/backend/src/modules/publish/publish.service.ts` | 发布任务调度 |
| `packages/backend/src/modules/publish/publish.processor.ts` | 发布队列消费 |
| `packages/backend/src/modules/publish/publishers/fastlane.publisher.ts` | Fastlane 发布器 |
| `packages/backend/src/modules/storage/storage.service.ts` | 内存存储 + 凭证 JSON 持久化 |
| `packages/backend/src/modules/config/config.controller.ts` | 平台元数据定义 + 分支/配置 API |
| `packages/frontend/src/pages/Settings/index.tsx` | 凭证配置主入口 |
| `packages/frontend/src/pages/BuildTasks/NewBuild.tsx` | 构建表单 + 凭证快捷配置 |
| `fastlane/Fastfile` | Fastlane lanes（iOS deliver + Android curl） |
| `{WORKSPACE_DIR}/repo/build_app.sh` | 构建脚本（仅编译，不上传） |
