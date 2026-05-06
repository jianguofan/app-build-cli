## ADDED Requirements

### Requirement: Fastlane 环境就绪
系统 SHALL 在宿主机具备 Fastlane 运行环境，包括 Ruby 2.7+、bundler、fastlane gem 及所需厂商 plugin。

#### Scenario: Fastlane 安装验证
- **WHEN** 执行 `fastlane --version` 命令
- **THEN** 系统输出 fastlane 版本号且无错误

#### Scenario: 厂商 plugin 安装
- **WHEN** 执行 `bundle install` 在 fastlane 目录下
- **THEN** 所有 Gemfile 中声明的 plugin 安装成功

---

### Requirement: Fastfile 按平台定义发布 lane
系统 SHALL 在 `fastlane/Fastfile` 中为每个发布平台定义一个 lane，接收构建产物路径和必要的 API 凭证参数。

#### Scenario: iOS App Store 发布 lane
- **WHEN** 调用 `fastlane ios publish_appstore artifact_path:/path/to/app.ipa`
- **THEN** lane 使用 `deliver` action 上传 IPA 到 App Store Connect，返回构建版本号

#### Scenario: Android 小米商店发布 lane
- **WHEN** 调用 `fastlane android publish_xiaomi artifact_path:/path/to/app.apk app_id:XXX app_key:XXX app_secret:XXX`
- **THEN** lane 使用小米 plugin 上传 APK 并提交审核

#### Scenario: Android 华为商店发布 lane
- **WHEN** 调用 `fastlane android publish_huawei artifact_path:/path/to/app.apk client_id:XXX client_secret:XXX app_id:XXX`
- **THEN** lane 使用华为 plugin 上传 APK 并提交审核

---

### Requirement: FastlanePublisher 统一发布入口
后端 SHALL 提供 `FastlanePublisher` 类，通过 SSH 在宿主机执行 fastlane 命令完成发布，替代原有的 7 个独立厂商 publisher 类。

#### Scenario: 通过 Fastlane 发布 APK 到小米
- **WHEN** PublishProcessor 触发 fastlane 平台的小米发布任务
- **THEN** FastlanePublisher 通过 SSH 执行 `fastlane android publish_xiaomi artifact_path:{artifact} ...` 并返回 PublishResult

#### Scenario: Fastlane 执行失败处理
- **WHEN** fastlane 命令返回非零退出码
- **THEN** FastlanePublisher 返回 `{ success: false, error: "stderr output" }`

#### Scenario: Fastlane 命令超时
- **WHEN** fastlane 命令执行超过 30 分钟
- **THEN** SSH 连接终止，返回失败结果并记录超时日志

---

### Requirement: 发布队列与 Fastlane 集成
PublishProcessor SHALL 对除 pgyer 外的所有发布平台通过 FastlanePublisher 执行上传，保持现有的 Bull 队列重试和状态追踪机制。

#### Scenario: 生产环境 Android 全渠道发布
- **WHEN** Android prod 构建成功
- **THEN** 系统依次向 publish 队列添加 pgyer、xiaomi、huawei、tencent、vivo、oppo 共 6 个发布任务，全部通过对应 fastlane lane 执行

#### Scenario: 非生产环境发布范围
- **WHEN** Android dev/pre 构建成功
- **THEN** 系统仅向 publish 队列添加 pgyer 发布任务

---

### Requirement: 凭证传递不落地
Fastlane 所需的 API 凭证 SHALL 从后端内存存储读取，通过命令行参数注入 fastlane 进程，不在文件系统中持久化（Fastfile 中不含硬编码密钥）。

#### Scenario: 凭证通过参数传递
- **WHEN** PublishProcessor 构造 fastlane 命令
- **THEN** 所有 API key/secret 从 Settings 页面配置中读取，以参数形式传入，不在宿主机写入文件

#### Scenario: 凭证存储在后端
- **WHEN** 用户通过 /api/config/publishing/:platform 接口保存 API 凭证
- **THEN** 凭证存入后端内存存储，密钥字段在列表接口中脱敏展示（仅显示是否已配置，不返回明文）


### Requirement: 发布平台凭证 Web 管理
系统 SHALL 在 Settings 页面提供各发布平台的 API 凭证管理功能，支持添加、编辑、删除、启用/禁用。

#### Scenario: 添加发布平台凭证
- **WHEN** 管理员在 Settings 页面的发布平台配置中点击「配置」按钮，填写所需的 API 凭证字段并保存
- **THEN** 凭证保存到后端存储，页面显示该平台为「已配置」

#### Scenario: 编辑已配置的凭证
- **WHEN** 管理员点击已配置平台的「编辑」按钮
- **THEN** 弹出表单预填当前配置（密钥字段为空需重新输入），修改后保存

#### Scenario: 删除平台凭证
- **WHEN** 管理员删除某平台的凭证配置
- **THEN** 该平台在发布列表中显示为「未配置」，后续发布任务跳过该平台

#### Scenario: 禁用发布渠道
- **WHEN** 管理员关闭某平台的启用开关
- **THEN** 该平台不参与后续发布，但凭证信息保留

#### Scenario: 凭证在列表中脱敏
- **WHEN** 管理员查看环境变量列表中的密文配置项
- **THEN** 密钥字段显示 `******`，不可直接查看明文
