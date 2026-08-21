FROM nginx:alpine

# 复制静态站点资源
COPY . /usr/share/nginx/html

# 覆盖默认 Nginx 配置（静态站点 + 反代 /api 到 backend）
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
