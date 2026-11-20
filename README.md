<div align="center">

# 📡 订阅雷达 SubRadar

**从你的真实账单里,把你忘了的订阅自动找出来**

Web 先行 · AI 快速录入(自带 API Key)· 支付宝/微信账单导入 · 周期扣款自动识别

</div>

---

## 为什么做这个

订阅制已经是默认付费形态:视频、音乐、网盘、AI 会员、域名、服务器……但:

- **自动续费刺客**:忘了取消,到期直接被扣一整年;
- **没人说得清**自己到底有多少个订阅在续费、一年总共花多少钱;
- **录入门槛高**:现有工具(包括 8.9k⭐ 的开源 [Wallos](https://github.com/ellite/Wallos))全靠手动逐条录入,用户录 3 条就弃坑。

**SubRadar 的解法:录入近乎零成本** —— 语音说一句、截图发一张、账单导一次,AI 抽取成结构化订阅信息,人工确认即可入库。

> 完整的产品分析、功能清单、数据模型与 API 设计见 [《需求文档》](./需求文档.md)。

## 功能路线(按里程碑推进)

| 周期 | 内容 | 状态 |
|---|---|---|
| W1 | 脚手架 + JWT 认证 + 数据模型(9 表)+ 演示数据 + CI | ✅ |
| W2 | 订阅 CRUD + 日历视图 + 统计概览 | ⬜ |
| W3 | AI 快速录入:BYOK 设置、截图/照片识别、待确认队列 | ⬜ |
| W4 | 语音输入 + 可视化图表(ECharts) | ⬜ |
| W5 | 支付宝/微信账单导入 + 周期扣款识别 + 到期提醒 | ⬜ |
| W6 | 部署上线 + README 打磨 + 演示 GIF | ⬜ |

## 快速开始

要求:**Node ≥ 20**、**pnpm ≥ 10**(Windows/macOS/Linux 均可)

```bash
# 一条命令:安装依赖 → 生成 Prisma Client → 建库 → 灌入演示数据
pnpm setup

# 同时启动前后端(或分别 pnpm dev:server / pnpm dev:web)
pnpm dev
```

| 地址 | 说明 |
|---|---|
| http://localhost:5173 | Web 界面 |
| http://localhost:3000/api/health | 后端健康检查 |
| http://localhost:3000/api/docs | Swagger API 文档 |

**演示账号**:`demo@subradar.app` / `demo1234`(25 个中文订阅 + 100+ 条扣款历史)

## 项目结构

```
subradar/
├── 需求文档.md              # PRD:功能清单 / 数据模型 / API 设计
├── .github/workflows/ci.yml # CI:测试 + 构建
├── server/                  # NestJS + Prisma + SQLite
│   ├── prisma/schema.prisma # 9 张表(订阅/账单/候选/AI 设置/用量…)
│   └── prisma/seed.ts       # 演示数据
│   └── src/
│       ├── auth/            # 注册/登录/JWT(注册自动建 9 个默认分类)
│       ├── users/           # GET /api/me
│       ├── common/utils/cycle-date.ts   # 周期日期推算(月末钳制)
│       └── common/filters/  # 统一错误结构 { code, message, details }
└── web/                     # React 19 + Vite + Tailwind v4
    └── src/
        ├── lib/api.ts       # fetch 封装(自动带 JWT)
        ├── lib/auth.tsx     # 认证上下文
        └── pages/           # 登录 / 注册 / 概览
```

## 技术栈

| 层 | 选型 |
|---|---|
| 前端 | React 19 + Vite + TypeScript + Tailwind CSS v4 |
| 后端 | NestJS 11 + Prisma 6 + SQLite(开发)/ PostgreSQL(生产) |
| 认证 | JWT(passport-jwt + bcryptjs) |
| 测试 | Vitest(周期算法、认证服务) |
| 部署 | Docker + GitHub Actions(规划中,W6) |

**设计要点**:后端是独立的 REST 服务(`/api/*`),后续手机 App 直接复用同一套 API 与鉴权;AI 调用将封装成独立 Provider 适配层(OpenAI 兼容协议),BYOK(用户自带 Key),密钥 AES-256-GCM 加密落库。

## 与同类开源项目的差异

| | [Wallos](https://github.com/ellite/Wallos) | [subs](https://github.com/ajnart/subs) | **SubRadar** |
|---|---|---|---|
| 录入方式 | 全手动 | 全手动 | **语音/截图/账单 + AI 抽取** |
| 中国账单(支付宝/微信) | ❌ | ❌ | ✅(W5) |
| 部署形态 | Docker 自托管 | Docker 自托管 | 托管 Web,注册即用 |

## 常用命令

```bash
pnpm test        # 后端单元测试
pnpm build       # 构建前后端
pnpm db:push     # 同步 schema 到 SQLite
pnpm db:seed     # 重灌演示数据
```

## License

[MIT](./LICENSE)
