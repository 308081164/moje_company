# 多阶段构建 - 第一阶段: Maven构建
FROM maven:3.9-eclipse-temurin-17 AS builder

WORKDIR /app

# 先复制pom.xml，利用Docker缓存层加速依赖下载
COPY pom.xml .
RUN mvn dependency:go-offline -B

# 复制源代码并构建
COPY src ./src
RUN mvn clean package -DskipTests -B

# 第二阶段: 运行时镜像
FROM eclipse-temurin:17-jre-slim

LABEL maintainer="moje"
LABEL description="3D AIGC 珠宝设计业务服务"

WORKDIR /app

# 创建非root用户
RUN groupadd -r appuser && useradd -r -g appuser -d /app appuser

# 从构建阶段复制JAR包
COPY --from=builder /app/target/*.jar app.jar

# 创建文件存储目录
RUN mkdir -p /app/uploads /app/outputs && \
    chown -R appuser:appuser /app

# 切换到非root用户
USER appuser

# 暴露服务端口
EXPOSE 8854

# JVM参数优化
ENV JAVA_OPTS="-Xms256m -Xmx512m -XX:+UseG1GC -XX:+UseContainerSupport"

# 启动命令
ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar app.jar"]
