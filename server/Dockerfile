# syntax=docker/dockerfile:1
# 构建上下文 = 仓库根目录:docker build -f server/Dockerfile .
FROM node:22-alpine AS build
RUN corepack enable
WORKDIR /app

# 先装依赖(利用层缓存):锁文件 + server 的 package.json + schema
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY server/package.json server/
COPY server/prisma/schema.prisma server/prisma/
RUN pnpm install --frozen-lockfile --filter subradar-server
RUN pnpm -C server exec prisma generate

COPY server/ server/
RUN pnpm -C server build

# ---------- 运行时 ----------
FROM node:22-alpine
WORKDIR /app/server
ENV NODE_ENV=production \
    PORT=3000 \
    TZ=Asia/Shanghai

# hoisted 布局:依赖在上级 node_modules
COPY --from=build /app/node_modules /app/node_modules
COPY --from=build /app/server/dist ./dist
COPY --from=build /app/server/prisma ./prisma
# seed.ts 会 import ../src/common/utils/cycle-date,运行时需要这份源码
COPY --from=build /app/server/src ./src

EXPOSE 3000
# 启动前建表(db push 幂等);可选灌入演示数据(SEED_DEMO=true)
CMD ["sh", "-c", "mkdir -p prisma/data && node /app/node_modules/prisma/build/index.js db push --schema prisma/schema.prisma --skip-generate && if [ \"$SEED_DEMO\" = \"true\" ]; then node /app/node_modules/tsx/dist/cli.mjs prisma/seed.ts; fi && node dist/main.js"]
