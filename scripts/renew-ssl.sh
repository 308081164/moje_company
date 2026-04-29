#!/bin/bash

# ==============================================================================
# MOJE 珠宝 SSL证书自动续订脚本
# 功能：检查并自动续订即将过期的SSL证书
# ==============================================================================

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 日志函数
log() {
    echo -e "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

# 配置变量
DOMAIN="moje珠宝.com"
WWW_DOMAIN="www.moje珠宝.com"
EMAIL="admin@moje珠宝.com"
CERTBOT_IMAGE="certbot/certbot"
VOLUME_NAME="moje-ssl"
CERT_PATH="/etc/letsencrypt"
RENEW_DAYS=30  # 提前30天开始尝试续订

log "${BLUE}===============================================${NC}"
log "${BLUE}    MOJE 珠宝 SSL证书检查脚本${NC}"
log "${BLUE}===============================================${NC}"

# 检查Docker是否运行
if ! command -v docker &> /dev/null; then
    log "${RED}错误：Docker未安装或未运行${NC}"
    exit 1
fi

# 检查证书存在性
log "${YELLOW}检查SSL证书状态...${NC}"

# 尝试续订（会检查是否需要）
log "${GREEN}执行证书续订检查...${NC}"

docker run --rm \
    -v $VOLUME_NAME:$CERT_PATH \
    -p 80:80 \
    $CERTBOT_IMAGE renew \
    --force-renewal \
    --standalone \
    --non-interactive

# 检查是否有更新
if docker run --rm -v $VOLUME_NAME:$CERT_PATH $CERTBOT_IMAGE certificates | grep -q "Expiry Date"; then
    log "${YELLOW}检查证书有效期...${NC}"
    
    # 提取有效期（简化处理）
    EXPIRY=$(docker run --rm -v $VOLUME_NAME:$CERT_PATH $CERTBOT_IMAGE certificates | grep "Expiry Date" | head -1 | awk -F': ' '{print $2}')
    
    if [ -n "$EXPIRY" ]; then
        log "${GREEN}证书有效期: $EXPIRY${NC}"
        
        # 计算剩余天数
        EXPIRY_EPOCH=$(date -d "$EXPIRY" +%s 2>/dev/null || date -jf "%Y-%m-%d %H:%M:%S" "$EXPIRY" +%s 2>/dev/null)
        NOW_EPOCH=$(date +%s)
        
        if [ -n "$EXPIRY_EPOCH" ]; then
            DAYS_REMAINING=$(( (EXPIRY_EPOCH - NOW_EPOCH) / 86400 ))
            
            if [ $DAYS_REMAINING -le $RENEW_DAYS ]; then
                log "${RED}证书即将过期：剩余 $DAYS_REMAINING 天${NC}"
                log "${YELLOW}执行续订...${NC}"
                
                docker run --rm \
                    -v $VOLUME_NAME:$CERT_PATH \
                    -p 80:80 \
                    $CERTBOT_IMAGE renew \
                    --force-renewal \
                    --standalone \
                    --non-interactive
                
                log "${GREEN}证书已续订！${NC}"
                
                # 重载nginx
                log "${YELLOW}重载nginx配置...${NC}"
                
                if docker ps --format '{{.Names}}' | grep -q "b2b-client"; then
                    docker-compose exec -T web nginx -s reload
                    log "${GREEN}nginx已重载${NC}"
                else
                    log "${YELLOW}警告：nginx容器未运行，请手动重启${NC}"
                fi
                
            else
                log "${GREEN}证书状态良好：剩余 $DAYS_REMAINING 天${NC}"
            fi
        fi
    fi
fi

log "${GREEN}===============================================${NC}"
log "${GREEN}SSL证书检查完成${NC}"
log "${GREEN}===============================================${NC}"
