# 使用多阶段构建减少镜像大小
FROM eclipse-temurin:17-jdk-jammy AS builder
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
FROM eclipse-temurin:17-jre-jammy
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