import { BadRequestException, NotFoundException } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateSubscriptionDto } from './dto/create-subscription.dto';
import type { ListSubscriptionsDto } from './dto/list-subscriptions.dto';
import type { UpdateSubscriptionDto } from './dto/update-subscription.dto';
import { SubscriptionsService } from './subscriptions.service';

/**
 * 直接 new Service 注入 mock(与 auth.service.spec 同一套路,绕开 vitest/esbuild
 * 不产出 Nest DI 元数据的问题)。假时钟固定在 2026-11-20,保证日期断言确定性。
 */

function makeService() {
  const prisma = {
    subscription: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    category: { findFirst: vi.fn() },
  };
  const service = new SubscriptionsService(prisma as unknown as PrismaService);
  return { service, prisma };
}

/** 用本地日期分量断言,避免时区影响 toISOString */
function ymd(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

describe('SubscriptionsService', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 20, 12, 0, 0));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  describe('create', () => {
    it('由首次扣款日 + 周期自动推算下次扣款日(滚到未来)', async () => {
      const { service, prisma } = makeService();
      prisma.subscription.create.mockResolvedValue({});
      const dto: CreateSubscriptionDto = {
        name: '测试会员',
        amount: 9.9,
        cycle: 'monthly',
        firstPaymentDate: '2026-01-01',
      };

      await service.create(1, dto);

      const data = prisma.subscription.create.mock.calls[0][0].data;
      expect(data.nextPaymentDate).toBeInstanceOf(Date);
      expect(ymd(data.nextPaymentDate)).toBe('2026-12-1');
      expect(data.currency).toBe('CNY');
      expect(data.status).toBe('active');
      expect(data.customDays).toBeNull();
    });

    it('cycle=custom 必须提供 customDays', async () => {
      const { service, prisma } = makeService();
      const dto = {
        name: 'x',
        amount: 1,
        cycle: 'custom',
        firstPaymentDate: '2026-01-01',
      } as CreateSubscriptionDto;

      await expect(service.create(1, dto)).rejects.toThrow(BadRequestException);
      expect(prisma.subscription.create).not.toHaveBeenCalled();
    });

    it('categoryId 必须属于当前用户', async () => {
      const { service, prisma } = makeService();
      prisma.category.findFirst.mockResolvedValue(null);
      const dto: CreateSubscriptionDto = {
        name: 'x',
        amount: 1,
        cycle: 'monthly',
        firstPaymentDate: '2026-01-01',
        categoryId: 999,
      };

      await expect(service.create(1, dto)).rejects.toThrow(BadRequestException);
      expect(prisma.subscription.create).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    const existing = {
      id: 1,
      userId: 1,
      name: '旧名字',
      cycle: 'monthly',
      customDays: null,
      firstPaymentDate: new Date(2026, 7, 1),
      nextPaymentDate: new Date(2026, 11, 1),
      status: 'paused',
    };

    it('从暂停恢复时,重算下次扣款日(滚到未来)', async () => {
      const { service, prisma } = makeService();
      prisma.subscription.findFirst.mockResolvedValue({ ...existing });
      prisma.subscription.update.mockResolvedValue({});
      const dto: UpdateSubscriptionDto = { status: 'active' };

      await service.update(1, 1, dto);

      const data = prisma.subscription.update.mock.calls[0][0].data;
      // 首次扣款 2026-08-01 按月滚:9-1、10-1、11-1 都在过去,12-1 在未来
      expect(ymd(data.nextPaymentDate)).toBe('2026-12-1');
      expect(data.status).toBe('active');
    });

    it('只改名字时,下次扣款日保持不变', async () => {
      const { service, prisma } = makeService();
      prisma.subscription.findFirst.mockResolvedValue({ ...existing, status: 'active' });
      prisma.subscription.update.mockResolvedValue({});
      const dto: UpdateSubscriptionDto = { name: '新名字' };

      await service.update(1, 1, dto);

      const data = prisma.subscription.update.mock.calls[0][0].data;
      expect(data.nextPaymentDate).toBe(existing.nextPaymentDate);
      expect(data.name).toBe('新名字');
    });

    it('周期改为 custom 且未给天数:报错', async () => {
      const { service, prisma } = makeService();
      prisma.subscription.findFirst.mockResolvedValue({ ...existing, status: 'active' });
      const dto = { cycle: 'custom' } as UpdateSubscriptionDto;

      await expect(service.update(1, 1, dto)).rejects.toThrow(BadRequestException);
      expect(prisma.subscription.update).not.toHaveBeenCalled();
    });
  });

  describe('remove / list', () => {
    it('删除不存在的订阅:404', async () => {
      const { service, prisma } = makeService();
      prisma.subscription.findFirst.mockResolvedValue(null);

      await expect(service.remove(1, 99)).rejects.toThrow(NotFoundException);
      expect(prisma.subscription.delete).not.toHaveBeenCalled();
    });

    it('列表:状态/搜索/排序条件正确下推到查询', async () => {
      const { service, prisma } = makeService();
      prisma.subscription.findMany.mockResolvedValue([]);
      const query: ListSubscriptionsDto = { status: 'paused', q: '视频' };

      await service.list(1, query);

      const args = prisma.subscription.findMany.mock.calls[0][0];
      expect(args.where).toEqual({ userId: 1, status: 'paused', name: { contains: '视频' } });
      expect(args.orderBy).toEqual({ nextPaymentDate: 'asc' });
    });
  });

  describe('calendar', () => {
    it('按日分桶:月付订阅在该月出现一次', async () => {
      const { service, prisma } = makeService();
      prisma.subscription.findMany.mockResolvedValue([
        {
          id: 7,
          name: '腾讯视频 VIP',
          amount: 30,
          currency: 'CNY',
          autoRenew: true,
          firstPaymentDate: new Date(2026, 0, 15),
          cycle: 'monthly',
          customDays: null,
          status: 'active',
          category: { id: 1, name: '视频', color: '#e11d48' },
        },
      ]);

      const result = await service.calendar(1, '2026-11');

      expect(Object.keys(result.days)).toEqual(['2026-11-15']);
      expect(result.days['2026-11-15']).toHaveLength(1);
      expect(result.days['2026-11-15'][0].subscriptionId).toBe(7);
    });

    it('month 格式不合法:400', async () => {
      const { service } = makeService();
      await expect(service.calendar(1, '2026/11')).rejects.toThrow(BadRequestException);
      await expect(service.calendar(1, '2026-13')).rejects.toThrow(BadRequestException);
    });
  });
});
