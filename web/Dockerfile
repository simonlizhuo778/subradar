# syntax=docker/dockerfile:1
# 构建上下文 = 仓库根目录:docker build -f web/Dockerfile .
FROM node:22-alpine AS build
RUN corepack enable
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY web/package.json web/
COPY server/package.json server/
COPY server/prisma/schema.prisma server/prisma/
RUN pnpm install --frozen-lockfile --filter subradar-web

COPY web/ web/
RUN pnpm -C web build

# ---------- 运行时:nginx 托管静态资源并反代 /api ----------
FROM nginx:alpine
COPY web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/web/dist /usr/share/nginx/html
EXPOSE 80
