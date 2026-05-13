#!/bin/bash
set -e

echo "🚀 App Build Platform 初始化安装脚本"
echo ""

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 获取当前用户
CURRENT_USER=$(whoami)
PROJECT_DIR=$(pwd)

echo -e "${BLUE}当前用户: ${CURRENT_USER}${NC}"
echo -e "${BLUE}项目目录: ${PROJECT_DIR}${NC}"
echo ""

# 1. 检查必需软件
echo -e "${YELLOW}📋 检查必需软件...${NC}"

check_command() {
    if command -v $1 &> /dev/null; then
        echo -e "${GREEN}✅ $1 已安装${NC}"
        return 0
    else
        echo -e "${RED}❌ $1 未安装${NC}"
        return 1
    fi
}

MISSING_DEPS=0

check_command "node" || MISSING_DEPS=1
check_command "npm" || MISSING_DEPS=1
check_command "redis-cli" || MISSING_DEPS=1
check_command "nginx" || MISSING_DEPS=1
check_command "pm2" || MISSING_DEPS=1
check_command "git" || MISSING_DEPS=1

if [ $MISSING_DEPS -eq 1 ]; then
    echo ""
    echo -e "${RED}❌ 缺少必需软件，请先安装：${NC}"
    echo "  brew install node redis nginx"
    echo "  npm install -g pm2"
    exit 1
fi

echo ""

# 2. 检查 Redis 是否运行
echo -e "${YELLOW}🔍 检查 Redis 服务...${NC}"
if redis-cli ping &> /dev/null; then
    echo -e "${GREEN}✅ Redis 运行正常${NC}"
else
    echo -e "${YELLOW}⚠️  Redis 未运行，正在启动...${NC}"
    brew services start redis
    sleep 2
    if redis-cli ping &> /dev/null; then
        echo -e "${GREEN}✅ Redis 启动成功${NC}"
    else
        echo -e "${RED}❌ Redis 启动失败${NC}"
        exit 1
    fi
fi

echo ""

# 3. 安装项目依赖
echo -e "${YELLOW}📦 安装项目依赖...${NC}"

echo "安装后端依赖..."
cd packages/backend
npm install

echo "安装前端依赖..."
cd ../frontend
npm install

cd ../..

echo -e "${GREEN}✅ 依赖安装完成${NC}"
echo ""

# 4. 配置环境变量
echo -e "${YELLOW}⚙️  配置环境变量...${NC}"

# 后端环境变量
if [ ! -f "packages/backend/.env" ]; then
    echo "创建后端 .env 文件..."
    cp packages/backend/.env.example packages/backend/.env

    # 替换用户名
    sed -i '' "s/your_username/${CURRENT_USER}/g" packages/backend/.env

    # 生成随机 JWT 密钥
    JWT_SECRET=$(openssl rand -base64 32)
    sed -i '' "s/your-super-secret-jwt-key-change-me/${JWT_SECRET}/g" packages/backend/.env

    echo -e "${GREEN}✅ 后端 .env 已创建${NC}"
    echo -e "${YELLOW}⚠️  请编辑 packages/backend/.env 配置 Git 仓库和其他参数${NC}"
else
    echo -e "${BLUE}ℹ️  后端 .env 已存在，跳过${NC}"
fi

# 前端环境变量
if [ ! -f "packages/frontend/.env" ]; then
    echo "创建前端 .env 文件..."
    cp packages/frontend/.env.example packages/frontend/.env
    echo -e "${GREEN}✅ 前端 .env 已创建${NC}"
else
    echo -e "${BLUE}ℹ️  前端 .env 已存在，跳过${NC}"
fi

echo ""

# 5. 创建工作空间目录
echo -e "${YELLOW}📁 创建工作空间目录...${NC}"
WORKSPACE_DIR="/Users/${CURRENT_USER}/app-build-workspace"

mkdir -p "${WORKSPACE_DIR}/logs"
mkdir -p "${WORKSPACE_DIR}/artifacts"
mkdir -p "${WORKSPACE_DIR}/signing"

echo -e "${GREEN}✅ 工作空间已创建: ${WORKSPACE_DIR}${NC}"
echo ""

# 6. 构建项目
echo -e "${YELLOW}🔨 构建项目...${NC}"

echo "构建后端..."
cd packages/backend
npm run build

echo "构建前端..."
cd ../frontend
npm run build

cd ../..

echo -e "${GREEN}✅ 项目构建完成${NC}"
echo ""

# 7. 配置 Nginx
echo -e "${YELLOW}🌐 配置 Nginx...${NC}"

NGINX_CONF="/usr/local/etc/nginx/servers/app-build-platform.conf"

if [ ! -f "$NGINX_CONF" ]; then
    echo "创建 Nginx 配置..."

    # 复制配置文件并替换用户名
    sudo mkdir -p /usr/local/etc/nginx/servers
    sed "s/YOUR_USERNAME/${CURRENT_USER}/g" nginx.conf | sudo tee "$NGINX_CONF" > /dev/null

    # 测试配置
    if sudo nginx -t &> /dev/null; then
        echo -e "${GREEN}✅ Nginx 配置已创建${NC}"

        # 重启 Nginx
        sudo brew services restart nginx
        echo -e "${GREEN}✅ Nginx 已重启${NC}"
    else
        echo -e "${RED}❌ Nginx 配置错误${NC}"
        sudo nginx -t
        exit 1
    fi
else
    echo -e "${BLUE}ℹ️  Nginx 配置已存在: ${NGINX_CONF}${NC}"
fi

echo ""

# 8. 启动后端服务
echo -e "${YELLOW}🚀 启动后端服务...${NC}"

# 创建日志目录
mkdir -p packages/backend/logs

# 启动 PM2
if pm2 list | grep -q "app-build-backend"; then
    echo "重启现有服务..."
    pm2 restart app-build-backend
else
    echo "启动新服务..."
    pm2 start ecosystem.config.js
    pm2 save
fi

# 设置开机自启（仅首次）
if ! pm2 startup | grep -q "already"; then
    echo -e "${YELLOW}⚠️  请执行以下命令设置开机自启：${NC}"
    pm2 startup
fi

echo -e "${GREEN}✅ 后端服务已启动${NC}"
echo ""

# 9. 等待服务启动
echo -e "${YELLOW}⏳ 等待服务启动...${NC}"
sleep 3

# 10. 检查服务状态
echo -e "${YELLOW}🔍 检查服务状态...${NC}"

# 检查后端
if curl -s http://localhost:3000/health > /dev/null; then
    echo -e "${GREEN}✅ 后端服务运行正常${NC}"
else
    echo -e "${RED}❌ 后端服务异常${NC}"
    pm2 logs app-build-backend --lines 20 --nostream
    exit 1
fi

# 检查前端
if curl -s http://localhost/ > /dev/null; then
    echo -e "${GREEN}✅ 前端服务运行正常${NC}"
else
    echo -e "${YELLOW}⚠️  前端服务可能需要手动检查 Nginx 配置${NC}"
fi

echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✅ 安装完成！${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${BLUE}📍 服务信息：${NC}"
echo "  前端地址: http://localhost"
echo "  后端地址: http://localhost:3000"
echo "  工作空间: ${WORKSPACE_DIR}"
echo ""
echo -e "${BLUE}📝 下一步操作：${NC}"
echo "  1. 编辑 packages/backend/.env 配置 Git 仓库和凭证"
echo "  2. 访问 http://localhost 注册管理员账号"
echo "  3. 配置构建选项和发布平台凭证"
echo "  4. 创建第一个构建任务测试"
echo ""
echo -e "${BLUE}🔧 常用命令：${NC}"
echo "  查看服务状态: pm2 status"
echo "  查看后端日志: pm2 logs app-build-backend"
echo "  重启后端: pm2 restart app-build-backend"
echo "  重启 Nginx: sudo brew services restart nginx"
echo "  更新部署: ./deploy.sh"
echo ""
echo -e "${BLUE}📚 文档：${NC}"
echo "  部署指南: docs/deployment-guide.md"
echo ""
