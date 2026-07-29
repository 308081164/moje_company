# 多阶段构建 - 第一阶段: Maven构建
FROM maven:3.9-eclipse-temurin-17 AS builder

WORKDIR /app

COPY pom.xml .
RUN mvn dependency:go-offline -B

COPY src ./src
RUN mvn clean package -DskipTests -B

# 第二阶段: 运行时镜像
FROM eclipse-temurin:17-jre-slim

LABEL maintainer="moje"
LABEL description="3D AIGC 珠宝设计业务服务"

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd -r appuser && useradd -r -g appuser -d /app appuser

COPY --from=builder /app/target/*.jar app.jar

RUN mkdir -p /app/data /app/uploads /app/outputs /app/inlay_cache /app/inlay-storage \
    && chown -R appuser:appuser /app

USER appuser

EXPOSE 8854

ENV JAVA_OPTS="-Xms256m -Xmx512m -XX:+UseG1GC -XX:+UseContainerSupport"

HEALTHCHECK --interval=15s --timeout=5s --start-period=60s --retries=8 \
    CMD curl -f http://localhost:8854/api/system/health || exit 1

ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar app.jar"]
