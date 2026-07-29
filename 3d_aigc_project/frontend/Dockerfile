# ==========================================
# 澶氶樁娈垫瀯寤猴細Node.js鏋勫缓 + Nginx鏈嶅姟
# ==========================================

FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm config set registry https://registry.npmmirror.com \
    && npm ci

COPY . .
RUN npx vite build

FROM nginx:1.25-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 8853

HEALTHCHECK --interval=30s --timeout=3s --start-period=15s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8853/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
