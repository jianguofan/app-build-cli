## Why

当前项目为 7 家应用商店（App Store、小米、华为、OPPO、VIVO、应用宝、360）各自手写了 API 客户端，每个 ~70 行，核心逻辑重复且全部处于 Phase 1 模拟状态。Fastlane 已成熟封装了这些厂商 API，社区持续维护跟进接口变更。自行维护 7 套 API 集成成本高且容易因厂商 API 变动而失效，应改用 Fastlane 统一处理。

## What Changes

- **新增** Fastlane Fastfile 到项目根目录，集成 iOS (deliver) + Android (supply + 各厂商 plugin)
- **新增** `FastlanePublisher` 替代 7 个自研 publisher 类，通过 SSH 执行 `fastlane` 命令完成上传
- **保留** `PgyerPublisher` 不变（蒲公英 API 极简，Fastlane 无对应 plugin，自研维护成本为零）
- **删除** `AppStorePublisher`、`XiaomiPublisher`、`HuaweiPublisher`、`TencentPublisher`、`VivoPublisher`、`OppoPublisher`、`QihuPublisher` 共 7 个类，及对应的 `publish.module.ts` 中的注册和 `publish.service.ts` 中的 switch-case 分支
- **BREAKING**: 配置方式变更 — 各商店 API 凭证不再由后端环境变量管理，改为 Fastlane 环境变量 / Fastfile 内配置

## Capabilities

### New Capabilities
- `fastlane-publish`: 通过 Fastlane 统一发布 iOS 到 App Store Connect、Android 到小米/华为/OPPO/VIVO/应用宝/360 等厂商商店，后端通过 SSH 远程执行 fastlane 命令驱动

### Modified Capabilities
- `pgyer-publish`: 蒲公英发布逻辑不变，维持自研 HTTP 集成

## Impact

- **后端文件**: 删除 `packages/backend/src/modules/publish/publishers/` 下除 `pgyer.publisher.ts` 和 `base.publisher.ts` 外的所有文件，简化 `publish.service.ts` 和 `publish.module.ts`
- **脚本文件**: 项目根目录新增 `fastlane/` 目录（Fastfile + Appfile），`build_app.sh` 可选增加 fastlane lane 调用
- **依赖**: 宿主机需安装 Fastlane（Ruby gem），Docker 容器无需变更
- **配置**: 各商店凭证从后端环境变量迁移到 Fastlane 环境变量（如 `APP_STORE_CONNECT_API_KEY`、`MI_APP_ID` 等）
