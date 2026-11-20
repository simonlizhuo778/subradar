/**
 * 演示数据 seed —— 演示账号:demo@subradar.app / demo1234
 * 运行方式:根目录 `pnpm db:seed`(即 prisma db seed → tsx prisma/seed.ts)
 *
 * 设计:每条订阅用 nextInDays(距下次扣款天数)倒推 firstPaymentDate,
 * 保证演示库里近几天总有"即将扣款"的订阅,日历/提醒功能上线后立刻有戏可看。
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';
import { addCycle, addCycles, addDays } from '../src/common/utils/cycle-date';

// seed 独立于 Nest 进程运行,不经过 ConfigModule,这里手动加载 .env
if (!process.env.DATABASE_URL) {
  const envPath = resolve(__dirname, '../.env');
  if (existsSync(envPath)) {
    for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*"?([^"\r\n]*)"?\s*$/);
      if (m && process.env[m[1]] === undefined) {
        process.env[m[1]] = m[2];
      }
    }
  }
}

const prisma = new PrismaClient();

const CATEGORIES = [
  { name: '视频', color: '#e11d48', sort: 1 },
  { name: '音乐', color: '#8b5cf6', sort: 2 },
  { name: '云存储', color: '#0ea5e9', sort: 3 },
  { name: 'AI 工具', color: '#10b981', sort: 4 },
  { name: '效率办公', color: '#f59e0b', sort: 5 },
  { name: '阅读学习', color: '#6366f1', sort: 6 },
  { name: '健康健身', color: '#22c55e', sort: 7 },
  { name: '电商购物', color: '#f43f5e', sort: 8 },
  { name: '开发者', color: '#64748b', sort: 9 },
];

interface SubSeed {
  name: string;
  category: string;
  amount: number;
  currency: string;
  cycle: 'monthly' | 'quarterly' | 'yearly' | 'weekly' | 'custom';
  customDays?: number;
  nextInDays: number;
  cyclesAgo: number;
  paymentMethod: string;
  autoRenew: boolean;
  notes?: string;
  status?: string;
}

const SUBS: SubSeed[] = [
  // 视频
  { name: '腾讯视频 VIP', category: '视频', amount: 30, currency: 'CNY', cycle: 'monthly', nextInDays: 3, cyclesAgo: 6, paymentMethod: 'alipay', autoRenew: true },
  { name: '爱奇艺黄金 VIP', category: '视频', amount: 25, currency: 'CNY', cycle: 'monthly', nextInDays: 12, cyclesAgo: 4, paymentMethod: 'wechat', autoRenew: true },
  { name: '哔哩哔哩大会员(年卡)', category: '视频', amount: 148, currency: 'CNY', cycle: 'yearly', nextInDays: 45, cyclesAgo: 2, paymentMethod: 'alipay', autoRenew: false },
  { name: '芒果 TV 会员', category: '视频', amount: 19, currency: 'CNY', cycle: 'monthly', nextInDays: 21, cyclesAgo: 3, paymentMethod: 'apple', autoRenew: true },
  { name: 'Netflix 标准档', category: '视频', amount: 15.49, currency: 'USD', cycle: 'monthly', nextInDays: 8, cyclesAgo: 9, paymentMethod: 'card', autoRenew: true },
  // 音乐
  { name: '网易云音乐黑胶 VIP', category: '音乐', amount: 18, currency: 'CNY', cycle: 'monthly', nextInDays: 5, cyclesAgo: 12, paymentMethod: 'alipay', autoRenew: true },
  { name: 'QQ音乐豪华绿钻', category: '音乐', amount: 18, currency: 'CNY', cycle: 'monthly', nextInDays: 17, cyclesAgo: 5, paymentMethod: 'wechat', autoRenew: true },
  // 云存储
  { name: 'iCloud+ 50GB', category: '云存储', amount: 6, currency: 'CNY', cycle: 'monthly', nextInDays: 2, cyclesAgo: 14, paymentMethod: 'apple', autoRenew: true },
  { name: '百度网盘超级会员', category: '云存储', amount: 29.9, currency: 'CNY', cycle: 'monthly', nextInDays: 26, cyclesAgo: 7, paymentMethod: 'alipay', autoRenew: true },
  { name: '阿里云盘 SVIP', category: '云存储', amount: 18, currency: 'CNY', cycle: 'monthly', nextInDays: 15, cyclesAgo: 3, paymentMethod: 'alipay', autoRenew: false, status: 'paused' },
  // AI 工具
  { name: 'ChatGPT Plus', category: 'AI 工具', amount: 20, currency: 'USD', cycle: 'monthly', nextInDays: 6, cyclesAgo: 10, paymentMethod: 'card', autoRenew: true },
  { name: 'Claude Pro', category: 'AI 工具', amount: 20, currency: 'USD', cycle: 'monthly', nextInDays: 11, cyclesAgo: 6, paymentMethod: 'card', autoRenew: true },
  { name: 'GitHub Copilot', category: 'AI 工具', amount: 10, currency: 'USD', cycle: 'monthly', nextInDays: 19, cyclesAgo: 8, paymentMethod: 'card', autoRenew: true },
  { name: 'Cursor Pro', category: 'AI 工具', amount: 20, currency: 'USD', cycle: 'monthly', nextInDays: 1, cyclesAgo: 4, paymentMethod: 'card', autoRenew: true },
  // 效率办公
  { name: 'WPS 超级会员', category: '效率办公', amount: 179, currency: 'CNY', cycle: 'yearly', nextInDays: 60, cyclesAgo: 2, paymentMethod: 'alipay', autoRenew: false },
  { name: 'Notion Plus', category: '效率办公', amount: 10, currency: 'USD', cycle: 'monthly', nextInDays: 23, cyclesAgo: 5, paymentMethod: 'card', autoRenew: true },
  { name: '滴答清单高级版', category: '效率办公', amount: 139, currency: 'CNY', cycle: 'yearly', nextInDays: 120, cyclesAgo: 1, paymentMethod: 'wechat', autoRenew: false },
  // 阅读学习
  { name: '微信读书无限卡', category: '阅读学习', amount: 19, currency: 'CNY', cycle: 'monthly', nextInDays: 9, cyclesAgo: 11, paymentMethod: 'wechat', autoRenew: true },
  { name: '知乎盐选会员', category: '阅读学习', amount: 19, currency: 'CNY', cycle: 'monthly', nextInDays: 28, cyclesAgo: 4, paymentMethod: 'alipay', autoRenew: true },
  // 健康健身
  { name: 'Keep 会员', category: '健康健身', amount: 19, currency: 'CNY', cycle: 'monthly', nextInDays: 14, cyclesAgo: 6, paymentMethod: 'apple', autoRenew: true },
  // 电商购物
  { name: '京东 PLUS 会员', category: '电商购物', amount: 79, currency: 'CNY', cycle: 'yearly', nextInDays: 200, cyclesAgo: 3, paymentMethod: 'wechat', autoRenew: false },
  // 开发者
  { name: '阿里云 .com 域名', category: '开发者', amount: 78, currency: 'CNY', cycle: 'yearly', nextInDays: 80, cyclesAgo: 2, paymentMethod: 'alipay', autoRenew: true, notes: 'subradar.cn' },
  { name: '腾讯云轻量服务器', category: '开发者', amount: 238, currency: 'CNY', cycle: 'custom', customDays: 90, nextInDays: 40, cyclesAgo: 4, paymentMethod: 'wechat', autoRenew: true },
  { name: 'Vercel Pro', category: '开发者', amount: 20, currency: 'USD', cycle: 'monthly', nextInDays: 4, cyclesAgo: 7, paymentMethod: 'card', autoRenew: true },
  { name: 'Resend 邮件服务(免费档)', category: '开发者', amount: 0, currency: 'USD', cycle: 'monthly', nextInDays: 20, cyclesAgo: 5, paymentMethod: 'card', autoRenew: true, notes: '免费档记录在案,防止超额' },
];

async function main() {
  // 清空旧数据(仅限演示库,切勿用于生产)
  await prisma.reminder.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.subscriptionCandidate.deleteMany();
  await prisma.usageLog.deleteMany();
  await prisma.aiSetting.deleteMany();
  await prisma.billTransaction.deleteMany();
  await prisma.billImport.deleteMany();
  await prisma.subscription.deleteMany();
  await prisma.category.deleteMany();
  await prisma.user.deleteMany();

  const demo = await prisma.user.create({
    data: {
      email: 'demo@subradar.app',
      passwordHash: await hash('demo1234', 10),
      displayName: '演示用户',
    },
  });

  const catByName = new Map<string, number>();
  for (const c of CATEGORIES) {
    const cat = await prisma.category.create({ data: { ...c, userId: demo.id } });
    catByName.set(cat.name, cat.id);
  }

  const today = new Date();
  let paymentCount = 0;

  for (const s of SUBS) {
    const nextPaymentDate = addDays(today, s.nextInDays);
    const firstPaymentDate = addCycles(nextPaymentDate, s.cycle, s.customDays, -s.cyclesAgo);

    const sub = await prisma.subscription.create({
      data: {
        userId: demo.id,
        name: s.name,
        categoryId: catByName.get(s.category) ?? null,
        amount: s.amount,
        currency: s.currency,
        cycle: s.cycle,
        customDays: s.customDays ?? null,
        firstPaymentDate,
        nextPaymentDate,
        paymentMethod: s.paymentMethod,
        autoRenew: s.autoRenew,
        notes: s.notes ?? null,
        status: s.status ?? 'active',
      },
    });

    // 回填扣款历史
    let paidAt = firstPaymentDate;
    let guard = 0;
    while (paidAt < today && guard < 500) {
      await prisma.payment.create({
        data: {
          subscriptionId: sub.id,
          amount: s.amount,
          currency: s.currency,
          paidAt,
          source: 'import',
        },
      });
      paymentCount += 1;
      paidAt = addCycle(paidAt, s.cycle, s.customDays);
      guard += 1;
    }
  }

  console.log(`✔ seed 完成:${SUBS.length} 个订阅、${paymentCount} 条扣款历史、${CATEGORIES.length} 个分类`);
  console.log('  演示账号:demo@subradar.app / demo1234');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
