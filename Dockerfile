# syntax=docker/dockerfile:1
# 单容器镜像:前端静态文件 + NestJS API 跑在同一个端口(默认 8080)
# 构建:docker build -t subradar .
# 运行:docker run -p 8080:8080 -v subradar-data:/app/server/prisma/data \
#         -e JWT_SECRET=xxx -e MASTER_KEY=xxx subradar
FROM node:22-alpine AS build
RUN corepack enable
WORKDIR /app

# 先装依赖(利用层缓存)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY server/package.json server/
COPY web/package.json web/
COPY server/prisma/schema.prisma server/prisma/
RUN pnpm install --frozen-lockfile
RUN pnpm -C server exec prisma generate

COPY server/ server/
COPY web/ web/
RUN pnpm -C server build && pnpm -C web build

# ---------- 运行时 ----------
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production \
    PORT=8080 \
    TZ=Asia/Shanghai

# hoisted 布局:依赖统一在根 node_modules
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/server/package.json ./server/package.json
COPY --from=build /app/server/dist ./server/dist
COPY --from=build /app/server/prisma ./server/prisma
# seed.ts 会 import ../src/common/utils/cycle-date,运行时需要这份源码
COPY --from=build /app/server/src ./server/src
COPY --from=build /app/web/dist ./web/dist

EXPOSE 8080

# 启动前建表(db push 幂等);可选灌入演示数据(SEED_DEMO=true)
# 用 .seeded 标记保证演示数据只灌一次,避免每次重启清空真实数据
# SQLite 文件位于 /app/server/prisma/data,部署平台把持久卷挂到这个目录
CMD ["sh", "-c", "cd /app/server && mkdir -p prisma/data && node /app/node_modules/prisma/build/index.js db push --schema prisma/schema.prisma --skip-generate && if [ \"$SEED_DEMO\" = \"true\" ] && [ ! -f prisma/data/.seeded ]; then node /app/node_modules/tsx/dist/cli.mjs prisma/seed.ts && touch prisma/data/.seeded; fi && node dist/main.js"]
