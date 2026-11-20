import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../prisma/prisma.service';
import { RemindersService } from './reminders.service';

function makeService() {
  const prisma = {
    subscription: { findMany: vi.fn(), update: vi.fn() },
    payment: { create: vi.fn() },
    reminder: { findFirst: vi.fn(), create: vi.fn(), findMany: vi.fn() },
  };
  const service = new RemindersService(prisma as unknown as PrismaService);
  return { service, prisma };
}

const ymd = (date: Date) =>
  `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;

describe('RemindersService.scanOnce', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 20, 12, 0, 0)); // 2026-11-20
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('追平逾期订阅:自动续费的补记扣款,并推进下次扣款日', async () => {
    const { service, prisma } = makeService();
    prisma.subscription.findMany
      // 第一次调用:逾期列表;第二次调用:3 天内到期列表(空)
      .mockResolvedValueOnce([
        {
          id: 1,
          firstPaymentDate: new Date(2026, 7, 15),
          nextPaymentDate: new Date(2026, 10, 15), // 已过期 5 天
          cycle: 'monthly',
          customDays: null,
          autoRenew: true,
          amount: 30,
          currency: 'CNY',
        },
      ])
      .mockResolvedValueOnce([]);
    prisma.reminder.create.mockResolvedValue({});

    const result = await service.scanOnce();

    expect(result.rolled).toBe(1);
    // 补记 11-15 一期(下一期 12-15 在未来)
    expect(prisma.payment.create).toHaveBeenCalledTimes(1);
    const payment = prisma.payment.create.mock.calls[0][0].data;
    expect(ymd(payment.paidAt)).toBe('2026-11-15');
    expect(payment.source).toBe('auto');
    // 下次扣款日推进到 12-15
    const update = prisma.subscription.update.mock.calls[0][0];
    expect(ymd(update.data.nextPaymentDate)).toBe('2026-12-15');
  });

  it('逾期但非自动续费:只推进日期,不补记扣款', async () => {
    const { service, prisma } = makeService();
    prisma.subscription.findMany
      .mockResolvedValueOnce([
        {
          id: 2,
          firstPaymentDate: new Date(2026, 7, 15),
          nextPaymentDate: new Date(2026, 10, 15),
          cycle: 'monthly',
          customDays: null,
          autoRenew: false,
          amount: 30,
          currency: 'CNY',
        },
      ])
      .mockResolvedValueOnce([]);

    const result = await service.scanOnce();

    expect(result.rolled).toBe(1);
    expect(prisma.payment.create).not.toHaveBeenCalled();
    expect(prisma.subscription.update).toHaveBeenCalledTimes(1);
  });

  it('3 天内到期:生成提醒;同一提醒日重复扫描不重复生成(幂等)', async () => {
    const { service, prisma } = makeService();
    const dueSub = {
      id: 3,
      firstPaymentDate: new Date(2026, 7, 23),
      nextPaymentDate: new Date(2026, 10, 22), // 2 天后
      cycle: 'monthly',
      customDays: null,
      autoRenew: false,
      amount: 30,
      currency: 'CNY',
    };
    // 第 3 天当天(带时刻)也应命中:窗口覆盖完整第 3 个自然日
    const dueSubDay3 = {
      ...dueSub,
      id: 4,
      nextPaymentDate: new Date(2026, 10, 23, 18, 57),
    };
    prisma.subscription.findMany
      .mockResolvedValueOnce([]) // 无逾期
      .mockResolvedValueOnce([dueSub, dueSubDay3]);
    prisma.reminder.findFirst.mockResolvedValue(null);
    prisma.reminder.create.mockResolvedValue({});

    const first = await service.scanOnce();
    expect(first.created).toBe(2);
    // 提醒日 = 11-22 - 3 天 = 11-19
    const reminder = prisma.reminder.create.mock.calls[0][0].data;
    expect(ymd(reminder.remindDate)).toBe('2026-11-19');
    expect(reminder.channel).toBe('web');

    // 第二次扫描:findFirst 命中已有记录 → 不再生成
    prisma.subscription.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([dueSub, dueSubDay3]);
    prisma.reminder.findFirst.mockResolvedValue({ id: 99 });
    const second = await service.scanOnce();
    expect(second.created).toBe(0);
    expect(prisma.reminder.create).toHaveBeenCalledTimes(2);
  });
});
