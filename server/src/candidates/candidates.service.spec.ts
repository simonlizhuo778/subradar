import { NotFoundException } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../prisma/prisma.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import type { CreateSubscriptionDto } from '../subscriptions/dto/create-subscription.dto';
import { CandidatesService } from './candidates.service';

function makeService() {
  const prisma = {
    subscriptionCandidate: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    payment: { create: vi.fn() },
  };
  const subs = { create: vi.fn() };
  const service = new CandidatesService(
    prisma as unknown as PrismaService,
    subs as unknown as SubscriptionsService,
  );
  return { service, prisma, subs };
}

const candidate = { id: 10, userId: 1, status: 'pending' };

const dto: CreateSubscriptionDto = {
  name: '腾讯视频 VIP',
  amount: 30,
  cycle: 'monthly',
  firstPaymentDate: '2026-08-15',
};

describe('CandidatesService.confirm', () => {
  let ctx: ReturnType<typeof makeService>;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 20, 12, 0, 0)); // 2026-11-20
    ctx = makeService();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('确认:创建订阅并回填历史扣款(8-15 起月付,到 11-20 共 3 期)', async () => {
    ctx.prisma.subscriptionCandidate.findFirst.mockResolvedValue(candidate);
    ctx.subs.create.mockResolvedValue({
      id: 26,
      amount: 30,
      currency: 'CNY',
      cycle: 'monthly',
      customDays: null,
    });

    const subscription = await ctx.service.confirm(1, 10, dto);

    expect(subscription.id).toBe(26);
    expect(ctx.subs.create).toHaveBeenCalledWith(1, dto);
    // 回填:8-15 / 9-15 / 10-15 / 11-15(全部早于 2026-11-20)→ 共 4 期
    expect(ctx.prisma.payment.create).toHaveBeenCalledTimes(4);
    const paidDates = ctx.prisma.payment.create.mock.calls.map(
      (call) => call[0].data.paidAt as Date,
    );
    expect(paidDates.map((d) => `${d.getMonth() + 1}-${d.getDate()}`)).toEqual([
      '8-15',
      '9-15',
      '10-15',
      '11-15',
    ]);
    // 候选被标记 confirmed 并关联订阅
    expect(ctx.prisma.subscriptionCandidate.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 10 },
        data: expect.objectContaining({ status: 'confirmed', subscriptionId: 26 }),
      }),
    );
  });

  it('首次扣款日在未来:不回填任何历史', async () => {
    ctx.prisma.subscriptionCandidate.findFirst.mockResolvedValue(candidate);
    ctx.subs.create.mockResolvedValue({ id: 27, amount: 1, currency: 'CNY', cycle: 'monthly', customDays: null });

    await ctx.service.confirm(1, 10, { ...dto, firstPaymentDate: '2026-12-01' });

    expect(ctx.prisma.payment.create).not.toHaveBeenCalled();
  });

  it('候选已处理或不存在:404,且不创建订阅', async () => {
    ctx.prisma.subscriptionCandidate.findFirst.mockResolvedValue(null);

    await expect(ctx.service.confirm(1, 99, dto)).rejects.toThrow(NotFoundException);
    expect(ctx.subs.create).not.toHaveBeenCalled();
  });
});

describe('CandidatesService.dismiss / list', () => {
  it('忽略:标记 dismissed', async () => {
    const { service, prisma } = makeService();
    prisma.subscriptionCandidate.findFirst.mockResolvedValue(candidate);

    await service.dismiss(1, 10);

    expect(prisma.subscriptionCandidate.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 10 },
        data: expect.objectContaining({ status: 'dismissed' }),
      }),
    );
  });

  it('列表:extracted JSON 被反序列化返回', async () => {
    const { service, prisma } = makeService();
    prisma.subscriptionCandidate.findMany.mockResolvedValue([
      {
        id: 10,
        userId: 1,
        source: 'text',
        rawRef: '文本识别',
        extracted: '{"is_subscription":true,"name":"Keep","amount":19}',
        confidence: 0.8,
        status: 'pending',
        subscriptionId: null,
        createdAt: new Date(2026, 10, 20),
        decidedAt: null,
      },
    ]);

    const rows = await service.list(1, 'pending');

    expect((rows[0].extracted as { name: string }).name).toBe('Keep');
  });
});
