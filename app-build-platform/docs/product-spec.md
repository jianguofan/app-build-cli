# App Build Platform — 产品规划文档

## 产品定位

**App Build Platform** 是一站式移动应用构建与发布平台，面向 Snapmaker 内部研发团队，解决 Flutter 跨端应用在多平台（iOS、Android、鸿蒙、Web）编译构建、以及在国内 10+ 应用商店发布的流程自动化问题。

与 Jenkins / GitHub Actions 等通用 CI/CD 工具的差异在于，本平台**深度绑定国内应用商店生态**——小米、华为、OPPO、VIVO、应用宝、360、荣耀、三星、蒲公英等渠道没有现成的 CI 插件可复用，每个渠道的签名算法、鉴权方式、上传方式各不相同，平台将这些复杂性封装为统一的操作界面。

平台长期演进方向是 **AI 驱动的智能发布引擎**：从代码提交开始，自动完成代码审查 → 单元测试 → 风险评估 → 构建编译 → 多渠道发布 → 日志分析，人工只需在关键节点做审批决策。

---

## 整体架构

```
开发者浏览器
     │
     ▼
┌─────────────┐
│   Nginx 80  │  反向代理
└─────┬───────┘
      │
      ├── /          → React 前端（静态资源）
      ├── /api       → NestJS 后端（REST API）
      └── /ws        → WebSocket（实时日志 + 状态推送）
                          │
                          ▼
                     ┌──────────┐
                     │  Redis   │  Bull 队列（构建 / 发布任务）
                     └──────────┘
                          │
                          ▼
              ┌─────────────────────┐
              │    宿主机 macOS      │
              │  ┌───────────────┐  │
              │  │ build_app.sh  │  │  编译构建（Flutter）
              │  │   Fastlane    │  │  应用商店上传
              │  │   鸿蒙 CLI     │  │  鸿蒙打包（二期）
              │  │   npm build   │  │  Web 打包（二期）
              │  └───────────────┘  │
              └─────────────────────┘
```

- **运行环境**：单机 macOS，Docker Compose 部署
- **技术栈**：NestJS + React + Redis + Bull + Socket.IO + Fastlane
- **存储**：一期内存 Map + JSON 文件；二期迁移至 PostgreSQL
- **构建语言**：一期 Flutter（iOS + Android）；二期扩展至 ArkTS（鸿蒙）+ TypeScript（Web）

---

## 一期：核心构建发布（已完成）

### 1.1 能力范围

| 模块 | 能力 | 状态 |
|------|------|------|
| 构建目标 | iOS（IPA）、Android（APK） | 完成 |
| 构建参数 | 平台、渠道（oversea/cn）、环境（dev/pre/prod）、构建模式（debug/release）、分支、语言、区域、蒲公英账号 | 完成 |
| 构建执行 | Git 工作空间管理、iOS 版本号自动递增、`build_app.sh` 脚本调用、实时日志推送、产物收集 | 完成 |
| 发布渠道 | App Store Connect、蒲公英、小米、华为、OPPO、VIVO、应用宝、360、荣耀、三星 | 完成 |
| 发布方式 | Fastlane（App Store deliver + 安卓厂商 raw curl）、蒲公英 HTTP API | 完成 |
| Web UI | 仪表盘、构建列表/新建/详情、发布管理、直接上传、系统配置 | 完成 |
| 实时反馈 | WebSocket 构建日志推送、发布状态轮询 | 完成 |
| 凭证管理 | 各平台密钥通过 Web UI 配置，持久化 JSON；iOS 支持 P8 私钥 | 完成 |
| 认证 | JWT 登录，单管理员账号 | 完成 |
| 部署 | Docker Compose 一键部署 | 完成 |

### 1.2 一期局限

- **存储**：内存 Map，服务重启丢失构建/发布历史
- **用户**：单一硬编码管理员，无角色权限
- **通知**：无外部消息通知（仅页面内 WebSocket + 轮询）
- **构建类型**：仅 Flutter，不支持鸿蒙、Web
- **前置检查**：无代码审查、无自动化测试，创建即构建
- **安卓商店发布**：Fastlane lanes 和凭证 UI 已实现，但前端入口已隐藏（当前走人工上传发布）

### 1.3 部署方式

```
docker compose up -d
```

4 个容器：Nginx、React 前端、NestJS 后端、Redis。构建和 Fastlane 在宿主机执行（需要访问 Xcode、Keychain、Android SDK）。

---

## 二期：平台能力完善

### 2.1 鸿蒙打包构建

**背景**：HarmonyOS NEXT（纯血鸿蒙）已商用，Snapmaker App 需适配鸿蒙生态，构建平台需要纳入鸿蒙打包能力。

**建设内容**：

```
构建目标新增：harmonyos → 产物：HAP / APP 包
```

- **构建环境**：宿主机安装 DevEco Studio + HarmonyOS SDK + hvigor CLI
- **构建脚本**：新增 `build_harmony.sh`，参数包括 target（phone/tablet/default）、buildMode（debug/release）、signingConfig
- **签名体系**：
  - 鸿蒙签名链路复杂：`.p12` 密钥库 + `.cer` 应用证书 + `.p7b` Profile 文件
  - 一期通过宿主机本地文件路径配置 → 二期支持 Web UI 上传密钥材料
- **产物管理**：HAP 文件纳入制品目录，支持下载
- **参数配置**：在平台 `build options` 中新增鸿蒙专属参数组（target 设备类型、signingConfig 签名配置名）

**前端页面变更**：
- 新建构建 → 平台选择新增「鸿蒙」选项卡
- 构建详情 → 产物下载支持 .hap / .app 文件
- 仪表盘统计 → 鸿蒙构建纳入统计数据

### 2.2 Web 打包构建

**背景**：Snapmaker Web 前端项目（React / TypeScript）需要构建并部署到 CDN 或服务器，构建平台统一管理 Web 打包流程。

**建设内容**：

```
构建目标新增：web → 产物：dist/ 目录（tar.gz）
```

- **构建环境**：宿主机 Node.js，`npm install && npm run build`
- **构建脚本**：新增 `build_web.sh`，参数包括 env（dev/pre/prod）、outputDir
- **产物管理**：打包为 `tar.gz`，存储并支持下载
- **部署集成（可选）**：构建完成后触发 Webhook 通知 CDN 刷新或上传到静态资源服务器

**前端页面变更**：
- 平台选择新增「Web」
- Web 构建不触发应用商店发布流程，产物仅提供下载
- 构建参数精简：环境（dev/pre/prod）、分支

### 2.3 构建前置检查 — Code Review + 单元测试

**背景**：当前创建构建后直接进入编译，缺少质量门禁。二期引入前置检查步骤，确保只有经过 Review 和测试通过的代码才能进入构建环节。

**建设内容**：

```
构建流水线新增阶段：Review Gate → Test Gate → Build → Publish
```

**Code Review Gate**：
- 构建创建后，自动在对应 Git 分支上创建 Merge Request / Pull Request（对接 GitLab / GitHub API）
- 指定 Reviewer（按项目配置），Reviewer 在 Git 平台 Approve 后 → Gate 通过
- Webhook 接收 Review 状态变更，更新平台任务状态
- 状态：`pending_review` → `review_approved` / `review_rejected`
- Reviewer 超过 N 小时未处理时，通过飞书自动催审

**Unit Test Gate**：
- Review 通过后自动触发测试
- 执行 `flutter test`（Flutter）、`hvigor test`（鸿蒙）、`npm test`（Web）
- 解析测试报告（JUnit XML / JSON），提取通过率、失败用例
- 状态：`pending_test` → `test_passed` / `test_failed`
- 测试失败时展示失败用例列表，阻止后续构建
- 可选：代码覆盖率阈值检查（如 < 80% 阻止构建）

**数据库建模（PostgreSQL）**：

```sql
-- 构建流水线阶段
CREATE TABLE build_stages (
  id            UUID PRIMARY KEY,
  build_id      UUID REFERENCES builds(id),
  stage_type    VARCHAR(32),  -- 'review', 'test', 'build', 'publish'
  status        VARCHAR(32),  -- 'pending', 'running', 'passed', 'failed'
  started_at    TIMESTAMP,
  completed_at  TIMESTAMP,
  result_data   JSONB,        -- 测试报告摘要、Review 信息等
  error         TEXT
);
```

**前端页面变更**：
- 构建详情页 → 显示流水线阶段进度条（Stage Pipeline）
- 每个阶段可展开查看详情（Review 审批人 & 状态、测试用例通过率 & 失败列表）
- 新建构建页 → 可选择是否跳过 Review / Test（需权限）

### 2.4 飞书通知

**背景**：当前所有操作反馈都在 Web 页面内，开发者需要主动打开平台查看。飞书是团队日常沟通工具，将关键节点推送到飞书可大幅提升效率。

**建设内容**：

```
基于飞书自定义机器人 Webhook 或飞书开放平台应用
```

**通知节点**：

| 事件 | 通知内容 | 通知对象 |
|------|---------|---------|
| 构建创建 | 谁创建了哪个项目的构建（平台/渠道/分支） | 频道全员 |
| Review 阶段 | 提醒指定 Reviewer 审批，附 MR 链接 | @指定Reviewer |
| Review 完成 | 审批通过/拒绝，附审批人 | 构建发起人 |
| 测试结果 | 通过率、失败用例数，附平台链接 | 构建发起人 |
| 构建开始/完成 | 平台、分支、耗时、产物链接 | 构建发起人 + 频道 |
| 构建失败 | 失败原因摘要，附日志链接 | 构建发起人 + @管理员 |
| 发布完成 | 各渠道发布结果（成功/失败），下载链接 | 构建发起人 + 频道 |
| 凭证过期提醒 | Apple P8 Key / 安卓签名即将过期 | @管理员 |

**技术方案**：
- 后端新增 `NotificationModule`
- 支持飞书自定义机器人 Webhook（最简方案）
- 消息模板化：飞书消息卡片（交互式卡片，含按钮跳转平台）
- 支持按项目/频道配置通知规则（哪些事件通知到哪个群）

**前端页面变更**：
- 系统配置页 → 新增「通知配置」页签
- 飞书 Webhook URL 配置
- 通知规则开关矩阵（事件 × 通知目标）

### 2.5 应用商店账号管理 Web 化

**背景**：一期已实现各平台密钥通过 Web UI 配置。在此基础上，二期扩展支持：
- 直接在平台中查看各商店的开发者账号/密码（非密钥，而是登录凭证）
- 将当前散落在 `.env.accounts` 文件中的各厂商开发者控制台登录信息，统一收纳到平台中，支持搜索和复制

**建设内容**：

**账号信息模型**：

```typescript
// 新增 store_accounts 表
interface StoreAccount {
  id: string;
  platform: string;        // xiaomi, huawei, oppo, vivo, tencent, qihu360, honor, samsung
  accountType: string;     // developer / enterprise / personal
  username: string;        // 手机号或邮箱
  password: string;        // AES-256 加密存储
  phone: string;           // 绑定手机
  notes: string;           // 备注
  lastRotatedAt: Date;     // 上次改密时间
  createdAt: Date;
  updatedAt: Date;
}
```

**前端新增页面**：

- 新增「账号管理」页面（路由 `/accounts`）
- 表格展示所有商店账号（平台、账号类型、用户名、密码（点击展示/复制）、手机、备注）
- 搜索、筛选（按平台）
- 新增/编辑/删除账号（权限控制：仅管理员）
- 密码字段：默认 `******`，点击眼睛图标展示明文（需二次确认），展示后自动 30 秒隐藏
- 复制功能：一键复制用户名/密码到剪贴板
- 操作审计日志：谁在什么时间查看了哪个平台的密码

**安全设计**：

| 层次 | 措施 |
|------|------|
| 存储 | 密码使用 AES-256-GCM 加密，密钥从环境变量 `ACCOUNT_ENCRYPTION_KEY` 读取 |
| 传输 | HTTPS 加密 |
| 访问控制 | 需要独立操作权限（非所有用户可查看密码） |
| 审计 | 密码查看操作记录到审计日志 |
| 展示 | 默认隐藏，点击后限时展示，自动隐藏 |

### 2.6 二期基础设施升级

| 组件 | 一期 | 二期 |
|------|------|------|
| 数据库 | 内存 Map + JSON 文件 | PostgreSQL + Prisma ORM |
| 用户体系 | 单用户硬编码 | 多用户 + RBAC（管理员/开发者/观察者） |
| 文件存储 | 本地目录 | 本地目录 + MinIO（可选） |
| 凭证加密 | 明文 JSON | AES-256-GCM |
| 会话管理 | 无状态 JWT | JWT + Refresh Token |
| 日志系统 | Winston 本地文件 | 结构化日志 + ELK（可选） |

---

## 三期：智能化与可观测性

### 3.1 日志分析平台

**背景**：构建失败时，开发者需要在大量构建日志中排查问题。三期将构建日志统一采集、索引，提供搜索和分析能力。

**建设内容**：

**日志采集**：
- 构建日志（`build_app.sh` stdout/stderr）
- 发布日志（fastlane 输出、curl 返回）
- 系统日志（后端服务运行日志）
- 全部写入 ELK（Elasticsearch + Logstash + Kibana）或 Grafana Loki

**日志分析能力**：

| 功能 | 描述 |
|------|------|
| 全文搜索 | 按关键词、时间范围搜索所有构建日志 |
| 错误聚合 | 相同错误信息自动聚类，统计频率 |
| 构建耗时分析 | 各阶段耗时分布（依赖安装/编译/签名/上传），识别瓶颈 |
| 失败模式识别 | 机器学习模型识别常见失败模式（证书过期、依赖冲突、磁盘空间不足等），自动给出修复建议 |
| 趋势图表 | 构建成功率趋势、平均耗时趋势、失败原因分布 |
| 告警规则 | 连续 N 次构建失败 → 飞书告警；构建耗时超过阈值 → 告警 |

**前端新增页面**：
- 「日志分析」页面（路由 `/logs`）
- 搜索栏（关键词 + 时间范围 + 平台筛选 + 状态筛选）
- 错误聚合面板（Top N 错误类型）
- 单次构建日志详情（行号、高亮、ANSI 颜色渲染、下载原始日志）

### 3.2 AI 驱动的智能发布引擎

**背景**：这是平台远期愿景——让 AI 参与构建发布决策，减少人工判断的延迟和遗漏。

**建设内容**：

```
代码提交 → AI Code Review → 智能测试选择 → 风险评分 → 构建决策 → 多渠道发布
```

| 阶段 | AI 能力 | 描述 |
|------|---------|------|
| AI Code Review | 基于 LLM 的代码审查 | 提交 diff → AI 评审（安全风险、性能问题、代码规范），作为人工 Review 的辅助参考 |
| 智能测试选择 | 基于变更影响的用例筛选 | 分析代码变更影响范围，只运行相关测试用例（而非全量），缩短测试时间 |
| 风险评分 | 多维度风险评估 | 综合变更规模、文件敏感度（如修改支付/认证模块）、提交时间（是否深夜）、历史构建成功率，给出 0-100 风险分 |
| 自动构建决策 | 低风险自动放行 | 风险分 < 30 → 自动进入构建（跳过人工 Review）；30-70 → 需 1 人审批；> 70 → 需 2 人审批 |
| 发布决策 | 灰度/全量推荐 | 根据变更类型推荐发布策略（全量 or 灰度），支持多渠道按比例灰度 |

**前端新增页面**：
- 「AI 仪表盘」页面（路由 `/ai-dashboard`）
- 风险评分详情（各维度打分、加权逻辑可视化）
- AI Review 结果展示（diff 侧边栏 + AI 注释）
- 决策历史与回溯

### 3.3 三期基础设施升级

| 组件 | 二期 | 三期 |
|------|------|------|
| 可观测性 | Winston 日志文件 | ELK / Grafana Loki + Prometheus |
| 分布式追踪 | 无 | OpenTelemetry |
| AI 网关 | 无 | LLM API 网关（Anthropic / OpenAI） |
| 构建集群 | 单机 | 支持多构建节点（构建任务分发到多台 Mac） |

---

## 分期对比总览

| 维度 | 一期（已完成） | 二期（规划中） | 三期（愿景） |
|------|:--:|:--:|:--:|
| **构建目标** | iOS, Android | + 鸿蒙, Web | 同二期 |
| **构建前置检查** | 无 | Code Review + 单元测试 | + AI Review + 风险评分 |
| **发布渠道** | 10 个（Fastlane + 蒲公英） | 同左（安卓渠道恢复自动发布） | + 灰度/分渠道策略 |
| **通知** | 无（仅页面内） | 飞书消息卡片 | + 告警规则 |
| **账号管理** | `.env.accounts` 文件 | Web 化 + 加密 + 审计 | 同左 |
| **用户体系** | 单管理员 | 多用户 + RBAC | 同左 |
| **数据库** | 内存 Map + JSON | PostgreSQL + Prisma | 同左 + OLAP 分析库 |
| **日志** | 本地文件 | 结构化日志 | ELK/Loki 全文搜索 |
| **AI** | 无 | 无 | AI Review / 智能测试 / 风险评分 |
| **部署** | Docker Compose 单机 | 同左 | 多节点构建集群 |
| **分析能力** | 简单统计卡片 | 统计分析 | 日志分析 + 失败模式识别 |

---

## 二期实施路线图

| 迭代 | 内容 | 预估工作量 |
|------|------|:--:|
| 2.0 | 基础设施升级：PostgreSQL + 多用户 RBAC + 凭证加密 | 2 周 |
| 2.1 | 鸿蒙打包构建 | 1 周 |
| 2.2 | Web 打包构建 | 0.5 周 |
| 2.3 | 飞书通知系统 | 1 周 |
| 2.4 | Code Review Gate | 1 周 |
| 2.5 | Unit Test Gate | 1 周 |
| 2.6 | 商店账号管理 Web 化 | 1 周 |
| 2.7 | 恢复安卓商店自动发布 | 0.5 周 |

> 总预估：约 8 周。实际排期需根据团队资源调整。
