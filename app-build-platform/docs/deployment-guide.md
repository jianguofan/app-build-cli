# App Build Platform 部署指南

## 1. 环境要求

### 打包机环境
- **操作系统**: macOS 12.0+
- **硬件**: 建议 16GB+ 内存，100GB+ 可用磁盘空间
- **网络**: 能访问 Git 仓库和各应用商店 API

### 必需软件
- Node.js 18+ 和 npm/yarn
- Redis 6+
- Nginx
- Git
- Flutter SDK（用于构建 App）
- Xcode（用于 iOS 构建）
- Android SDK（用于 Android 构建）
- PM2（进程管理）

## 2. 安装依赖

### 2.1 安装 Homebrew（如果未安装）
```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

### 2.2 安装必需软件
```bash
# 安装 Node.js
brew install node@18

# 安装 Redis
brew install redis

# 安装 Nginx
brew install nginx

# 安装 PM2
npm install -g pm2

# 启动 Redis 并设置开机自启
brew services start redis
```

### 2.3 验证安装
```bash
node --version  # 应显示 v18.x.x
redis-cli ping  # 应返回 PONG
nginx -v        # 应显示版本号
pm2 --version   # 应显示版本号
```

## 3. 项目部署

### 3.1 克隆代码到打包机
```bash
# 选择部署目录
cd /Users/$(whoami)
mkdir -p apps
cd apps

# 克隆项目（或通过 rsync/scp 上传）
git clone <your-repo-url> app-build-platform
cd app-build-platform/app-build-platform
```

### 3.2 安装项目依赖
```bash
# 安装根目录依赖
npm install

# 安装后端依赖
cd packages/backend
npm install

# 安装前端依赖
cd ../frontend
npm install

cd ../..
```

## 4. 配置环境变量

### 4.1 创建后端环境配置
```bash
cd packages/backend
cp .env.example .env
```

### 4.2 编辑 `.env` 文件
```bash
nano .env
```

配置内容：
```env
# 服务端口
PORT=3000

# Redis 配置
REDIS_HOST=localhost
REDIS_PORT=6379

# JWT 密钥（生成一个随机字符串）
JWT_SECRET=your-super-secret-jwt-key-change-this

# Git 仓库配置
GIT_REPO_URL=git@github.com:your-org/your-app-repo.git

# 工作空间目录
WORKSPACE_DIR=/Users/$(whoami)/app-build-workspace

# macOS Keychain 密码（用于 iOS 签名）
KEYCHAIN_PASSWORD=your-keychain-password

# 日志级别
LOG_LEVEL=info
```

### 4.3 创建前端环境配置
```bash
cd ../frontend
cp .env.example .env.production
```

编辑 `.env.production`：
```env
# API 地址（生产环境）
VITE_API_URL=http://localhost:3000
VITE_WS_URL=ws://localhost:3000
```

## 5. 构建项目

### 5.1 构建后端
```bash
cd packages/backend
npm run build
```

### 5.2 构建前端
```bash
cd ../frontend
npm run build
# 构建产物在 dist/ 目录
```

## 6. 配置 Nginx

### 6.1 创建 Nginx 配置文件
```bash
sudo nano /usr/local/etc/nginx/servers/app-build-platform.conf
```

配置内容：
```nginx
upstream backend {
    server 127.0.0.1:3000;
}

server {
    listen 80;
    server_name localhost;  # 或使用打包机的 IP/域名

    # 前端静态文件
    location / {
        root /Users/YOUR_USERNAME/apps/app-build-platform/app-build-platform/packages/frontend/dist;
        try_files $uri $uri/ /index.html;
        
        # 缓存静态资源
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }

    # API 代理
    location /api {
        rewrite ^/api/(.*) /$1 break;
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
    }

    # WebSocket 代理
    location /socket.io {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # 构建产物下载（大文件）
    location /builds {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        
        # 大文件下载配置
        client_max_body_size 500M;
        proxy_read_timeout 300s;
        proxy_connect_timeout 300s;
    }
}
```

**注意**：将 `YOUR_USERNAME` 替换为实际用户名。

### 6.2 测试并重启 Nginx
```bash
# 测试配置
sudo nginx -t

# 重启 Nginx
sudo brew services restart nginx
```

## 7. 使用 PM2 管理后端进程

### 7.1 创建 PM2 配置文件
```bash
cd /Users/$(whoami)/apps/app-build-platform/app-build-platform
nano ecosystem.config.js
```

配置内容：
```javascript
module.exports = {
  apps: [
    {
      name: 'app-build-backend',
      cwd: './packages/backend',
      script: 'dist/main.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
      },
      error_file: './logs/err.log',
      out_file: './logs/out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      max_memory_restart: '1G',
    },
  ],
};
```

### 7.2 启动服务
```bash
# 创建日志目录
mkdir -p packages/backend/logs

# 启动服务
pm2 start ecosystem.config.js

# 查看状态
pm2 status

# 查看日志
pm2 logs app-build-backend

# 保存 PM2 配置
pm2 save

# 设置开机自启
pm2 startup
# 按照提示执行命令
```

### 7.3 PM2 常用命令
```bash
# 重启服务
pm2 restart app-build-backend

# 停止服务
pm2 stop app-build-backend

# 查看详细信息
pm2 show app-build-backend

# 监控
pm2 monit

# 查看日志
pm2 logs app-build-backend --lines 100
```

## 8. 配置工作空间

### 8.1 创建工作空间目录
```bash
mkdir -p ~/app-build-workspace/logs
mkdir -p ~/app-build-workspace/artifacts
mkdir -p ~/app-build-workspace/signing
```

### 8.2 配置 Git SSH 密钥（如果使用 SSH）
```bash
# 生成 SSH 密钥（如果没有）
ssh-keygen -t ed25519 -C "build-machine@example.com"

# 添加到 GitHub/GitLab
cat ~/.ssh/id_ed25519.pub
# 复制公钥到 Git 服务商

# 测试连接
ssh -T git@github.com
```

### 8.3 配置 Android 签名文件（如果需要）
```bash
# 将签名文件复制到工作空间
cp /path/to/key.properties ~/app-build-workspace/signing/
cp /path/to/signedkey.jks ~/app-build-workspace/signing/
```

## 9. 初始化数据

### 9.1 创建管理员账号
```bash
# 通过 API 创建第一个用户
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "your-secure-password"
  }'
```

### 9.2 配置构建选项
访问 `http://打包机IP/config` 配置：
- 构建选项组（平台、渠道、环境等）
- 发布平台凭证（App Store、蒲公英等）

## 10. 验证部署

### 10.1 检查服务状态
```bash
# 检查 Redis
redis-cli ping

# 检查后端
curl http://localhost:3000/health

# 检查 Nginx
curl http://localhost/

# 检查 PM2
pm2 status
```

### 10.2 测试构建流程
1. 访问 `http://打包机IP`
2. 登录系统
3. 创建一个测试构建任务
4. 查看构建日志和状态
5. 下载构建产物

## 11. 监控和维护

### 11.1 日志位置
- **后端日志**: `~/apps/app-build-platform/app-build-platform/packages/backend/logs/`
- **构建日志**: `~/app-build-workspace/logs/`
- **Nginx 日志**: `/usr/local/var/log/nginx/`
- **Redis 日志**: `/usr/local/var/log/redis.log`

### 11.2 定期维护
```bash
# 清理旧的构建产物（保留最近 30 天）
find ~/app-build-workspace/artifacts -type f -mtime +30 -delete

# 清理旧的日志文件
find ~/app-build-workspace/logs -type f -mtime +30 -delete

# 查看磁盘使用
du -sh ~/app-build-workspace/*
```

### 11.3 备份策略
```bash
# 备份 Redis 数据（如果需要持久化）
redis-cli BGSAVE

# 备份配置文件
tar -czf backup-config-$(date +%Y%m%d).tar.gz \
  packages/backend/.env \
  ecosystem.config.js \
  /usr/local/etc/nginx/servers/app-build-platform.conf
```

## 12. 更新部署

### 12.1 更新代码
```bash
cd ~/apps/app-build-platform/app-build-platform

# 拉取最新代码
git pull origin main

# 安装新依赖
cd packages/backend && npm install
cd ../frontend && npm install

# 重新构建
cd packages/backend && npm run build
cd ../frontend && npm run build

# 重启服务
pm2 restart app-build-backend

# 重启 Nginx（如果前端有更新）
sudo brew services restart nginx
```

## 13. 故障排查

### 13.1 后端无法启动
```bash
# 查看详细日志
pm2 logs app-build-backend --lines 200

# 检查端口占用
lsof -i :3000

# 检查环境变量
pm2 show app-build-backend
```

### 13.2 Redis 连接失败
```bash
# 检查 Redis 状态
brew services list | grep redis

# 重启 Redis
brew services restart redis

# 测试连接
redis-cli ping
```

### 13.3 构建失败
```bash
# 查看构建日志
cat ~/app-build-workspace/logs/<task-id>.log

# 检查工作空间权限
ls -la ~/app-build-workspace/

# 手动测试构建脚本
cd ~/app-build-workspace/repo/lava-app
./build_app.sh --platform=ipa --build_mode=debug --flavor=oversea --env=dev
```

### 13.4 Nginx 502 错误
```bash
# 检查后端是否运行
pm2 status

# 检查 Nginx 配置
sudo nginx -t

# 查看 Nginx 错误日志
tail -f /usr/local/var/log/nginx/error.log
```

## 14. 安全建议

1. **修改默认密码**: 首次登录后立即修改管理员密码
2. **配置防火墙**: 只开放必要的端口（80, 443）
3. **使用 HTTPS**: 配置 SSL 证书（Let's Encrypt）
4. **限制访问**: 通过 IP 白名单或 VPN 限制访问
5. **定期更新**: 保持系统和依赖包更新
6. **备份数据**: 定期备份配置和重要数据

## 15. 性能优化

1. **Redis 持久化**: 根据需要配置 RDB 或 AOF
2. **日志轮转**: 配置日志自动清理和压缩
3. **并发构建**: 根据机器性能调整并发数
4. **缓存策略**: 配置 Nginx 静态资源缓存
5. **监控告警**: 集成监控系统（如 Prometheus + Grafana）

## 附录：快速部署脚本

创建 `deploy.sh` 脚本：
```bash
#!/bin/bash
set -e

echo "🚀 开始部署 App Build Platform..."

# 1. 拉取代码
echo "📦 拉取最新代码..."
git pull origin main

# 2. 安装依赖
echo "📦 安装依赖..."
cd packages/backend && npm install
cd ../frontend && npm install
cd ../..

# 3. 构建
echo "🔨 构建项目..."
cd packages/backend && npm run build
cd ../frontend && npm run build
cd ../..

# 4. 重启服务
echo "🔄 重启服务..."
pm2 restart app-build-backend

# 5. 重启 Nginx
echo "🔄 重启 Nginx..."
sudo brew services restart nginx

echo "✅ 部署完成！"
echo "访问: http://localhost"
```

使用方法：
```bash
chmod +x deploy.sh
./deploy.sh
```
