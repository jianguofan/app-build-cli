## 1. Fastlane 环境安装

- [x] 1.1 在宿主机安装 Fastlane：`gem install fastlane`，验证 `fastlane --version`
- [x] 1.2 创建 `fastlane/` 目录，初始化 Gemfile 锁定 fastlane 及 plugin 版本
- [x] 1.3 调研并安装各厂商 Fastlane plugin（小米、华为、OPPO、VIVO），确认 plugin 可用性；对无 plugin 的渠道（应用宝、360）记录 HTTP fallback 方案（所有国内厂商均无成熟 RubyGems plugin，Fastfile 使用 raw curl 实现）
- [x] 1.4 执行 `bundle install`，生成 Gemfile.lock

## 2. Fastfile 编写

- [x] 2.1 创建 `fastlane/Fastfile`，按平台定义 lane（共 9 个）：
  - `ios publish_appstore` — 使用 `deliver` 上传 IPA
  - `android publish_xiaomi` — 使用 curl POST + MD5 签名上传 APK
  - `android publish_huawei` — 使用 curl OAuth2 + PUT 上传 APK
  - `android publish_oppo` — 使用 curl POST + MD5 签名上传 APK
  - `android publish_vivo` — 使用 curl POST + MD5 签名上传 APK
  - `android publish_tencent` — 使用 curl POST + MD5 签名上传 APK
  - `android publish_qihu360` — 使用 curl POST + Token 上传 APK
  - `android publish_honor` — 使用 curl OAuth2 + PUT 上传 APK（类华为）
  - `android publish_samsung` — 使用 curl POST + Bearer Token 上传 APK
- [x] 2.2 创建 `fastlane/Appfile`，包含 App 通用元信息（app_identifier、apple_id 等）
- [x] 2.3 确保所有 lane 通过命令行参数接收 `artifact_path` 和 API 凭证，Fastfile 内无硬编码密钥
- [ ] 2.4 本地逐条验证每个 lane 可成功执行（用测试包验证）— 需要实际 API 凭证，待部署时验证
- [x] 2.5 创建 `fastlane/.env.accounts` — 记录各厂商开发者控制台登录账号（仅参考，非 API 密钥），已加入 `.gitignore`

## 3. 后端 FastlanePublisher 实现

- [x] 3.1 新增 `FastlanePublisher` 类（extends `BasePublisher`），实现 `upload()` 方法：通过 child_process.exec 在宿主机执行 `fastlane <platform> <lane> artifact_path:{path} ...` 命令
- [x] 3.2 `upload()` 方法根据 `config.targetPlatform` 映射对应的 fastlane lane 名称和参数，从存储读取凭证拼接命令行
- [x] 3.3 捕获 fastlane 命令 stdout/stderr，解析退出码，返回 `PublishResult`
- [x] 3.4 配置 30 分钟 SSH 超时，超时后终止命令并返回失败
- [x] 3.5 实现 `checkStatus()` 方法 — fastlane 完成后返回 reviewing 状态（各厂商审核状态需后续轮询）

## 4. 后端清理：删除自研厂商 Publisher

- [x] 4.1 删除以下文件：
  - `appstore.publisher.ts`
  - `xiaomi.publisher.ts`
  - `huawei.publisher.ts`
  - `tencent.publisher.ts`
  - `vivo.publisher.ts`
  - `oppo.publisher.ts`
  - `qihu360.publisher.ts`
- [x] 4.2 更新 `publish.module.ts`：移除已删除 publisher 的 providers 注册，添加 `FastlanePublisher` + `ExecutorModule`
- [x] 4.3 更新 `publish.service.ts`：
  - `getPublisher()` switch-case 简化（9 个 fastlane 平台映射到同一个 FastlanePublisher）
  - `publish()` 方法中仅对 enabled 且有凭证的平台创建发布任务
- [x] 4.4 更新 `publish.processor.ts`：`getPublishConfig()` 从 StorageService 读取凭证，移除已删除厂商的 env var 读取

## 4b. 扩展：Honor & Samsung 支持

- [x] 4b.1 Fastfile 新增 `android publish_honor` 和 `android publish_samsung` 两个 lane
- [x] 4b.2 `fastlane.publisher.ts` PLATFORM_MAP 增加 honor、samsung
- [x] 4b.3 `config.controller.ts` PLATFORM_META 增加荣耀、三星的凭证字段
- [x] 4b.4 `publish.service.ts` 和 `publish.processor.ts` FASTLANE_PLATFORMS 增加 honor、samsung
- [x] 4b.5 创建 `fastlane/.env.accounts` 记录各厂商控制台登录账号，加入 `.gitignore`

## 5. Settings 页面：发布凭证管理 UI

- [x] 5.1 改造 Settings 页面「发布平台配置」区域：每个平台从只读 Tag 改为可交互卡片，包含：
  - 平台名称 + 配置状态图标（已配置 / 未配置）
  - 「配置」按钮 → 弹出凭证表单 Modal
  - 「删除」按钮 → 二次确认后清除凭证
  - 启用/禁用 Switch 开关（控制该渠道是否参与发布）
- [x] 5.2 每个平台的凭证 Modal 中显示该平台所需的 API 字段表单，密钥类字段用 `type="password"` Input
- [x] 5.3 新建可复用的 `CredentialCard` 组件，避免与 OptionGroupCard 耦合

## 6. 后端：凭证存储与 API

- [x] 6.1 在 `storage.service.ts` 中新增 `publishingCredentials` 存储（Map），每条记录含 `platform`、`enabled`、`credentials: Record<string, string>`
- [x] 6.2 在 `config.controller.ts` 中新增：
  - `GET /api/config/publishing` — 返回各平台配置状态+字段列表
  - `PUT /api/config/publishing/:platform` — 保存/更新某平台凭证（密钥字段为空时不覆盖原值）
  - `DELETE /api/config/publishing/:platform` — 删除某平台凭证
  - `PUT /api/config/publishing/:platform/toggle` — 切换启用/禁用
- [x] 6.3 更新 `GET /api/config` 返回的 `publishing` 对象，使用新的存储数据源（不再直接读 env）
- [x] 6.4 `GET /api/config/env` 中属于发布平台凭证的配置项调整为从新的凭证存储读取状态

## 7. 前端与接口整合验证

- [x] 7.1 确认 `Publishes` 页面无需修改 — 发布记录和状态字段前端接口不变
- [ ] 7.2 在 Settings 页面完整走通：录入某平台凭证 → 保存 → 页面显示「已配置」→ 发布流程使用该凭证 → 发布成功 — 需启动实际服务验证

## 8. 构建时选择发布平台

- [x] 8.1 NewBuild 页面：选择平台后展示可选发布渠道 checkbox 列表，仅已配置+已启用的可勾选
- [x] 8.2 后端 `create-build.dto.ts` 新增 `publishTargets: string[]` 字段
- [x] 8.3 `storage/models.ts` BuildTask 新增 `publishTargets?: string[]`
- [x] 8.4 `build.service.ts` 创建任务时存储 `publishTargets`（含 rebuild 传递）
- [x] 8.5 `publish.service.ts` publish() 使用 build.publishTargets 替代硬编码 env===prod 全量发布逻辑
- [x] 8.6 `PublishStatus` 组件：更新 platformNames 含 honor/samsung
- [x] 8.7 BuildDetail 页面：构建成功后提供「重新发布」按钮，可手动触发发布到选中平台

## 9. 文档与配置更新

- [x] 9.1 更新 `README.md`：部署步骤增加 Fastlane 安装要求，凭证配置改为「通过 Web Settings 页面配置」
- [x] 9.2 更新 `.env.example`：移除已删除厂商的单独环境变量
- [x] 9.3 更新 `docs/deployment.md`：补充 Fastlane 安装说明，凭证管理指南指向 Settings 页面
