#!/bin/bash
set -e

echo "🚀 开始部署 App Build Platform..."

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 检查是否在项目根目录
if [ ! -f "ecosystem.config.js" ]; then
    echo -e "${RED}❌ 错误: 请在项目根目录运行此脚本${NC}"
    exit 1
fi

# 1. 拉取代码
echo -e "${YELLOW}📦 拉取最新代码...${NC}"
git pull origin main

# 2. 安装依赖
echo -e "${YELLOW}📦 安装后端依赖...${NC}"
cd packages/backend
npm install

echo -e "${YELLOW}📦 安装前端依赖...${NC}"
cd ../frontend
npm install
cd ../..

# 3. 构建后端
echo -e "${YELLOW}🔨 构建后端...${NC}"
cd packages/backend
npm run build

# 4. 构建前端
echo -e "${YELLOW}🔨 构建前端...${NC}"
cd ../frontend
npm run build
cd ../..

# 5. 创建日志目录
echo -e "${YELLOW}📁 创建日志目录...${NC}"
mkdir -p packages/backend/logs

# 6. 重启后端服务
echo -e "${YELLOW}🔄 重启后端服务...${NC}"
if pm2 list | grep -q "app-build-backend"; then
    pm2 restart app-build-backend
else
    pm2 start ecosystem.config.js
    pm2 save
fi

# 7. 重启 Nginx
echo -e "${YELLOW}🔄 重启 Nginx...${NC}"
sudo brew services restart nginx

# 8. 检查服务状态
echo -e "${YELLOW}🔍 检查服务状态...${NC}"
sleep 2

# 检查后端
if curl -s http://localhost:3000/health > /dev/null; then
    echo -e "${GREEN}✅ 后端服务运行正常${NC}"
else
    echo -e "${RED}❌ 后端服务异常，请检查日志${NC}"
    pm2 logs app-build-backend --lines 20 --nostream
    exit 1
fi

# 检查前端
if curl -s http://localhost/ > /dev/null; then
    echo -e "${GREEN}✅ 前端服务运行正常${NC}"
else
    echo -e "${RED}❌ 前端服务异常，请检查 Nginx 配置${NC}"
    exit 1
fi

# 9. 显示服务信息
echo ""
echo -e "${GREEN}✅ 部署完成！${NC}"
echo ""
echo "服务信息:"
echo "  前端地址: http://localhost"
echo "  后端地址: http://localhost:3000"
echo ""
echo "常用命令:"
echo "  查看后端日志: pm2 logs app-build-backend"
echo "  查看服务状态: pm2 status"
echo "  重启后端: pm2 restart app-build-backend"
echo "  重启 Nginx: sudo brew services restart nginx"
echo ""
