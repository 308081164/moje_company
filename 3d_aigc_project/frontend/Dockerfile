# ==========================================
# 多阶段构建：Node.js构建 + Nginx服务
# ==========================================

# 阶段1：构建阶段
FROM node:20-alpine AS builder

# 设置工作目录
WORKDIR /app

# 复制依赖配置文件
COPY package.json ./

# 安装依赖（使用国内镜像加速）
RUN npm config set registry https://registry.npmmirror.com && \
    npm install

# 复制源代码
COPY . .

# 构建生产版本
RUN npm run build

# 阶段2：生产阶段
FROM nginx:1.25-alpine

# 复制自定义nginx配置
COPY nginx.conf /etc/nginx/conf.d/default.conf

# 从构建阶段复制构建产物
COPY --from=builder /app/dist /usr/share/nginx/html

# 暴露8853端口
EXPOSE 8853

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8853/ || exit 1

# 启动nginx
CMD ["nginx", "-g", "daemon off;"]
