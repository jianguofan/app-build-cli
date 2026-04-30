# App Build Platform

自动化打包发布平台，支持 iOS 和 Android 多渠道构建与发布。

## 功能特性

- 🚀 **一键构建**: Web 界面创建构建任务，自动执行打包
- 📱 **多平台支持**: iOS (App Store + 蒲公英) 和 Android (小米、华为、VIVO、OPPO、应用宝等)
- 📊 **实时日志**: WebSocket 推送构建日志，实时查看进度
- 🔐 **权限控制**: 基于角色的访问控制 (Phase 2)
- 🐳 **完全容器化**: Docker Compose 一键部署

## 技术栈

### 前端
- React 18 + TypeScript
- Ant Design 5.x
- Zustand (状态管理)
- Socket.io (实时通信)
- Vite (构建工具)

### 后端
- NestJS + TypeScript
- Bull + Redis (任务队列)
- Socket.io (WebSocket)
- JWT (认证)
- node-ssh (SSH 连接)

### 部署
- Docker + Docker Compose
- Nginx (反向代理)

## 快速开始

### 前置要求

- Node.js >= 18.0.0
- Docker Desktop
- macOS (用于 iOS 构建)
- Xcode、Android Studio、Flutter SDK 已安装

### 安装依赖

```bash
npm install
```

### 开发模式

```bash
# 启动前后端开发服务器
npm run dev

# 单独启动后端
npm run dev:backend

# 单独启动前端
npm run dev:frontend
```

### 生产部署

```bash
# 构建所有包
npm run build

# 启动 Docker Compose
docker-compose up -d
```

访问 http://localhost 即可使用。

### 默认账号

- 用户名: `admin`
- 密码: `snapmaker@2016`

## 项目结构

```
app-build-platform/
├── packages/
│   ├── backend/          # NestJS 后端
│   └── frontend/         # React 前端
├── .docker/              # Docker 相关配置
├── docs/                 # 文档
├── docker-compose.yml    # Docker Compose 配置
└── package.json          # Monorepo 配置
```

## 配置

### 环境变量

创建 `.env` 文件：

```env
# SSH 配置
SSH_USER=your_username
SSH_KEY_PATH=/path/to/ssh/key

# Git 仓库
GIT_REPO_URL=https://github.com/your-org/your-repo.git

# Redis
REDIS_HOST=redis
REDIS_PORT=6379

# JWT
JWT_SECRET=your-secret-key

# 工作空间
WORKSPACE_DIR=~/app-build-workspace
```

### API 凭证配置

在 Web 界面的配置管理页面添加各平台的 API 凭证：

- **蒲公英**: API Key
- **App Store Connect**: Issuer ID, Key ID, Private Key
- **小米**: App ID, App Key, App Secret
- **华为**: Client ID, Client Secret, App ID
- **腾讯应用宝**: Organization ID, App Key
- **VIVO**: Access Key, Access Secret
- **OPPO**: App Key, App Secret

## 开发指南

### 代码规范

```bash
# 格式化代码
npm run format

# 检查格式
npm run format:check

# 代码检查
npm run lint
```

### 提交规范

使用 Conventional Commits 规范：

- `feat`: 新功能
- `fix`: 修复 bug
- `docs`: 文档更新
- `style`: 代码格式调整
- `refactor`: 重构
- `test`: 测试相关
- `chore`: 构建/工具相关

## 文档

- [架构设计](./docs/architecture.md)
- [API 文档](./docs/api.md)
- [部署指南](./docs/deployment.md)
- [故障排查](./docs/troubleshooting.md)

## 路线图

### Phase 1: 核心功能 ✅
- [x] 项目初始化
- [ ] 构建任务管理
- [ ] 实时日志查看
- [ ] iOS/Android 发布集成

### Phase 2: 高级功能
- [ ] 数据库持久化
- [ ] 多用户和权限管理
- [ ] 统计分析仪表盘
- [ ] 通知系统
- [ ] 定时构建和 Webhook

## 许可证

MIT

## 联系方式

如有问题或建议，请提交 Issue。
