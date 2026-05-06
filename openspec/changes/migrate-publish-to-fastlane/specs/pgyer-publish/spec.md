## ADDED Requirements

### Requirement: 蒲公英 API 上传
系统 SHALL 通过 HTTP POST 直接上传 IPA/APK 文件到蒲公英 API，无需 Fastlane 中间层。

#### Scenario: 上传 APK 到蒲公英成功
- **WHEN** PgyerPublisher 收到有效的 artifact 路径和 API key
- **THEN** 系统通过 multipart/form-data POST 到 `https://www.pgyer.com/apiv2/app/upload`，返回 `{ success: true, downloadUrl }`

#### Scenario: 蒲公英 API key 未配置
- **WHEN** API key 以 `your_` 开头或为空
- **THEN** 返回 `{ success: false, error: "API key not configured" }`

#### Scenario: 文件不存在
- **WHEN** artifactPath 指向的文件不存在
- **THEN** 返回 `{ success: false, error: "Artifact file not found: {path}" }`

#### Scenario: 网络超时重试
- **WHEN** 上传请求超时（超过 10 分钟）
- **THEN** Bull 队列按配置的 3 次指数退避重试

---

### Requirement: 蒲公英多账号支持
系统 SHALL 支持按 `pgyerAccountType` 选择不同的蒲公英 API key，实现多账号分发。

#### Scenario: 按账号类型选择 API key
- **WHEN** pgyerAccountType 为 `"special"` 且 `PGYER_API_KEY_SPECIAL` 环境变量已配置
- **THEN** 系统使用 `PGYER_API_KEY_SPECIAL` 而非默认 `PGYER_API_KEY`

#### Scenario: 账号类型未配置回退默认
- **WHEN** pgyerAccountType 对应的 API key 未配置
- **THEN** 系统回退使用默认 `PGYER_API_KEY`
