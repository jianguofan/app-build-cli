# App Build Platform - 自动化打包发布平台

## 概述

为 Lava App 项目构建一个完全容器化的自动化打包发布平台，支持 iOS 和 Android 多渠道构建与发布。

## 背景

### 当前状况
- **项目**: Flutter 应用（lava-app），支持 iOS + Android
- **渠道**: oversea（海外）和 cn（国内）两个 flavor
- **环境**: dev、pre、prod 三种环境
- **现有工具**: `build_app.sh` 脚本处理构建和蒲公英上传
- **发布方式**: 
  - iOS: 手动使用 `xcrun altool` 上传到 App Store
  - Android: 仅上传到蒲公英，未集成厂商商店

### 问题
1. 构建过程依赖手动执行脚本
2. 非技术人员（产品、测试）无法独立触发构建
3. Android 厂商商店（小米、华为、VIVO、OPPO 等）需要手动上传
4. 缺乏构建历史记录和状态追踪
5. 没有统一的权限管理和审批流程

## 目标

构建一个现代化的自动化打包发布平台，具备以下特性：

### 核心功能
1. **Web 管理界面**: 产品、测试、开发都能使用的友好界面
2. **一键构建**: 选择配置后一键触发构建任务
3. **全平台发布**: 
   - iOS: App Store Connect
   - Android: 蒲公英 + 小米 + 华为 + VIVO + OPPO + 应用宝 + 360
4. **实时日志**: WebSocket 推送构建日志
5. **构建历史**: 完整的构建记录和产物管理
6. **权限控制**: 基于角色的访问控制（RBAC）

### 技术要求
1. **完全容器化**: 所有服务运行在 Docker 中，不污染宿主机环境
2. **可移植性**: 打包成镜像后可在任何 Mac 上运行
3. **环境隔离**: 构建在隔离的工作空间中执行
4. **技术栈**: React + NestJS + TypeScript + PostgreSQL

## 架构设计

### 系统架构

```
┌─────────────────────────────────────────────────────────────────┐
│                      宿主机 (Mac)                                 │
│                                                                   │
│  系统环境 (不污染):                                                │
│  • Xcode, Android Studio, Flutter SDK                           │
│                                                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │           Docker Compose 容器集群                           │ │
│  │                                                             │ │
│  │  ┌─────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │ │
│  │  │ Nginx   │  │ Frontend │  │ Backend  │  │ Postgres │   │ │
│  │  │ :80     │  │ React    │  │ NestJS   │  │ :5432    │   │ │
│  │  └─────────┘  └──────────┘  └──────────┘  └──────────┘   │ │
│  │                                    │                        │ │
│  │                              ┌─────┴─────┐                 │ │
│  │                              │   Redis   │                 │ │
│  │                              │  (Queue)  │                 │ │
│  │                              └───────────┘                 │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                    │                             │
│                                    │ SSH 到 localhost             │
│                                    ▼                             │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  隔离工作空间: ~/app-build-workspace/                       │ │
│  │  ├── projects/  (项目源码副本)                              │ │
│  │  ├── builds/    (构建产物)                                  │ │
│  │  ├── logs/      (构建日志)                                  │ │
│  │  └── cache/     (构建缓存)                                  │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### 技术栈

**前端**:
- React 18 + TypeScript
- Ant Design 5.x (UI 组件库)
- Zustand (状态管理)
- Socket.io (实时日志)
- Vite (构建工具)

**后端**:
- NestJS + TypeScript
- Prisma (ORM)
- PostgreSQL 15 (数据库)
- Bull + Redis (任务队列)
- Socket.io (WebSocket)
- Passport + JWT (认证)

**构建层**:
- 复用现有 `build_app.sh`
- SSH 连接宿主机执行构建
- Fastlane (可选，用于厂商 API 集成)

**部署**:
- Docker + Docker Compose
- Nginx (反向代理)

### 核心流程

#### 构建流程
```
1. 用户在 Web 界面创建构建任务
   ↓
2. 后端将任务加入 Bull 队列
   ↓
3. Queue Processor 处理任务:
   a. 通过 SSH 连接到 localhost (宿主机)
   b. 在隔离工作空间准备项目副本
   c. 执行 build_app.sh 脚本
   d. 实时推送日志到前端 (WebSocket)
   e. 收集构建产物
   ↓
4. 构建完成后触发发布流程
   ↓
5. 根据配置上传到各个平台:
   - 蒲公英 (已有代码)
   - App Store Connect (API)
   - Android 厂商商店 (各厂商 API)
   ↓
6. 更新任务状态，发送通知
```

#### 发布流程
```
Android 厂商发布流程:
1. 获取上传凭证 (API Token)
2. 上传 APK/AAB 文件
3. 提交审核信息 (版本说明、截图等)
4. 轮询审核状态
5. 审核通过后发布上线 (部分厂商需要)
```

## 功能模块

### 1. 构建任务管理
- 创建构建任务 (选择平台、环境、flavor)
- 任务队列管理 (排队、执行中、已完成)
- 实时日志查看 (WebSocket 推送)
- 构建产物下载

### 2. 发布管理
- 蒲公英自动上传
- App Store Connect 上传
- Android 厂商商店上传
- 发布状态追踪

### 3. 配置管理
- 渠道配置 (oversea / cn)
- 环境配置 (dev / pre / prod)
- 凭证管理 (API Key、证书等，加密存储)
- 通知配置 (钉钉、企业微信、邮件)

### 4. 用户权限
- 角色管理 (开发、测试、产品、管理员)
- 权限控制 (谁能触发生产环境构建)
- 操作审计日志

### 5. 数据统计
- 构建历史记录
- 成功率统计
- 构建时长分析
- 版本发布时间线

## 数据模型

### 核心表结构

**users** - 用户表
- id, username, password_hash, role, created_at

**build_tasks** - 构建任务表
- id, task_name, platform, flavor, build_mode, env
- language, region, status, created_by
- started_at, finished_at, log_file, artifacts

**publish_records** - 发布记录表
- id, build_task_id, target, status
- download_url, audit_id, error_message, published_at

**configs** - 配置表
- id, key, value (JSONB), description, updated_by

**credentials** - 凭证表 (加密存储)
- id, name, type, encrypted_data, created_by

## 实施计划

### 第一周: 基础框架搭建
- **Day 1-2**: 项目初始化
  - 创建 monorepo 结构
  - 配置 Docker Compose
  - 搭建 NestJS 后端骨架
  - 搭建 React 前端骨架

- **Day 3-4**: 核心功能开发
  - 用户认证和权限系统
  - 构建任务 CRUD API
  - 任务队列集成 (Bull)
  - 前端基础页面

- **Day 5**: 构建执行器
  - SSH 连接宿主机
  - 集成现有 build_app.sh
  - 实时日志推送

### 第二周: 发布集成
- **Day 1**: iOS 发布
  - App Store Connect API
  - 蒲公英上传 (复用现有代码)

- **Day 2-3**: Android 主流厂商
  - 小米开放平台
  - 华为 AppGallery
  - 应用宝

- **Day 4**: Android 其他厂商
  - VIVO
  - OPPO
  - 360 (可选)

- **Day 5**: 测试和优化
  - 端到端测试
  - 错误处理
  - 性能优化

### 第三周: 完善和部署
- **Day 1-2**: UI/UX 优化
  - 仪表盘数据可视化
  - 构建历史查询
  - 通知功能

- **Day 3**: 文档编写
  - 部署文档
  - 用户手册
  - API 文档

- **Day 4-5**: 部署和培训
  - 在 Mac 上部署
  - 团队培训
  - 试运行

## 技术挑战与解决方案

### 挑战 1: Docker 中无法直接运行 Xcode
**解决方案**: 
- 容器通过 SSH 连接到宿主机 localhost
- 在宿主机的隔离工作空间执行构建
- 容器负责调度和日志收集

### 挑战 2: 环境隔离
**解决方案**:
- 创建独立的工作目录 `~/app-build-workspace`
- 每次构建复制项目到独立子目录
- 构建完成后清理或保留产物

### 挑战 3: Android 厂商 API 差异
**解决方案**:
- 抽象 Publisher 基类
- 每个厂商实现独立的 Publisher
- 统一的错误处理和重试机制

### 挑战 4: 实时日志推送
**解决方案**:
- 使用 Socket.io 建立 WebSocket 连接
- 构建进程的 stdout/stderr 实时推送
- 前端使用虚拟滚动处理大量日志

## 部署要求

### 宿主机要求
- macOS (支持 Xcode)
- 64GB 内存
- Docker Desktop
- Xcode、Android Studio、Flutter SDK 已安装
- 启用远程登录 (SSH)

### 网络要求
- 访问各厂商 API (需要外网)
- 如果需要团队访问，配置内网穿透或 VPN

### 安全要求
- API 凭证加密存储
- JWT 认证
- HTTPS (生产环境)
- 操作审计日志

## 成功标准

1. ✅ 产品、测试、开发都能通过 Web 界面触发构建
2. ✅ 支持 iOS + Android 全平台构建
3. ✅ 自动发布到 7+ 个平台 (蒲公英、App Store、小米、华为、VIVO、OPPO、应用宝)
4. ✅ 实时查看构建日志
5. ✅ 完整的构建历史和产物管理
6. ✅ 基于角色的权限控制
7. ✅ 完全容器化，可在任何 Mac 上部署
8. ✅ 构建成功率 > 95%
9. ✅ 平均构建时间 < 20 分钟

## 风险与缓解

### 风险 1: Android 厂商 API 不稳定
**缓解**: 
- 实现重试机制
- 提供手动上传备选方案
- 详细的错误日志

### 风险 2: 构建时间过长
**缓解**:
- 使用构建缓存
- 并行构建 iOS 和 Android
- 增量构建 (如果可能)

### 风险 3: 证书和签名问题
**缓解**:
- 证书过期提醒
- 详细的错误提示
- 文档说明证书配置

## 后续迭代

### Phase 2 (可选)
- 灰度发布支持
- A/B 测试集成
- 崩溃监控集成 (Sentry)
- 性能监控
- 自动化测试集成

### Phase 3 (可选)
- 多机器支持 (构建集群)
- 构建优先级队列
- 定时构建
- Git Webhook 触发

## 参考资料

- [App Store Connect API](https://developer.apple.com/documentation/appstoreconnectapi)
- [小米开放平台 API](https://dev.mi.com/distribute/doc/details?pId=1134)
- [华为 AppGallery Connect API](https://developer.huawei.com/consumer/cn/doc/development/AppGallery-connect-Guides/agcapi-getstarted)
- [蒲公英 API](https://www.pgyer.com/doc/view/api)
- [Fastlane](https://fastlane.tools/)
- [NestJS](https://nestjs.com/)
- [Prisma](https://www.prisma.io/)
