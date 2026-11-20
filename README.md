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
| W2 | 订阅 CRUD + 日历视图 + 统计概览 | ✅ |
| W3 | AI 快速录入:BYOK 设置、截图识别、文本抽取、待确认队列 | ✅ |
| W4 | 语音输入 + 统计图表(ECharts) | ✅ |
| W5 | 支付宝/微信账单导入 + 周期扣款识别 + 到期提醒 | ✅ |
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

## AI 快速录入(自带 Key)

1. 登录后进入 **设置 → AI 接入**,选择 Provider(DeepSeek / 智谱 GLM / OpenAI / Gemini / 自定义 OpenAI 兼容端点),粘贴你购买的 API Key,「测试连通」通过后保存——Key 以 **AES-256-GCM** 加密存储,前端只显示掩码;
2. 进入 **AI 录入**:粘贴付款截图(Ctrl+V)/ 拖入 / 手机拍照,或直接输入账单短信、口述文本;
3. 模型抽取的订阅信息进入 **待确认队列**,核对/修改字段后「确认入库」,自动创建订阅并回填历史扣款;
4. 每日调用限额、近 7 天用量与 token 消耗都在设置页可见。

> 说明:文本抽取只需文本模型(如 deepseek-chat);截图识别需要视觉模型(如 glm-4.5v / gpt-4o-mini),两者可分开配置。

## 账单导入:找出你忘了的订阅

1. 导出账单:支付宝网页版「账单」→ 导出 CSV(默认 GBK,自动识别编码);微信「我 → 服务 → 钱包 → 账单 → 常见问题 → 下载账单(用于个人对账)」;
2. 「账单导入」页上传 CSV:解析支出流水(收入/退款自动过滤,失败行逐条报告)→ **周期识别算法**(商户分组 + 金额 ±5% 聚类 + 间隔规律性检验)自动找出周期性扣款;
3. 识别结果进入待确认队列,确认后自动创建订阅并回填全部扣款历史。

## 到期提醒

- 每天自动扫描(服务启动时也会追平一次):3 天内将扣款的订阅生成提醒(幂等,同一周期只提醒一次);
- 顶栏 🔔 铃铛查看提醒列表,可开启浏览器系统通知(新提醒弹出桌面通知);
- 自动续费的订阅逾期会被自动「追平」:推进下次扣款日并补记跳过的扣款;
- 邮件提醒规划在 W6(需配置 SMTP)。

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
│       ├── subscriptions/   # 订阅 CRUD + 日历展开 + 手动补记扣款
│       ├── categories/      # 分类列表
│       ├── stats/           # 统计概览 / 分类统计(年度成本折算)
│       ├── ai/              # BYOK 设置 / Provider 适配 / 图片与文本抽取 / 用量
│       ├── candidates/      # 待确认队列:确认入库 + 回填历史
│       ├── bills/           # 账单导入:CSV 解析(支付宝/微信)+ 周期识别入队
│       ├── reminders/       # 到期提醒:逾期追平 + 幂等生成 + 定时扫描
│       ├── common/utils/cycle-date.ts  # 周期日期推算(月末钳制/日历展开)
│       ├── common/utils/cost.ts        # 年度成本折算口径
│       ├── common/utils/recurring-detect.ts # 周期扣款识别算法
│       ├── common/utils/csv.ts         # CSV 解析 + 编码探测(UTF-8/GB18030)
│       ├── common/utils/secret-crypto.ts # AES-256-GCM 密钥加密
│       └── common/filters/  # 统一错误结构 { code, message, details }
└── web/                     # React 19 + Vite + Tailwind v4
    └── src/
        ├── lib/api.ts       # fetch 封装(自动带 JWT)
        ├── lib/auth.tsx     # 认证上下文
        ├── lib/types.ts     # 前后端共享类型
        ├── lib/format.ts    # 金额/周期/日期格式化
        ├── components/SubscriptionForm.tsx  # 新建/编辑订阅弹窗
        ├── components/CandidateCard.tsx    # AI 候选确认卡片
        ├── components/SubscriptionDetail.tsx # 详情弹窗:扣款时间线 + 补记
        ├── components/NotificationBell.tsx # 提醒铃铛 + 浏览器通知
        ├── components/EChart.tsx           # ECharts 封装(按需引入/自适应/销毁)
        ├── lib/speech.ts                   # Web Speech API 语音识别封装
        └── pages/           # 登录 / 注册 / 概览 / 订阅管理 / 日历 / AI 录入 / 账单导入 / 统计 / 设置
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
