#!/bin/bash

# ==============================================================================
# MOJE 珠宝 SSL证书初始化脚本
# 功能：自动申请和配置Let's Encrypt SSL证书
# ==============================================================================

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}===============================================${NC}"
echo -e "${BLUE}    MOJE 珠宝 SSL证书初始化脚本${NC}"
echo -e "${BLUE}===============================================${NC}"
echo ""

# 配置变量
DOMAIN="moje珠宝.com"
WWW_DOMAIN="www.moje珠宝.com"
EMAIL="admin@moje珠宝.com"  # 请替换为实际邮箱
CERTBOT_IMAGE="certbot/certbot"
VOLUME_NAME="moje-ssl"
CERT_PATH="/etc/letsencrypt"

# 检查Docker是否运行
if ! command -v docker &> /dev/null; then
    echo -e "${RED}错误：Docker未安装或未运行${NC}"
    exit 1
fi

# 创建存储卷
echo -e "${YELLOW}创建SSL证书存储卷...${NC}"
docker volume create $VOLUME_NAME || true

# 创建临时nginx配置用于验证
echo -e "${YELLOW}准备临时HTTP服务器...${NC}"

# 创建临时nginx配置
cat > /tmp/nginx-temp.conf << EOF
server {
    listen 80;
    server_name $DOMAIN $WWW_DOMAIN;
    
    location /.well-known/acme-challenge/ {
        root /usr/share/nginx/html;
    }
    
    location / {
        return 200 "OK";
    }
}
EOF

# 创建临时docker-compose
cat > /tmp/docker-compose-temp.yml << EOF
version: '3'
services:
  nginx-temp:
    image: nginx:alpine
    ports:
      - "80:80"
    volumes:
      - /tmp/nginx-temp.conf:/etc/nginx/conf.d/default.conf
EOF

# 启动临时nginx
echo -e "${YELLOW}启动临时HTTP服务器...${NC}"
cd /tmp
docker-compose -f docker-compose-temp.yml up -d

# 等待nginx启动
sleep 3

echo -e "${YELLOW}检查域名解析...${NC}"

# 使用certbot申请证书
echo -e "${GREEN}申请SSL证书...${NC}"

docker run --rm \
    -v $VOLUME_NAME:$CERT_PATH \
    -p 80:80 \
    $CERTBOT_IMAGE certonly \
    --standalone \
    -d $DOMAIN \
    -d $WWW_DOMAIN \
    --email $EMAIL \
    --agree-tos \
    --no-eff-email \
    --non-interactive

# 停止临时nginx
echo -e "${YELLOW}清理临时服务...${NC}"
cd /tmp
docker-compose -f docker-compose-temp.yml down

# 清理临时文件
rm -f /tmp/nginx-temp.conf
rm -f /tmp/docker-compose-temp.yml

echo ""
echo -e "${GREEN}===============================================${NC}"
echo -e "${GREEN}SSL证书申请成功！${NC}"
echo -e "${GREEN}===============================================${NC}"
echo ""
echo -e "${BLUE}证书路径：${NC}"
echo -e "- /etc/letsencrypt/live/$DOMAIN/fullchain.pem"
echo -e "- /etc/letsencrypt/live/$DOMAIN/privkey.pem"
echo ""
echo -e "${YELLOW}下一步：${NC}"
echo -e "1. 修改 docker-compose.yml 添加SSL配置"
echo -e "2. 运行 ./scripts/setup-ssl.sh 配置"
echo -e "3. 运行 docker-compose up -d"
echo ""
echo -e "${GREEN}完成！${NC}"
