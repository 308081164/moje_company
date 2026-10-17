# 使用多阶段构建减少镜像大小
# backend 构建上下文中没有 Maven Wrapper（mvnw/.mvn），因此这里直接使用 Maven 官方镜像构建
FROM maven:3.9-eclipse-temurin-17 AS builder
WORKDIR /app

# 复制 Maven 配置文件
COPY pom.xml .

# 下载依赖
RUN mvn -B dependency:go-offline

# 复制源代码
COPY src src

# 构建应用
RUN mvn -B package -DskipTests

# 运行时镜像（不 apt-get，避免构建时依赖 Ubuntu 软件源）
FROM eclipse-temurin:17-jre-jammy
WORKDIR /app

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
while ! bash -c "echo > /dev/tcp/mysql/3306" >/dev/null 2>&1; do\n\
  sleep 1\n\
done\n\
\n\
# 执行数据库迁移（如果有迁移文件）\n\
if [ -f "/app/db/migration/V1__init_database.sql" ]; then\n\
  echo "数据库迁移文件存在，等待Flyway自动执行..."\n\
fi\n\
\n\
# 启动Spring Boot应用\n\
echo "启动应用..."\n\
exec java -jar app.jar\n\
' > /app/docker-entrypoint.sh && chmod +x /app/docker-entrypoint.sh

EXPOSE 8851

ENTRYPOINT ["/app/docker-entrypoint.sh"]