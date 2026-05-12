# 珠宝定制管理系统 - 后端

## 项目概述

珠宝定制工作室企业信息化管理系统后端，基于Spring Boot 3.2 + MySQL 8.4 + JWT认证开发。

## 技术栈

- **Java 17**: 运行环境
- **Spring Boot 3.2.0**: 应用框架
- **MySQL 8.4**: 数据库
- **JPA/Hibernate**: ORM框架
- **Flyway**: 数据库迁移
- **JWT**: 认证授权
- **Spring Security**: 安全框架
- **Swagger/OpenAPI 3**: API文档
- **Maven**: 构建工具
- **Docker**: 容器化部署

## 快速开始

### 环境要求

1. **Java 17** 或更高版本
2. **MySQL 8.4** 或更高版本
3. **Maven 3.8+** 或使用Maven Wrapper

### 数据库配置

1. 启动MySQL服务
2. 创建数据库：
   ```sql
   CREATE DATABASE moje_database CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   ```
3. 连接信息（**勿将真实口令写入仓库**；本地可借助仓库根目录 `.env.example` 复制为 `.env` 并填写）：
   - 主机：`localhost:3306`
   - 用户名：与 `DB_USER` 一致（默认 `root`）
   - 密码：由环境变量 `DB_PASSWORD` 提供

### 启动方式

#### 方式一：使用启动脚本（推荐）
```bash
# Windows
start-dev.bat

# Linux/Mac
chmod +x start-dev.sh
./start-dev.sh
```

#### 方式二：手动启动
```bash
# 1. 编译项目
mvn clean compile

# 2. 运行应用
mvn spring-boot:run

# 或直接运行jar包
mvn package
java -jar target/jewelry-system-backend-1.0.0.jar
```

#### 方式三：使用Docker
```bash
# 构建镜像
docker build -t jewelry-backend:latest .

# 运行容器
docker run -p 8851:8851 jewelry-backend:latest
```

### 访问地址

应用启动后，可以通过以下地址访问：

1. **应用首页**: http://localhost:8851
2. **API文档**: http://localhost:8851/swagger-ui.html
3. **健康检查**: http://localhost:8851/api/health
4. **Actuator端点**: http://localhost:8851/actuator

## 项目结构

```
src/main/java/com/jewelry/system/
├── JewelrySystemApplication.java     # 应用主类
├── config/                          # 配置类
│   ├── SwaggerConfig.java          # Swagger配置
│   └── SecurityConfig.java         # 安全配置
├── controller/                      # 控制器层
│   ├── AuthController.java         # 认证控制器
│   ├── HealthController.java       # 健康检查控制器
│   └── UserController.java         # 用户管理控制器
├── entity/                         # 实体类
│   ├── User.java                   # 用户实体
│   ├── Order.java                  # 订单实体
│   └── ...                         # 其他实体
├── enums/                          # 枚举类
│   ├── UserRole.java               # 用户角色枚举
│   ├── UserStatus.java             # 用户状态枚举
│   ├── OrderStatus.java            # 订单状态枚举
│   └── OrderSource.java            # 订单来源枚举
├── dto/                            # 数据传输对象
│   ├── LoginRequest.java           # 登录请求DTO
│   ├── LoginResponse.java          # 登录响应DTO
│   └── ...                         # 其他DTO
├── service/                        # 服务层
│   ├── AuthService.java            # 认证服务
│   └── UserService.java            # 用户服务
└── repository/                     # 数据访问层
    ├── UserRepository.java         # 用户仓库
    └── OrderRepository.java        # 订单仓库
```

## 数据库设计

### 主要表结构

1. **users** - 用户表
2. **orders** - 订单表
3. **order_details** - 订单详情表
4. **design_info** - 设计信息表
5. **modeling_info** - 建模信息表
6. **process_review** - 工艺评审表
7. **quotation** - 报价表
8. **system_config** - 系统配置表
9. **process_config** - 工艺配置表
10. **material_config** - 材质配置表
11. **files** - 文件表
12. **operation_logs** - 操作日志表

### 数据库迁移

项目使用Flyway进行数据库迁移，迁移文件位于：
```
src/main/resources/db/migration/
└── V1__init_database.sql          # 初始数据库脚本
```

## 默认管理员（首次启动）

Flyway 种子中的管理员密码为占位哈希；应用启动时会根据环境变量写入可登录密码：

- **用户名**：`DEFAULT_ADMIN_USERNAME`（默认 `kuangjun`）
- **密码**：`DEFAULT_ADMIN_PASSWORD`（**必填**，勿提交到 Git）

未设置 `DEFAULT_ADMIN_PASSWORD` 时不会自动覆盖种子密码，将无法登录。

## API文档

### 认证接口

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | /api/auth/login | 用户登录 |
| POST | /api/auth/logout | 用户登出 |
| POST | /api/auth/refresh-token | 刷新令牌 |
| GET  | /api/auth/current-user | 获取当前用户 |

### 健康检查

| 方法 | 路径 | 描述 |
|------|------|------|
| GET  | /api/health | 健康检查 |
| GET  | /api/health/info | 系统信息 |

### 请求示例

#### 用户登录

请先设置环境变量 `TEST_ADMIN_PASSWORD`（及可选的 `TEST_ADMIN_USERNAME`），或使用与当前环境一致的账号调用登录接口，例如：

```bash
curl -X POST "http://localhost:8851/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"${ADMIN_USER:-kuangjun}\",\"password\":\"$DEFAULT_ADMIN_PASSWORD\"}"
```

#### 健康检查
```bash
curl "http://localhost:8851/api/health"
```

## 开发指南

### 添加新实体

1. 在`entity`包中创建实体类
2. 在`enums`包中创建相关枚举（如果需要）
3. 在`repository`包中创建Repository接口
4. 在`service`包中创建Service类
5. 在`controller`包中创建Controller类
6. 在`dto`包中创建DTO类

### 添加API文档

使用Swagger注解：
```java
@Operation(summary = "接口摘要", description = "接口详细描述")
@Tag(name = "标签名称", description = "标签描述")
```

### 数据库变更

1. 创建新的Flyway迁移文件：
   ```
   V2__your_migration_name.sql
   ```
2. 文件命名规则：`V{版本号}__{描述}.sql`
3. 版本号必须递增

## 部署

### 生产环境部署

1. **构建Docker镜像**:
   ```bash
   docker build -t jewelry-backend:prod .
   ```

2. **使用docker-compose部署**:
   ```bash
   docker-compose -f docker-compose.prod.yml up -d
   ```

3. **GitHub Actions自动部署**:
   - 配置GitHub Secrets
   - 提交代码到main分支触发自动部署

### 环境变量配置

完整说明见仓库根目录 **`docs/环境变量清单.md`** 与 **`.env.example`**。常用项如下：

| 变量名 | 描述 | 是否必填（生产） |
|--------|------|------------------|
| DB_HOST | 数据库主机 | 可选，默认 localhost |
| DB_PORT | 数据库端口 | 可选，默认 3306 |
| DB_NAME | 数据库名 | 可选，默认 moje_database |
| DB_USER | 数据库用户 | 可选，默认 root |
| DB_PASSWORD | 数据库密码 | **必填** |
| JWT_SECRET | JWT 签名密钥 | **必填** |
| DEFAULT_ADMIN_PASSWORD | 种子管理员可登录密码 | **首次启动必填** |
| DEFAULT_ADMIN_USERNAME | 种子管理员用户名 | 可选，默认 kuangjun |
| OSS_ACCESS_KEY_ID / OSS_ACCESS_KEY_SECRET / OSS_BUCKET_NAME | 阿里云 OSS | 使用 OSS 上传时必填 |
| ALIYUN_OSS_ENDPOINT | OSS Endpoint | 可选，有默认地域 |
| JEWELRY_PUBLIC_BASE_URL / B2B_PUBLIC_BASE_URL | B2B 公网基址 | 视部署而定 |

使用 Flyway Maven 插件（`mvn flyway:*`）时，请先在 shell 中 `export DB_PASSWORD=...`，插件从环境变量读取。

## 故障排除

### 常见问题

1. **数据库连接失败**
   - 检查MySQL服务是否运行
   - 检查数据库用户名/密码是否正确
   - 检查防火墙设置

2. **端口冲突**
   - 检查8851端口是否被占用
   - 修改`application.yml`中的`server.port`

3. **构建失败**
   - 检查Java版本是否为17+
   - 检查Maven配置
   - 清理本地Maven仓库：`mvn clean install -U`

### 日志查看

应用日志位于：
- 控制台输出
- `logs/jewelry-system.log`文件
- Docker容器日志：`docker logs jewelry-backend`

## 联系方式

- **项目负责人**: 系统管理员
- **技术支持**: support@jewelry.com
- **问题反馈**: GitHub Issues

## 许可证

Apache License 2.0