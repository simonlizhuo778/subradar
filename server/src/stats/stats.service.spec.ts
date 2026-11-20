import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../prisma/prisma.service';
import { StatsService } from './stats.service';

function makeService() {
  const prisma = {
    subscription: { findMany: vi.fn(), count: vi.fn() },
  };
  const service = new StatsService(prisma as unknown as PrismaService);
  return { service, prisma };
}

describe('StatsService.monthly(月度扣款序列)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 20)); // 2026-11-20
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('时间轴铺满 12 个月(含无扣款月份),月付每月累计一次', async () => {
    const { service, prisma } = makeService();
    prisma.subscription.findMany.mockResolvedValue([
      {
        id: 1,
        amount: 30,
        currency: 'CNY',
        cycle: 'monthly',
        customDays: null,
        firstPaymentDate: new Date(2026, 0, 15),
        status: 'active',
      },
    ]);

    const points = await service.monthly(1, 12);

    expect(points).toHaveLength(12);
    expect(points[0].month).toBe('2026-06'); // 过去 6 个月的起点
    expect(points[11].month).toBe('2027-05'); // 未来 6 个月的终点
    expect(points.reduce((n, p) => n + p.count, 0)).toBe(12); // 月付 12 个月每月 1 次
    expect(points[5]).toMatchObject({ month: '2026-11', count: 1, byCurrency: { CNY: 30 } });
  });

  it('年付只在周年月出现,其他月份为 0 但不断档', async () => {
    const { service, prisma } = makeService();
    prisma.subscription.findMany.mockResolvedValue([
      {
        id: 2,
        amount: 148,
        currency: 'CNY',
        cycle: 'yearly',
        customDays: null,
        firstPaymentDate: new Date(2024, 11, 5),
        status: 'active',
      },
    ]);

    const points = await service.monthly(1, 12);

    expect(points[6]).toMatchObject({ month: '2026-12', count: 1, byCurrency: { CNY: 148 } });
    expect(points[5]).toMatchObject({ month: '2026-11', count: 1, byCurrency: { CNY: 0 } });
  });

  it('多币种按月分组累计', async () => {
    const { service, prisma } = makeService();
    prisma.subscription.findMany.mockResolvedValue([
      {
        id: 1,
        amount: 30,
        currency: 'CNY',
        cycle: 'monthly',
        customDays: null,
        firstPaymentDate: new Date(2026, 0, 15),
        status: 'active',
      },
      {
        id: 2,
        amount: 20,
        currency: 'USD',
        cycle: 'monthly',
        customDays: null,
        firstPaymentDate: new Date(2026, 0, 15),
        status: 'active',
      },
    ]);

    const points = await service.monthly(1, 4);

    expect(points[0].byCurrency).toEqual({ CNY: 30, USD: 20 });
  });
});

describe('StatsService.top(年成本排行)', () => {
  it('按年成本从大到小排序并截断 limit', async () => {
    const { service, prisma } = makeService();
    prisma.subscription.findMany.mockResolvedValue([
      {
        id: 1,
        name: '月付小订阅',
        amount: 15,
        currency: 'CNY',
        cycle: 'monthly',
        customDays: null,
        firstPaymentDate: new Date(2026, 0, 1),
        nextPaymentDate: new Date(2026, 11, 1),
        status: 'active',
        category: { id: 1, name: '视频', color: '#e11d48' },
      },
      {
        id: 2,
        name: '年付大订阅',
        amount: 148,
        currency: 'CNY',
        cycle: 'yearly',
        customDays: null,
        firstPaymentDate: new Date(2026, 0, 1),
        nextPaymentDate: new Date(2027, 0, 1),
        status: 'active',
        category: null,
      },
    ]);

    const rows = await service.top(1, 8);

    expect(rows[0].name).toBe('年付大订阅');
    expect(rows[0].yearlyCost).toBe(148);
    expect(rows[1].yearlyCost).toBeGreaterThan(170); // 15×12=180 量级
    expect(rows[1].categoryName).toBe('视频');
  });
});
