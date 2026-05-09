# 各平台发布配置指南

## 目录

- [架构概览](#架构概览)
- [App Store Connect (iOS)](#app-store-connect-ios)
- [蒲公英 (iOS / Android)](#蒲公英-ios--android)
- [小米应用商店](#小米应用商店)
- [华为应用市场](#华为应用市场)
- [荣耀应用市场](#荣耀应用市场)
- [OPPO 软件商店](#oppo-软件商店)
- [VIVO 应用商店](#vivo-应用商店)
- [应用宝 (腾讯)](#应用宝-腾讯)
- [360 手机助手](#360-手机助手)
- [三星应用商店](#三星应用商店)
- [验证发布结果](#验证发布结果)

---

## 架构概览

```
┌──────────────────────────────────────────────────────────────┐
│ 前端 (Web UI)                                                 │
│  Settings → CredentialCard → 填写各平台凭证 → 保存 & 启用      │
│  NewBuild → 勾选发布目标 → 提交构建                            │
└──────────────────────────┬───────────────────────────────────┘
                           │ REST API
                           ▼
┌──────────────────────────────────────────────────────────────┐
│ 后端 (NestJS)                                                 │
│  StorageService (内存存储凭证)                                  │
│  PublishService → Bull Queue → FastlanePublisher              │
└──────────────────────────┬───────────────────────────────────┘
                           │ child_process.exec
                           ▼
┌──────────────────────────────────────────────────────────────┐
│ Fastlane                                                     │
│  ├─ iOS:  deliver (App Store Connect API)                    │
│  └─ Android: curl 直接调用各厂商 OpenAPI                       │
└──────────────────────────────────────────────────────────────┘
```

**上传原理**：

1. 用户在 Web UI 填写各平台凭证，保存到后端内存（`StorageService`）
2. 创建构建任务时勾选目标平台，构建完成后自动触发发布
3. 后端通过 Bull 队列调度发布任务
4. `FastlanePublisher` 将凭证拼接为命令行参数，调用 `bundle exec fastlane` 执行对应的 lane
5. Fastlane 中：
   - iOS 使用 `deliver` action 调用 App Store Connect API
   - Android 各厂商使用 `curl` 直接调用各自的 OpenAPI
6. 发布记录写入内存存储，前端轮询展示状态

---

## App Store Connect (iOS)

### 所需凭证

| 字段 | 说明 | 示例 |
|------|------|------|
| Apple ID | Apple Developer 账号邮箱 | `developer@example.com` |
| Bundle ID | App 的包标识符 | `com.example.app` |
| Issuer ID | App Store Connect API 颁发者 ID | `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` |
| Key ID | API 密钥 ID | `XXXXXXXXXX` |
| Private Key (P8) | API 私钥文件内容（PEM） | `-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----` |

### 获取方式

#### 1. App Store Connect API 密钥（Issuer ID / Key ID / Private Key）

1. 登录 [App Store Connect](https://appstoreconnect.apple.com)
2. 进入 **用户和访问** → **集成** → **App Store Connect API**
3. 点击 **生成 API 密钥**，填写名称（如 `CI Upload`），选择 **Developer** 角色
4. 下载 `.p8` 私钥文件（**只能下载一次，务必妥善保存**）
5. 记录页面显示的：
   - **Issuer ID**：顶部表格中的 "Issuer ID" 列
   - **Key ID**：密钥列表中的 "密钥 ID" 列
6. Private Key 即 `.p8` 文件的完整内容

#### 2. 确保 API 密钥有 App 权限

在 App Store Connect → **用户和访问** → **App 权限** 中，确认生成的密钥关联的 App 包含你的 App，否则上传会失败。

### 上传原理

```
fastlane deliver
    ↓
App Store Connect API (api.appstoreconnect.apple.com)
    ↓ JWT 签名认证 (Key ID + Issuer ID + Private Key)
    ↓
上传 IPA → App Store Connect → 进入 TestFlight / 等待提交审核
```

核心代码（`Fastfile`）：
```ruby
deliver(
  ipa: artifact_path,              # IPA 文件路径
  apple_id: apple_id,              # 开发者账号
  app_identifier: bundle_id,       # Bundle ID
  skip_metadata: true,             # 跳过元数据
  skip_screenshots: true,          # 跳过截图
  force: true,                     # 强制上传
  run_precheck_before_submit: false,
  automatic_release: false,        # 手动发布（不自动上架）
)
```

### API 调用示例

等效的 App Store Connect API 请求（fastlane `deliver` 最终调用）：

```bash
# 1. 生成 JWT
JWT=$(ruby -r jwt -e '
payload = {
  iss: ENV["ISSUER_ID"],
  iat: Time.now.to_i,
  exp: Time.now.to_i + 1200,
  aud: "appstoreconnect-v1"
}
private_key = OpenSSL::PKey::EC.new(ENV["PRIVATE_KEY"])
puts JWT.encode(payload, private_key, "ES256", kid: ENV["KEY_ID"])
')

# 2. 获取 App 信息
curl -s "https://api.appstoreconnect.apple.com/v1/apps?filter[bundleId]=com.example.app" \
  -H "Authorization: Bearer $JWT"

# 3. 上传 IPA（由 fastlane deliver 自动处理，使用 Apple's Transporter）
# 底层等效于: xcrun altool --upload-app -f app.ipa -t ios
```

### 后端命令行拼接

```
cd <workspace>/fastlane && \
bundle exec fastlane ios publish_appstore \
  artifact_path:/path/to/app.ipa \
  apple_id:developer@example.com \
  bundle_id:com.example.app
```

### 验证是否成功

1. **Web UI**：构建详情页 → 发布状态卡片 → App Store 显示 "success" / "reviewing"
2. **App Store Connect 后台**：登录 [App Store Connect](https://appstoreconnect.apple.com) → **我的 App** → 选择 App → **TestFlight** → 查看是否有新的构建版本
3. **API 查询**：
   ```bash
   # 获取发布记录
   curl -H "Authorization: Bearer <jwt-token>" \
     "http://localhost:3000/api/publishes?platform=appstore"
   ```

---

## 蒲公英 (iOS / Android)

### 所需凭证

蒲公英通过环境变量配置，不在 Web UI 的 Platform Credential 中管理。

| 环境变量 | 说明 |
|----------|------|
| `PGYER_API_KEY` | 蒲公英 API Key（通用） |
| `PGYER_API_KEY_JIANGUO` | 账户 jianguo |
| `PGYER_API_KEY_LUPEILONG` | 账户 lupeilong |
| `PGYER_API_KEY_ALLENLI` | 账户 allenli |
| `PGYER_API_KEY_ALANWU` | 账户 alanwu |
| `PGYER_API_KEY_LB` | 账户 lb |

### 获取方式

1. 登录 [蒲公英](https://www.pgyer.com)
2. 进入 **我的应用** → 选择应用 → **API** 标签
3. 复制 **API Key**

配置到 `packages/backend/.env`：
```env
PGYER_API_KEY=your_pgyer_api_key
```

### 上传原理

```
后端 PgyerPublisher (TypeScript)
    ↓
POST https://www.pgyer.com/apiv2/app/upload
    ↓ multipart/form-data
    ↓
返回应用下载短链接
```

### 验证是否成功

API 返回的 `buildKey` 即为发布 ID，可在蒲公英后台查看。

---

## 小米应用商店

### 所需凭证

| 字段 | 说明 |
|------|------|
| App ID | 应用 ID |
| App Key | API 密钥 Key |
| App Secret | API 密钥 Secret |

### 获取方式

1. 登录 [小米开放平台](https://developer.xiaomi.com)
2. 进入 **管理中心** → 选择应用 → **应用服务** → **API 密钥**
3. 获取 **AppID**、**AppKey**、**AppSecret**

### 上传原理

```
POST https://api.developer.xiaomi.com/devupload
    ↓ multipart/form-data
    ↓ sign = MD5(appKey={appKey}&timestamp={timestamp}&appSecret={appSecret})
    ↓
上传 APK 文件
```

### API 调用示例

```bash
TIMESTAMP=$(date +%s)000
APP_KEY="your_app_key"
APP_SECRET="your_app_secret"
APP_ID="your_app_id"

SIGN=$(echo -n "appKey=${APP_KEY}&timestamp=${TIMESTAMP}&appSecret=${APP_SECRET}" | md5)

curl -s -X POST \
  "https://api.developer.xiaomi.com/devupload" \
  -F "appId=${APP_ID}" \
  -F "timestamp=${TIMESTAMP}" \
  -F "sign=${SIGN}" \
  -F "apk=@app-release.apk"
```

### 后端命令行拼接

```
cd <workspace>/fastlane && \
bundle exec fastlane android publish_xiaomi \
  artifact_path:/path/to/app.apk \
  app_id:123456 \
  app_key:abc123 \
  app_secret:def456
```

### 验证是否成功

1. 小米 API 返回上传结果，检查返回体中的状态
2. 登录 [小米开放平台](https://developer.xiaomi.com) → 应用详情 → 版本管理，确认新版本已上传

---

## 华为应用市场

### 所需凭证

| 字段 | 说明 |
|------|------|
| Client ID | API 客户端 ID |
| Client Secret | API 客户端密钥 |
| App ID | 应用 ID |

### 获取方式

1. 登录 [华为开发者联盟](https://developer.huawei.com)
2. 进入 **管理中心** → **应用服务** → **Publish API**
3. 在 **API 客户端** 中创建或获取 **Client ID** 和 **Client Secret**
4. App ID 在 **应用信息** 页面查看

### 上传原理

```
POST https://connect-api.cloud.huawei.com/api/oauth2/v1/token
    ↓ OAuth2 Client Credentials → 获取 access_token
    ↓
GET https://connect-api.cloud.huawei.com/api/publish/v2/upload-url
    ↓ 携带 access_token + appId → 获取上传 URL
    ↓
PUT {upload_url}
    ↓ 直传 APK 文件
```

### API 调用示例

```bash
CLIENT_ID="your_client_id"
CLIENT_SECRET="your_client_secret"
APP_ID="your_app_id"

# 1) 获取 access token
TOKEN=$(curl -s -X POST \
  "https://connect-api.cloud.huawei.com/api/oauth2/v1/token" \
  -H "Content-Type: application/json" \
  -d "{\"grant_type\":\"client_credentials\",\"client_id\":\"${CLIENT_ID}\",\"client_secret\":\"${CLIENT_SECRET}\"}" | \
  jq -r '.access_token')

# 2) 获取上传 URL
UPLOAD_URL=$(curl -s -X GET \
  "https://connect-api.cloud.huawei.com/api/publish/v2/upload-url" \
  -H "Authorization: Bearer ${TOKEN}" \
  -d "appId=${APP_ID}" \
  -d "suffix=apk" | \
  jq -r '.uploadUrl')

# 3) 上传文件
curl -s -X PUT "${UPLOAD_URL}" \
  -H "Content-Type: application/octet-stream" \
  --data-binary "@app-release.apk"
```

### 后端命令行拼接

```
cd <workspace>/fastlane && \
bundle exec fastlane android publish_huawei \
  artifact_path:/path/to/app.apk \
  client_id:abc \
  client_secret:def \
  app_id:123456
```

### 验证是否成功

1. 华为 API 三步均返回成功（token 200、upload URL 200、PUT 200）
2. 登录 [华为开发者联盟](https://developer.huawei.com) → 应用详情 → 版本管理，确认新版本存在

---

## 荣耀应用市场

### 所需凭证

| 字段 | 说明 |
|------|------|
| Client ID | API 客户端 ID |
| Client Secret | API 客户端密钥 |
| App ID | 应用 ID |

### 获取方式

1. 登录 [荣耀开发者平台](https://developer.honor.com)
2. 进入 **管理中心** → **API 管理**
3. 创建或获取 **Client ID** 和 **Client Secret**
4. App ID 在 **应用信息** 查看

### 上传原理

与华为相同的 OAuth2 + 获取上传 URL 模式：

```
POST https://connect-api.cloud.honor.com/api/oauth2/v1/token → access_token
GET  https://connect-api.cloud.honor.com/api/publish/v2/upload-url → upload_url
PUT  {upload_url} → APK 文件
```

### API 调用示例

```bash
# 与华为完全一致，仅域名不同
CLIENT_ID="your_client_id"
CLIENT_SECRET="your_client_secret"
APP_ID="your_app_id"

TOKEN=$(curl -s -X POST \
  "https://connect-api.cloud.honor.com/api/oauth2/v1/token" \
  -H "Content-Type: application/json" \
  -d "{\"grant_type\":\"client_credentials\",\"client_id\":\"${CLIENT_ID}\",\"client_secret\":\"${CLIENT_SECRET}\"}" | \
  jq -r '.access_token')

UPLOAD_URL=$(curl -s -X GET \
  "https://connect-api.cloud.honor.com/api/publish/v2/upload-url" \
  -H "Authorization: Bearer ${TOKEN}" \
  -d "appId=${APP_ID}" \
  -d "suffix=apk" | \
  jq -r '.uploadUrl')

curl -s -X PUT "${UPLOAD_URL}" \
  -H "Content-Type: application/octet-stream" \
  --data-binary "@app-release.apk"
```

### 后端命令行拼接

```
cd <workspace>/fastlane && \
bundle exec fastlane android publish_honor \
  artifact_path:/path/to/app.apk \
  client_id:abc \
  client_secret:def \
  app_id:123456
```

### 验证是否成功

登录 [荣耀开发者平台](https://developer.honor.com) → 应用详情 → 版本管理，确认新版本已上传。

---

## OPPO 软件商店

### 所需凭证

| 字段 | 说明 |
|------|------|
| App Key | API Key |
| App Secret | API Secret |
| Package Name | 应用包名 |

### 获取方式

1. 登录 [OPPO 开放平台](https://open.oppomobile.com)
2. 进入 **管理中心** → 选择应用 → **开发服务** → **API 管理**
3. 获取 **AppKey** 和 **AppSecret**
4. Package Name 即你的 APK 包名，如 `com.example.app`

### 上传原理

```
POST https://oop-openapi.heytapmobi.com/resource/v1/app/upApk
    ↓ multipart/form-data
    ↓ sign = MD5(appKey={key}&timestamp={ts}&appSecret={secret})
    ↓
上传 APK
```

### API 调用示例

```bash
APP_KEY="your_app_key"
APP_SECRET="your_app_secret"
PACKAGE_NAME="com.example.app"
TIMESTAMP=$(date +%s)

SIGN=$(echo -n "appKey=${APP_KEY}&timestamp=${TIMESTAMP}&appSecret=${APP_SECRET}" | md5)

curl -s -X POST \
  "https://oop-openapi.heytapmobi.com/resource/v1/app/upApk" \
  -F "appKey=${APP_KEY}" \
  -F "timestamp=${TIMESTAMP}" \
  -F "sign=${SIGN}" \
  -F "packageName=${PACKAGE_NAME}" \
  -F "apk=@app-release.apk"
```

### 后端命令行拼接

```
cd <workspace>/fastlane && \
bundle exec fastlane android publish_oppo \
  artifact_path:/path/to/app.apk \
  app_key:abc \
  app_secret:def \
  package_name:com.example.app
```

### 验证是否成功

登录 [OPPO 开放平台](https://open.oppomobile.com) → 应用详情 → 版本管理。

---

## VIVO 应用商店

### 所需凭证

| 字段 | 说明 |
|------|------|
| Access Key | API 访问密钥 |
| Access Secret | API 访问密钥 Secret |
| Package Name | 应用包名 |

### 获取方式

1. 登录 [VIVO 开放平台](https://developer.vivo.com.cn)
2. 进入 **管理中心** → 选择应用 → **API 管理**
3. 获取 **AccessKey** 和 **AccessSecret**
4. Package Name 即包名

### 上传原理

```
POST https://developer-api.vivo.com.cn/router/rest
    ↓ multipart/form-data
    ↓ sign = MD5(access_key={key}&timestamp={ts}&access_secret={secret})
    ↓ method=app.upload.apk
    ↓
上传 APK
```

### API 调用示例

```bash
ACCESS_KEY="your_access_key"
ACCESS_SECRET="your_access_secret"
PACKAGE_NAME="com.example.app"
TIMESTAMP=$(($(date +%s) * 1000))

SIGN=$(echo -n "access_key=${ACCESS_KEY}&timestamp=${TIMESTAMP}&access_secret=${ACCESS_SECRET}" | md5)

curl -s -X POST \
  "https://developer-api.vivo.com.cn/router/rest" \
  -F "access_key=${ACCESS_KEY}" \
  -F "timestamp=${TIMESTAMP}" \
  -F "sign=${SIGN}" \
  -F "method=app.upload.apk" \
  -F "package_name=${PACKAGE_NAME}" \
  -F "apk=@app-release.apk"
```

### 后端命令行拼接

```
cd <workspace>/fastlane && \
bundle exec fastlane android publish_vivo \
  artifact_path:/path/to/app.apk \
  access_key:abc \
  access_secret:def \
  package_name:com.example.app
```

### 验证是否成功

登录 [VIVO 开放平台](https://developer.vivo.com.cn) → 应用详情 → 版本管理。

---

## 应用宝 (腾讯)

### 所需凭证

| 字段 | 说明 |
|------|------|
| Organization ID | 组织/开发者 ID |
| App Key | API 密钥 |

### 获取方式

1. 登录 [腾讯开放平台](https://open.qq.com)
2. 进入 **管理中心** → 选择应用 → **API 管理**
3. 获取 **Organization ID** 和 **AppKey**

### 上传原理

```
POST https://api.open.qq.com/v3/android/apk
    ↓ multipart/form-data
    ↓ sign = MD5(appKey={key}&timestamp={ts})
    ↓
上传 APK
```

### API 调用示例

```bash
APP_KEY="your_app_key"
ORGANIZATION_ID="your_org_id"
TIMESTAMP=$(date +%s)

SIGN=$(echo -n "appKey=${APP_KEY}&timestamp=${TIMESTAMP}" | md5)

curl -s -X POST \
  "https://api.open.qq.com/v3/android/apk" \
  -F "organizationId=${ORGANIZATION_ID}" \
  -F "timestamp=${TIMESTAMP}" \
  -F "sign=${SIGN}" \
  -F "apk=@app-release.apk"
```

### 后端命令行拼接

```
cd <workspace>/fastlane && \
bundle exec fastlane android publish_tencent \
  artifact_path:/path/to/app.apk \
  organization_id:123456 \
  app_key:abc
```

### 验证是否成功

登录 [腾讯开放平台](https://open.qq.com) → 应用详情 → 版本管理。

---

## 360 手机助手

### 所需凭证

| 字段 | 说明 |
|------|------|
| Access Token | API 访问令牌 |
| App ID | 应用 ID |

### 获取方式

1. 登录 [360 移动开放平台](https://dev.360.cn)
2. 进入 **管理中心** → 选择应用 → **API 管理**
3. 获取 **Access Token**
4. App ID 在应用信息中查看

### 上传原理

```
POST https://dev.360.cn/api/upload
    ↓ multipart/form-data
    ↓ access_token + app_id + apk
```

### API 调用示例

```bash
ACCESS_TOKEN="your_access_token"
APP_ID="your_app_id"

curl -s -X POST \
  "https://dev.360.cn/api/upload" \
  -F "access_token=${ACCESS_TOKEN}" \
  -F "app_id=${APP_ID}" \
  -F "apk=@app-release.apk"
```

### 后端命令行拼接

```
cd <workspace>/fastlane && \
bundle exec fastlane android publish_qihu360 \
  artifact_path:/path/to/app.apk \
  access_token:abc \
  app_id:123456
```

### 验证是否成功

登录 [360 移动开放平台](https://dev.360.cn) → 应用详情 → 版本管理。

---

## 三星应用商店

### 所需凭证

| 字段 | 说明 |
|------|------|
| Access Token | API 访问令牌 |
| App ID | 应用 ID |

### 获取方式

1. 登录 [三星卖家平台](https://seller.samsungapps.com)
2. 进入 **API 管理**
3. 获取 **Access Token**
4. App ID 在应用信息中查看

### 上传原理

```
POST https://seller.samsungapps.com/api/app/upload
    ↓ Authorization: Bearer {access_token}
    ↓ multipart/form-data
    ↓ appId + apk
```

### API 调用示例

```bash
ACCESS_TOKEN="your_access_token"
APP_ID="your_app_id"

curl -s -X POST \
  "https://seller.samsungapps.com/api/app/upload" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -F "appId=${APP_ID}" \
  -F "apk=@app-release.apk"
```

### 后端命令行拼接

```
cd <workspace>/fastlane && \
bundle exec fastlane android publish_samsung \
  artifact_path:/path/to/app.apk \
  access_token:abc \
  app_id:123456
```

### 验证是否成功

登录 [三星卖家平台](https://seller.samsungapps.com) → 应用详情 → 版本管理。

---

## 验证发布结果

### 方式一：Web UI

1. **实时状态**：构建详情页 (`/builds/:id`) 底部显示各平台发布状态卡片
   - `pending` (灰色) → 等待上传
   - `uploading` (蓝色/转圈) → 正在上传
   - `success` (绿色) → 上传成功
   - `failed` (红色) → 上传失败
   - `reviewing` (黄色) → 已提交审核（App Store / Honor / Huawei 等）

2. **发布管理页**：`/publishes` 按平台/状态筛选所有发布记录

### 方式二：REST API

```bash
# 查看某次构建的发布记录
curl -H "Authorization: Bearer <jwt-token>" \
  "http://localhost:3000/api/publishes/build/{buildId}"

# 查看所有发布记录（支持筛选）
curl -H "Authorization: Bearer <jwt-token>" \
  "http://localhost:3000/api/publishes?platform=xiaomi&status=success&page=1&limit=20"

# 重新发布到指定平台
curl -X POST -H "Authorization: Bearer <jwt-token>" \
  -H "Content-Type: application/json" \
  -d '{"platforms":["xiaomi","huawei"]}' \
  "http://localhost:3000/api/publishes/build/{buildId}/republish"
```

### 方式三：各平台后台

| 平台 | 验证入口 |
|------|---------|
| App Store Connect | TestFlight / 构建版本列表 |
| 蒲公英 | 应用详情 → 版本列表 |
| 小米 | 开放平台 → 版本管理 |
| 华为 | 开发者联盟 → 版本管理 |
| 荣耀 | 开发者平台 → 版本管理 |
| OPPO | 开放平台 → 版本管理 |
| VIVO | 开放平台 → 版本管理 |
| 应用宝 | 开放平台 → 版本管理 |
| 360 | 移动开放平台 → 版本管理 |
| 三星 | 卖家平台 → 版本管理 |

### 方式四：后端日志

```bash
# 发布日志（Fastlane 输出）
# 后端日志中搜索关键字：
# - "Fastlane output:" — fastlane 命令执行输出
# - "Executing fastlane:" — fastlane 开始执行
# - "Uploaded to" — 上传成功标记
# - "Fastlane upload failed" — 上传失败
```

### 常见失败原因

| 现象 | 可能原因 |
|------|---------|
| "Unknown fastlane platform" | 平台名拼写错误 |
| "Artifact file not found" | 构建产物路径不正确，检查构建是否成功 |
| "required" | 凭证不完整，检查是否有未填写的必需字段 |
| curl 401/403 | Access Token / Key 过期或无效 |
| curl timeout | 网络问题或厂商服务器不可达 |
| App Store Connect 403 | API 密钥权限不足，检查 App 权限是否关联 |
| App Store Connect 401 | Issuer ID / Key ID / Private Key 不匹配 |
| MD5 sign 失败 | 签名算法与厂商要求不一致 |
