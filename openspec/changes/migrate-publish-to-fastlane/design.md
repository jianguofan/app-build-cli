## Context

当前 `packages/backend/src/modules/publish/publishers/` 下有 9 个 publisher 类，除 `PgyerPublisher` 外，其余 8 个全部处于 Phase 1 模拟状态（upload 方法直接 `return { success: true }`，checkStatus 返回固定 reviewing 状态）。这些类各自处理不同厂商的鉴权方式（OAuth、MD5 签名、JWT 等），但实际并未完成对接。

Fastlane 是 Ruby 生态下最成熟的移动端 CI/CD 工具，原生支持 `deliver`（App Store Connect）和 `supply`（Google Play），并通过社区 plugin 支持华为、小米等国内厂商。API 变更由社区跟进，无需项目自行维护。

宿主机已安装 Xcode、Android Studio、Flutter SDK，Fastlane 的安装只需 `gem install fastlane`，对现有环境侵入极小。

## Goals / Non-Goals

**Goals:**
- 用 Fastlane 统一替代 7 个自研厂商 publisher，消除 700+ 行未完成的模拟代码
- Fastlane lane 封装各厂商上传逻辑，后端通过 SSH 执行 lane 命令即可完成发布
- 保留蒲公英自研 HTTP 集成（API 极简，引入 Fastlane 得不偿失）
- 发布流程保持异步队列模式不变（Bull + Redis），仅更改 publisher 实现

**Non-Goals:**
- 不迁移蒲公英（pgyer）到 Fastlane
- 不改变现有的 SSH 连接和构建执行架构
- 不涉及 Google Play（当前项目无此需求）

## Decisions

### 1. Fastlane 作为宿主机 CLI 工具，而非 Docker 容器化

**选择**: 在宿主机安装 Fastlane，通过 SSH 远程执行 `fastlane <platform> <lane>` 命令。

**理由**: Fastlane 需要访问宿主机的 Xcode、keychain、签名证书，容器化没有意义。与现有 `build_app.sh` 的执行模式完全一致 — 构建在宿主机跑，容器负责调度。

**备选方案**: 不采纳「在 Docker 中装 Fastlane」— 会导致容器体积膨胀（Ruby + gems），且无法访问宿主机的签名和证书。

### 2. 后端新增 `FastlanePublisher` 替代 7 个类

**选择**: 创建单个 `FastlanePublisher extends BasePublisher`，根据不同 `platform` 参数调用不同 fastlane lane。

```typescript
class FastlanePublisher extends BasePublisher {
  readonly platform = 'fastlane';

  async upload(artifactPath: string, config: { platform: string; lane: string }): Promise<PublishResult> {
    // SSH 执行: fastlane {platform} {lane} artifact_path:{artifactPath}
  }
}
```

**理由**: 7 个类本质上做的事情一样（SSH → 执行命令 → 解析输出），差异只在 lane 名称和参数，一个类加一个 switch/map 足够。大幅减少代码量和维护面。

### 3. Fastfile 组织：按平台分 lane，统一放在项目根目录

**选择**: 在项目根目录创建 `fastlane/` 目录，包含一个主 Fastfile，按平台分 lane：

```
fastlane/
├── Fastfile          # 定义所有 lane
└── Appfile           # App 元信息
```

Lane 命名：`ios_publish`、`android_xiaomi`、`android_huawei`、`android_oppo`、`android_vivo`、`android_tencent`、`android_360`

### 4. 凭证管理：Web 界面配置，内存存储，SSH 时注入

**选择**: 各厂商 API 凭证通过 Settings 页面（Web UI）录入，存入后端内存存储（Phase 1）/ 数据库（Phase 2）。发布时 PublishProcessor 从存储中读取凭证，通过 SSH 命令参数注入 fastlane 进程。

```bash
# 后端从 Web UI 配置中读取凭证，拼接命令
fastlane android xiaomi artifact_path:/path/to/app.apk app_id:xxx app_key:xxx app_secret:xxx
```

**理由**: 用户不应直接编辑 `.env` 或 Fastfile 来管理凭证。Settings 页面应支持添加/编辑/删除各平台的 API 凭证（含密钥脱敏展示），发布时动态读取注入命令行。Fastfile 中不含任何硬编码密钥。

### 5. Settings 页面改造：凭证管理 UI

**选择**: 在 Settings 页面的「发布平台配置」区域，将每个平台的 Tag 展示改为可展开的凭证表单，支持：
- 查看凭证配置状态（已配置 / 未配置）
- 添加/编辑 API 凭证（含密钥字段）
- 删除已有凭证
- 启用/禁用某个发布渠道

后端新增 `PUT /api/config/publishing/:platform` 和 `DELETE /api/config/publishing/:platform` 接口。

**理由**: 当前 Settings 页面只展示发布平台名称 + 已配置/未配置 Tag，无法编辑。改造后，管理员可直接在 Web 上完成全平台配置，无需登录宿主机编辑文件。

### 6. `build_app.sh` 不集成 Fastlane

**选择**: Fastlane 在构建完成后的发布阶段独立调用，不修改 `build_app.sh`。

**理由**: build_app.sh 职责是构建 APK/IPA，与发布解耦。发布由 Bull 队列的 `PublishProcessor` 驱动，保持流程清晰。

## Risks / Trade-offs

- **Fastlane 依赖 Ruby 环境**: 宿主机需预装 Ruby 2.7+ 和 bundler。→ 安装脚本文档化，加入部署指南
- **厂商 plugin 可用性**: 部分国内厂商（如应用宝、360）Fastlane plugin 可能不活跃或不存在。→ 对不支持的厂商，fallback 到 HTTP 自研（但预计 scope 更小，只需处理 1-2 个厂商而非 7 个）
- **调试困难**: Fastlane 输出多且冗长。→ SSH 执行时捕获 stdout/stderr 并写回构建日志，前端 LogViewer 可查看
- **Fastlane 版本管理**: Gemfile.lock 锁定版本，避免 CI 环境不一致
