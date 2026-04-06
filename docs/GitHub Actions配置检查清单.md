# GitHub Actions自动化部署配置检查清单

## 部署状态分析

### ✅ 已完成的工作
1. **GitHub Actions工作流文件已创建**：`.github/workflows/deploy.yml`
2. **前端应用架构已完善**：完整的React + TypeScript + Ant Design前端
3. **后端Dockerfile已配置**：支持多阶段构建
4. **数据库迁移文件已创建**：完整的数据库初始化脚本
5. **代码已推送到GitHub**：最新代码已提交并推送

### 🔧 需要配置的GitHub Secrets

为了让GitHub Actions能够成功部署，您需要在GitHub仓库中配置以下Secrets：

#### 必需配置的Secrets：

1. **SSH_HOST**：服务器IP地址
   - 值：`39.102.213.51`

2. **SSH_USERNAME**：SSH用户名
   - 值：`root`

3. **SSH_PASSWORD**：SSH密码
   - 值：`@Group666`

4. **DB_PASSWORD**：数据库密码
   - 值：`@Group666`

5. **OSS_ACCESS_KEY_ID**：阿里云OSS AccessKey ID
   - 值：`LTAI5tFTJEe9v9Vr7HRh4J9F`

6. **OSS_ACCESS_KEY_SECRET**：阿里云OSS AccessKey Secret
   - 值：[您已配置的AccessKey Secret]

#### 配置步骤：

1. 访问GitHub仓库：https://github.com/308081164/moje_company
2. 点击 **Settings** → **Secrets and variables** → **Actions**
3. 点击 **New repository secret**
4. 逐个添加上述Secrets

## 部署流程说明

### 1. 触发条件
- **push到main分支**：自动触发构建和部署
- **pull request到main分支**：只构建不部署

### 2. 工作流包含两个Job：
- **build-and-push**：构建后端应用并推送到GitHub Container Registry
- **deploy-to-server**：通过SSH连接到服务器并部署应用

### 3. 部署过程
1. **构建阶段**：
   - 使用JDK 17构建Spring Boot应用
   - 运行Maven测试
   - 构建Docker镜像并推送到GitHub Container Registry

2. **部署阶段**：
   - 通过SSH连接到服务器（39.102.213.51）
   - 创建项目目录：`/opt/jewelry-system`
   - 拉取最新代码
   - 创建docker-compose.prod.yml配置文件
   - 拉取最新Docker镜像
   - 启动MySQL和Spring Boot应用
   - 验证服务健康状态

## 问题排查指南

### 如果GitHub Actions没有触发：
1. **检查工作流文件位置**：确保`.github/workflows/deploy.yml`存在
2. **检查分支保护规则**：确保main分支允许Actions运行
3. **检查Actions权限**：Settings → Actions → General → Workflow permissions

### 如果构建失败：
1. **检查Maven构建**：查看build-and-push job的日志
2. **检查Docker构建**：确保Dockerfile语法正确
3. **检查依赖下载**：可能需要配置Maven镜像

### 如果部署失败：
1. **检查SSH连接**：确保服务器IP、用户名、密码正确
2. **检查端口冲突**：确保8851端口没有被占用
3. **检查Docker权限**：确保服务器上Docker已安装且运行正常
4. **查看部署日志**：在deploy-to-server job中查看详细错误信息

## 服务器端准备工作

### 1. 检查服务器环境
```bash
# 登录服务器
ssh root@39.102.213.51

# 检查Docker是否安装
docker --version

# 检查Docker Compose是否安装
docker compose version

# 检查端口占用
netstat -tulpn | grep :8851

# 检查磁盘空间
df -h
```

### 2. 创建必要的目录
```bash
# 创建项目目录
mkdir -p /opt/jewelry-system

# 设置权限
chmod 755 /opt/jewelry-system
```

### 3. 测试SSH连接（从GitHub Actions角度）
```bash
# 测试密码登录
sshpass -p '@Group666' ssh root@39.102.213.51 "echo 'SSH连接测试成功'"
```

## 手动测试部署

### 1. 本地构建测试
```bash
# 在项目根目录
cd backend
mvn clean package -DskipTests
docker build -t jewelry-backend:test .
```

### 2. 本地运行测试
```bash
# 使用docker-compose测试
cd ../参考docker文档
docker-compose -f docker-compose.yml up -d

# 检查服务
curl http://localhost:8851/actuator/health
```

### 3. 服务器手动部署测试
```bash
# 在服务器上
cd /opt/jewelry-system

# 创建docker-compose.prod.yml（复制内容）
vim docker-compose.prod.yml

# 启动服务
docker compose -f docker-compose.prod.yml up -d

# 检查服务状态
docker ps
curl http://localhost:8851/actuator/health
```

## 监控和维护

### 1. 查看GitHub Actions运行状态
- 访问：https://github.com/308081164/moje_company/actions
- 查看最新的workflow运行情况

### 2. 服务器监控命令
```bash
# 查看容器状态
docker ps --filter "name=jewelry"

# 查看日志
docker logs jewelry-backend -f

# 查看资源使用
docker stats jewelry-backend jewelry-mysql

# 检查服务健康
curl http://localhost:8851/actuator/health
```

### 3. 数据库备份
```bash
# 备份脚本
docker exec jewelry-mysql mysqldump -u root -p@Group666 moje_database > backup_$(date +%Y%m%d).sql
```

## 紧急恢复措施

### 如果部署失败需要回滚：
```bash
# 在服务器上
cd /opt/jewelry-system

# 停止当前服务
docker compose -f docker-compose.prod.yml down

# 恢复到上一个版本（如果有备份）
docker compose -f docker-compose.prod.yml up -d
```

### 如果数据库出现问题：
```bash
# 进入MySQL容器
docker exec -it jewelry-mysql mysql -u root -p@Group666

# 检查数据库
SHOW DATABASES;
USE moje_database;
SHOW TABLES;
```

## 后续优化建议

1. **使用SSH密钥认证**：替代密码认证，提高安全性
2. **配置HTTPS**：为生产环境启用HTTPS
3. **添加监控告警**：配置Prometheus + Grafana监控
4. **实现蓝绿部署**：减少部署期间的停机时间
5. **配置自动备份**：定期备份数据库和文件

## 联系支持

如果遇到问题，请检查：
1. GitHub Actions日志中的详细错误信息
2. 服务器上的Docker容器日志
3. 应用日志文件

如需进一步帮助，请提供：
- GitHub Actions运行ID
- 错误日志截图
- 服务器环境信息