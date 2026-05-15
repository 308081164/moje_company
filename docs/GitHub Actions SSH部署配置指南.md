# GitHub Actions SSH部署配置指南

## 概述
本指南详细说明如何配置GitHub Actions使用SSH密钥认证方式登录服务器并部署珠宝定制管理系统。基于您已有的参考docker配置，我们可以直接复用现有的部署架构。

## 一、前提条件

### 1.1 已确认信息
- ✅ **服务器IP**：<YOUR_SERVER_HOST>
- ✅ **现有服务**：同一服务器上已有使用类似架构部署的其他服务
- ✅ **部署模式**：GitHub Actions + SSH密钥认证 + Docker Compose
- ✅ **参考配置**：已有完整的docker-compose.prod.yml和部署流程

### 1.2 已确认信息
基于您提供的信息，已确认以下配置：
1. **SSH登录方式**：密码登录（非密钥）
2. **SSH用户名**：root
3. **SSH密码**：`<YOUR_SSH_PASSWORD>`
4. **服务器目录**：`/mnt/newdisk/app/[项目名]`
5. **阿里云OSS**：已在GitHub Secrets中配置
   - OSS_ACCESS_KEY_ID：<YOUR_OSS_ACCESS_KEY_ID>
   - OSS_ACCESS_KEY_SECRET：[已配置]
6. **数据库密码**：`<YOUR_DB_PASSWORD>`（可与 SSH 密码不同，建议在 Secrets 中分别配置）

## 二、配置步骤

### 2.1 第一步：检查现有部署结构

在服务器上运行以下命令检查现有服务：

```bash
# 登录服务器（使用现有SSH方式）
ssh [现有用户名]@<YOUR_SERVER_HOST>

# 查看现有项目目录
ls -la /opt/  # 或 /home/[用户名]/ 等目录

# 查看现有docker-compose配置
find / -name "docker-compose*.yml" 2>/dev/null | head -10

# 查看正在运行的容器
docker ps -a

# 查看网络端口占用
netstat -tulpn | grep :8851  # 检查我们的端口是否被占用
```

### 2.2 第二步：配置GitHub Secrets

在您的GitHub仓库中配置以下Secrets：

**必需Secrets**：
1. **SSH_HOST**：`<YOUR_SERVER_HOST>`
2. **SSH_USERNAME**：`root`
3. **SSH_PASSWORD**：`<YOUR_DB_PASSWORD>`

**应用配置Secrets**：
4. **OSS_ACCESS_KEY_ID**：`<YOUR_OSS_ACCESS_KEY_ID>`（您已配置）
5. **OSS_ACCESS_KEY_SECRET**：[您已配置的AccessKey Secret]

**数据库配置**：
6. **DB_PASSWORD**：`<YOUR_DB_PASSWORD>`（与SSH密码相同）

**配置方法**：
1. 进入GitHub仓库 → Settings → Secrets and variables → Actions
2. 点击"New repository secret"
3. 添加上述每个Secret
4. **重要**：SSH_PASSWORD需要安全存储，建议后续改为SSH密钥认证

### 2.3 第三步：创建GitHub Actions工作流

在项目根目录创建 `.github/workflows/deploy.yml`：

```yaml
name: Build and Deploy Jewelry System

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}/jewelry-backend

jobs:
  build-and-push:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Set up JDK 17
      uses: actions/setup-java@v3
      with:
        java-version: '17'
        distribution: 'temurin'
    
    - name: Build with Maven
      run: mvn -f backend/pom.xml clean package -DskipTests
    
    - name: Log in to GitHub Container Registry
      uses: docker/login-action@v2
      with:
        registry: ${{ env.REGISTRY }}
        username: ${{ github.actor }}
        password: ${{ secrets.GITHUB_TOKEN }}
    
    - name: Build and push Docker image
      uses: docker/build-push-action@v4
      with:
        context: ./backend
        push: true
        tags: |
          ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:latest
          ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:${{ github.sha }}
    
    - name: Run tests
      run: mvn -f backend/pom.xml test
  
  deploy-to-server:
    needs: build-and-push
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Deploy to production server
      uses: appleboy/ssh-action@v0.1.5
      with:
        host: ${{ secrets.SSH_HOST }}
        username: ${{ secrets.SSH_USERNAME }}
        key: ${{ secrets.SSH_PRIVATE_KEY }}
        script: |
          # ========== 1. 准备环境 ==========
          echo "=== 开始部署珠宝定制系统 ==="
          
          # 检查现有服务目录结构
          echo "检查现有服务目录..."
          ls -la /opt/
          
          # 创建珠宝系统目录（假设放在/opt/jewelry-system）
          JEWELRY_DIR="/opt/jewelry-system"
          mkdir -p $JEWELRY_DIR
          cd $JEWELRY_DIR
          
          # ========== 2. 传输必要文件 ==========
          echo "传输数据库迁移文件..."
          mkdir -p backend/src/main/resources/db
          
          # 从GitHub Actions工作区复制文件
          # 注意：这里假设GitHub Actions可以访问工作区文件
          # 实际可能需要使用scp或直接git clone
          
          # 方法一：如果服务器可以访问GitHub
          if [ ! -d ".git" ]; then
            echo "克隆项目代码..."
            git clone https://github.com/${{ github.repository }}.git .
          else
            echo "更新项目代码..."
            git pull origin main
          fi
          
          # 方法二：使用scp（如果方法一不可行）
          # scp -r ${{ github.workspace }}/backend/src/main/resources/db ${{ secrets.SSH_USERNAME }}@${{ secrets.SSH_HOST }}:$JEWELRY_DIR/backend/src/main/resources/
          
          # ========== 3. 创建docker-compose配置 ==========
          echo "创建docker-compose.prod.yml..."
          cat > docker-compose.prod.yml << 'EOF'
version: "3.9"

services:
  mysql:
    image: mysql:8.4
    container_name: jewelry-mysql
    restart: unless-stopped
    environment:
      MYSQL_ROOT_PASSWORD: <YOUR_DB_PASSWORD>
      MYSQL_DATABASE: moje_database
      TZ: Asia/Shanghai
    volumes:
      - jewelry_mysql_data:/var/lib/mysql
      - ./backend/src/main/resources/db:/docker-entrypoint-initdb.d:ro
    command: ["--character-set-server=utf8mb4","--collation-server=utf8mb4_unicode_ci"]
    networks:
      - jewelry-network

  backend:
    image: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:latest
    container_name: jewelry-backend
    depends_on:
      mysql:
        condition: service_healthy
    environment:
      DB_HOST: mysql
      DB_PORT: 3306
      DB_NAME: moje_database
      DB_USER: root
      DB_PASSWORD: <YOUR_DB_PASSWORD>
      OSS_ACCESS_KEY_ID: ${{ secrets.OSS_ACCESS_KEY_ID }}
      OSS_ACCESS_KEY_SECRET: ${{ secrets.OSS_ACCESS_KEY_SECRET }}
      OSS_ENDPOINT: oss-cn-guangzhou.aliyuncs.com
      OSS_BUCKET: <YOUR_OSS_BUCKET_NAME>
      SERVER_PORT: 8851
    ports:
      - "8851:8851"
    volumes:
      - ./backend/src/main/resources/db:/app/db:ro
      - jewelry_logs:/app/logs
    restart: unless-stopped
    networks:
      - jewelry-network

networks:
  jewelry-network:
    driver: bridge

volumes:
  jewelry_mysql_data:
  jewelry_logs:
EOF
          
          # ========== 4. 设置环境变量 ==========
          echo "设置环境变量..."
          export IMAGE_BACKEND=${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:latest
          
          # 如果OSS密钥通过Secrets传递，这里不需要额外设置
          # 它们已经在docker-compose中通过${{ secrets.xxx }}引用
          
          # ========== 5. 部署服务 ==========
          echo "拉取最新镜像..."
          docker compose -f docker-compose.prod.yml pull
          
          echo "启动服务..."
          docker compose -f docker-compose.prod.yml up -d --force-recreate
          
          # ========== 6. 验证部署 ==========
          echo "等待服务启动..."
          sleep 10
          
          echo "检查容器状态..."
          docker ps --filter "name=jewelry" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
          
          echo "检查服务健康..."
          if curl -f http://localhost:8851/actuator/health > /dev/null 2>&1; then
            echo "✅ 服务健康检查通过"
          else
            echo "⚠️  服务健康检查失败，查看日志..."
            docker logs jewelry-backend --tail 50
          fi
          
          # ========== 7. 清理 ==========
          echo "清理未使用的镜像..."
          docker image prune -f
          
          echo "=== 部署完成 ==="
          echo "服务地址: http://<YOUR_SERVER_HOST>:8851"
          echo "健康检查: http://<YOUR_SERVER_HOST>:8851/actuator/health"
```

### 2.4 第四步：创建数据库迁移文件

在 `backend/src/main/resources/db/` 目录创建：

**V1__init_database.sql**：
```sql
-- 创建数据库（如果不存在）
CREATE DATABASE IF NOT EXISTS moje_database CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE moje_database;

-- 用户表
CREATE TABLE users (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    role ENUM('ADMIN', 'SALES_PRE', 'SALES_MID', 'DESIGNER', 'MODELER', 'FOLLOW_UP') NOT NULL,
    real_name VARCHAR(100),
    phone VARCHAR(20),
    email VARCHAR(100),
    status ENUM('ACTIVE', 'INACTIVE', 'DELETED') DEFAULT 'ACTIVE',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_username (username),
    INDEX idx_role (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 订单表
CREATE TABLE orders (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    order_number VARCHAR(50) NOT NULL UNIQUE,
    customer_name VARCHAR(100),
    customer_phone VARCHAR(20),
    customer_wechat VARCHAR(100),
    source ENUM('DOUYIN', 'BILIBILI', 'XIAOHONGSHU', 'TAOBAO', 'XIANYU', 'INFLUENCER') NOT NULL,
    influencer_name VARCHAR(100),
    deposit DECIMAL(10, 2),
    basic_requirements TEXT,
    style_info TEXT,
    material_info TEXT,
    status ENUM(
        'PENDING_DESIGN',
        'DESIGNING', 
        'PENDING_MODEL',
        'MODELING',
        'PENDING_REVIEW',
        'PENDING_PRODUCTION',
        'PRODUCING',
        'COMPLETED',
        'CANCELLED'
    ) DEFAULT 'PENDING_DESIGN',
    sales_pre_id BIGINT,
    sales_mid_id BIGINT,
    designer_id BIGINT,
    modeler_id BIGINT,
    follow_up_id BIGINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (sales_pre_id) REFERENCES users(id),
    FOREIGN KEY (sales_mid_id) REFERENCES users(id),
    FOREIGN KEY (designer_id) REFERENCES users(id),
    FOREIGN KEY (modeler_id) REFERENCES users(id),
    FOREIGN KEY (follow_up_id) REFERENCES users(id),
    INDEX idx_order_number (order_number),
    INDEX idx_status (status),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 更多表结构根据功能设计文档逐步添加...
```

**migrate_manifest.txt**：
```
# 数据库迁移清单
# 按顺序执行SQL文件
V1__init_database.sql
```

### 2.5 第五步：创建Dockerfile

在 `backend/` 目录创建 `Dockerfile`：

```dockerfile
# 使用多阶段构建减少镜像大小
FROM openjdk:17-jdk-slim as builder
WORKDIR /app

# 复制Maven包装器和配置文件
COPY mvnw .
COPY .mvn .mvn
COPY pom.xml .

# 下载依赖
RUN ./mvnw dependency:go-offline -B

# 复制源代码
COPY src src

# 构建应用
RUN ./mvnw package -DskipTests

# 运行时镜像
FROM openjdk:17-jdk-slim
WORKDIR /app

# 安装网络工具（用于健康检查）
RUN apt-get update && apt-get install -y netcat && rm -rf /var/lib/apt/lists/*

# 复制构建产物
COPY --from=builder /app/target/*.jar app.jar

# 复制数据库迁移文件
COPY src/main/resources/db /app/db

# 创建启动脚本
RUN echo '#!/bin/bash\n\
set -e\n\
\n\
# 等待数据库就绪\n\
echo "等待MySQL数据库就绪..."\n\
while ! nc -z mysql 3306; do\n\
  sleep 1\n\
done\n\
\n\
# 执行数据库迁移（如果有迁移文件）\n\
if [ -f "/app/db/migrate_manifest.txt" ]; then\n\
  echo "检查数据库迁移..."\n\
  # 这里可以添加Flyway或自定义迁移逻辑\n\
fi\n\
\n\
# 启动Spring Boot应用\n\
echo "启动应用..."\n\
exec java -jar app.jar\n\
' > /app/docker-entrypoint.sh && chmod +x /app/docker-entrypoint.sh

EXPOSE 8851

ENTRYPOINT ["/app/docker-entrypoint.sh"]
```

## 三、与现有服务集成考虑

### 3.1 网络隔离
建议为珠宝系统创建独立的Docker网络：
```yaml
networks:
  jewelry-network:
    driver: bridge
```

### 3.2 端口冲突检查
确保8851端口没有被现有服务占用：
```bash
# 在服务器上检查
netstat -tulpn | grep :8851
```

### 3.3 资源分配
考虑服务器资源分配：
- MySQL内存：建议1-2GB
- 后端应用内存：建议1-2GB
- 磁盘空间：至少50GB用于数据和日志

### 3.4 日志管理
建议配置统一的日志目录：
```yaml
volumes:
  - /opt/jewelry-system/logs:/app/logs
```

## 四、测试部署

### 4.1 本地测试
```bash
# 1. 构建镜像测试
docker build -t jewelry-backend:test ./backend

# 2. 使用docker-compose测试
docker-compose -f docker-compose.yml up -d

# 3. 访问测试
curl http://localhost:8851/actuator/health
```

### 4.2 首次生产部署步骤
1. **手动部署测试**：
   ```bash
   # 在服务器上手动执行
   cd /opt/jewelry-system
   docker-compose -f docker-compose.prod.yml up -d
   ```

2. **验证服务**：
   ```bash
   curl http://localhost:8851/actuator/health
   docker logs jewelry-backend --tail 50
   ```

3. **配置GitHub Actions**：
   - 提交代码到main分支
   - 观察Actions执行情况
   - 检查部署日志

### 4.3 问题排查

#### GitHub Actions：`dial tcp …:22: i/o timeout`

该报错出现在 **SSH 建连之前**（TCP 层即失败），与 Docker 镜像、远端部署脚本无关。请按顺序排查：

1. **安全组 / 防火墙**：云服务器入站是否放行 **TCP 22**（或你在 Secret `SSH_PORT` 中配置的端口）。GitHub-hosted Runner 的出口地址 **不固定**，不能依赖「只放行某一个 GitHub IP」；可临时 `0.0.0.0/0` 验证后收紧，或改用 **与服务器同 VPC 的 self-hosted Runner**。
2. **Secrets**：`SSH_HOST` 是否为公网可达 IP/域名；仅内网地址时，必须使用自建 Runner 或跳板机（`appleboy/ssh-action` 的 `proxy_*` 参数，见[官方文档](https://github.com/appleboy/ssh-action)）。
3. **本仓库 workflow**：已使用 `appleboy/ssh-action@v1.2.x` 并设置较长的 **`timeout`（建连超时）**；若仍超时，说明从公网 Runner 到主机仍不可达，需从网络侧解决。

部署 job 在 `ssh-action` 前增加了 **TCP 探测** 步骤：失败时会输出上述要点，便于在 Actions 日志中快速定位。

```bash
# 查看容器日志
docker logs jewelry-backend -f

# 进入容器调试
docker exec -it jewelry-backend /bin/bash

# 检查数据库连接
docker exec jewelry-mysql mysql -u root -p<YOUR_DB_PASSWORD> -e "SHOW DATABASES;"

# 检查网络
docker network inspect jewelry-network
```

## 五、安全建议

### 5.1 SSH安全
- 使用SSH密钥而非密码
- 定期更换密钥
- 限制SSH用户权限

### 5.2 数据库安全
- 使用强密码；勿将真实口令写入仓库，仅通过 GitHub Secrets 或服务器环境变量注入。
- 不暴露3306端口到公网
- 定期备份数据

### 5.3 应用安全
- 使用环境变量传递敏感信息
- 配置适当的CORS策略
- 启用HTTPS（后续）

## 六、监控和维护

### 6.1 监控命令
```bash
# 查看服务状态
docker ps --filter "name=jewelry"

# 查看资源使用
docker stats jewelry-backend jewelry-mysql

# 查看日志
docker logs --tail 100 -f jewelry-backend
```

### 6.2 备份策略
```bash
# 数据库备份脚本
#!/bin/bash
BACKUP_DIR="/opt/jewelry-system/backups"
DATE=$(date +%Y%m%d_%H%M%S)
docker exec jewelry-mysql mysqldump -u root -p<YOUR_DB_PASSWORD> moje_database > $BACKUP_DIR/backup_$