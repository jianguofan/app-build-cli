# Deployment Guide

## 部署概述

本文档描述如何在 macOS 上部署 App Build Platform。

---

## 系统要求

### 硬件要求

- **CPU**: 4 核心或更多
- **内存**: 16GB 或更多（推荐 32GB）
- **磁盘**: 100GB 可用空间（用于构建产物和缓存）

### 软件要求

- **操作系统**: macOS 12.0 或更高版本
- **Docker Desktop**: 最新版本
- **Node.js**: 18.0 或更高版本
- **Ruby**: >= 2.7 + Bundler（Fastlane 运行环境）
- **Xcode**: 最新版本（iOS 构建）
- **Android Studio**: 最新版本（Android 构建）
- **Flutter SDK**: 最新稳定版本

---

## 安装步骤

### 1. 安装前置软件

```bash
# 安装 Homebrew（如果没有）
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# 安装 Node.js
brew install node@18

# 安装 Docker Desktop
# 从 https://www.docker.com/products/docker-desktop 下载并安装

# 安装 Ruby 和 Bundler（用于 Fastlane 发布）
brew install ruby@3
gem install bundler

# 验证安装
node --version  # 应该显示 v18.x.x
docker --version
docker-compose --version
ruby --version
bundler --version
```

### 2. 配置 SSH

```bash
# 启用远程登录
sudo systemsetup -setremotelogin on

# 生成 SSH 密钥（如果没有）
ssh-keygen -t rsa -b 4096 -f ~/.ssh/id_rsa -N ""

# 添加公钥到 authorized_keys
cat ~/.ssh/id_rsa.pub >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys

# 测试 SSH 连接
ssh -o StrictHostKeyChecking=no localhost "echo 'SSH connection successful'"
```

### 3. 克隆项目

```bash
# 克隆项目（或解压发布包）
cd ~/code
git clone <repository-url> app-build-platform
cd app-build-platform
```

### 4. 配置环境变量

```bash
# 复制环境变量模板
cp packages/backend/.env.example packages/backend/.env

# 编辑配置文件
nano packages/backend/.env
```

**必需配置**:
```bash
# SSH 配置
SSH_USER=your_username          # 你的 macOS 用户名
SSH_KEY_PATH=/Users/your_username/.ssh/id_rsa

# Git 仓库
GIT_REPO_URL=https://github.com/your-org/lava-app.git

# JWT Secret（生产环境请修改）
JWT_SECRET=your-super-secret-jwt-key-change-me

# 工作空间
WORKSPACE_DIR=/Users/your_username/app-build-workspace
```

**可选配置**（发布功能）:
```bash
# 蒲公英
PGYER_API_KEY=your_pgyer_api_key

# App Store Connect 和各 Android 应用商店的 API 凭证
# 不再在此文件中配置，改为通过 Web 界面管理：
# 登录系统 → 系统配置 → 发布平台配置 → 点击「配置」填写凭证
```

### 5. 创建工作空间

```bash
# 创建工作空间目录
mkdir -p ~/app-build-workspace/{projects,builds/{ios,android},logs}

# 设置权限
chmod -R 755 ~/app-build-workspace
```

### 6. 安装 Fastlane

```bash
# 安装 Fastlane 及其依赖
cd fastlane
bundle install
cd ..
```

### 7. 安装项目依赖

```bash
# 安装项目依赖
npm install
```

### 8. 启动服务

```bash
# 启动 Docker Compose
docker-compose up -d

# 查看服务状态
docker-compose ps

# 查看日志
docker-compose logs -f
```

### 9. 配置发布凭证

登录 Web 界面后，进入 **系统配置 → 发布平台配置**，为各应用商店添加 API 凭证：
- App Store Connect: 需要 Apple ID、Bundle ID、Issuer ID、Key ID、Private Key
- 小米/华为/OPPO/VIVO/应用宝/360: 按表单字段填写对应平台的 App ID、Key、Secret 等

凭证保存后启用该平台开关，后续生产环境构建完成后将自动发布到已启用的平台。

### 10. 验证部署

```bash
# 检查后端健康状态
curl http://localhost/api/health

# 预期输出:
# {"status":"ok","timestamp":"...","uptime":...,"memory":{...}}

# 访问前端
open http://localhost
```

---

## 配置说明

### Docker Compose 配置

**docker-compose.yml** 包含以下服务:

- **nginx**: 反向代理（端口 80）
- **frontend**: React 前端应用
- **backend**: NestJS 后端服务
- **redis**: 任务队列存储

### 端口映射

- `80`: Nginx（HTTP）
- `3000`: Backend API（内部）
- `6379`: Redis（内部）

### 数据持久化

**Phase 1**:
- 构建产物: `~/app-build-workspace/builds/`
- 构建日志: `~/app-build-workspace/logs/`
- Redis 数据: Docker volume `redis-data`

**Phase 2**:
- 添加 PostgreSQL 数据持久化

---

## 常用命令

### 服务管理

```bash
# 启动所有服务
docker-compose up -d

# 停止所有服务
docker-compose down

# 重启服务
docker-compose restart

# 查看服务状态
docker-compose ps

# 查看日志
docker-compose logs -f [service_name]

# 进入容器
docker-compose exec backend sh
docker-compose exec frontend sh
```

### 更新部署

```bash
# 拉取最新代码
git pull

# 重新构建镜像
docker-compose build

# 重启服务
docker-compose up -d
```

### 清理

```bash
# 停止并删除容器
docker-compose down

# 删除所有数据（包括 volumes）
docker-compose down -v

# 清理工作空间
rm -rf ~/app-build-workspace/*
```

---

## 故障排查

### 问题 1: 服务无法启动

**症状**: `docker-compose up` 失败

**可能原因**:
- Docker Desktop 未运行
- 端口 80 被占用
- 配置文件错误

**解决方法**:
```bash
# 检查 Docker 状态
docker info

# 检查端口占用
lsof -i :80

# 查看详细错误日志
docker-compose logs backend
```

### 问题 2: SSH 连接失败

**症状**: 构建任务失败，日志显示 SSH 连接错误

**可能原因**:
- SSH 服务未启用
- SSH 密钥配置错误
- 用户名或路径错误

**解决方法**:
```bash
# 检查 SSH 服务
sudo systemsetup -getremotelogin

# 测试 SSH 连接
ssh localhost

# 检查环境变量
docker-compose exec backend env | grep SSH
```

### 问题 3: 构建超时

**症状**: 构建任务长时间运行后失败

**可能原因**:
- 网络问题导致依赖下载慢
- 构建脚本错误
- 资源不足

**解决方法**:
```bash
# 检查系统资源
top

# 检查 Docker 资源限制
docker stats

# 增加超时时间（修改 build.processor.ts）
```

### 问题 4: WebSocket 连接失败

**症状**: 日志不实时更新

**可能原因**:
- Nginx 配置问题
- 防火墙阻止
- 浏览器不支持

**解决方法**:
```bash
# 检查 Nginx 配置
docker-compose exec nginx cat /etc/nginx/nginx.conf

# 检查 WebSocket 连接
# 浏览器开发者工具 -> Network -> WS
```

---

## 安全建议

### 生产环境

1. **修改默认密码**:
   - Phase 2 支持多用户后，立即修改默认密码

2. **使用 HTTPS**:
   ```bash
   # 使用 Let's Encrypt 获取证书
   # 更新 nginx.conf 配置 SSL
   ```

3. **限制访问**:
   - 配置防火墙规则
   - 使用 VPN 或内网访问

4. **加密敏感数据**:
   - API 密钥使用环境变量
   - Phase 2 使用数据库加密存储

5. **定期备份**:
   ```bash
   # 备份工作空间
   tar -czf backup-$(date +%Y%m%d).tar.gz ~/app-build-workspace
   
   # 备份 Redis 数据
   docker-compose exec redis redis-cli SAVE
   ```

---

## 性能优化

### 1. 增加 Docker 资源

Docker Desktop -> Settings -> Resources:
- CPU: 4+ 核心
- Memory: 8GB+
- Disk: 100GB+

### 2. 使用构建缓存

```bash
# 配置 Flutter 缓存
export PUB_CACHE=~/app-build-workspace/cache/pub
export FLUTTER_CACHE=~/app-build-workspace/cache/flutter
```

### 3. 并发构建（Phase 2）

修改 `docker-compose.yml` 增加 backend 实例数。

---

## 监控和日志

### 查看日志

```bash
# 实时查看所有日志
docker-compose logs -f

# 查看特定服务日志
docker-compose logs -f backend

# 查看最近 100 行日志
docker-compose logs --tail=100 backend
```

### 日志位置

- **应用日志**: Docker 容器日志
- **构建日志**: `~/app-build-workspace/logs/`
- **Nginx 日志**: 容器内 `/var/log/nginx/`

---

## 升级指南

### 从 Phase 1 升级到 Phase 2

1. 备份数据
2. 停止服务
3. 更新代码
4. 运行数据库迁移
5. 重启服务

详细步骤将在 Phase 2 文档中提供。

---

## 支持

如有问题，请查看:
- [故障排查文档](./troubleshooting.md)
- [测试文档](./testing.md)
- [架构文档](../openspec/changes/app-build-platform/architecture.md)

或提交 Issue 到项目仓库。
