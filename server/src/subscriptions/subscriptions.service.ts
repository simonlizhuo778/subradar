import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { occurrencesInRange, computeNextPaymentDate } from '../common/utils/cycle-date';
import type { Cycle } from '../common/utils/cycle-date';
import { AddPaymentDto } from './dto/add-payment.dto';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { ListSubscriptionsDto } from './dto/list-subscriptions.dto';
import { UpdateSubscriptionDto } from './dto/update-subscription.dto';

interface CalendarItem {
  subscriptionId: number;
  name: string;
  amount: number;
  currency: string;
  autoRenew: boolean;
  category: { name: string; color: string | null } | null;
}

@Injectable()
export class SubscriptionsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: number, query: ListSubscriptionsDto) {
    const where: Prisma.SubscriptionWhereInput = { userId };
    if (query.status && query.status !== 'all') {
      where.status = query.status;
    }
    if (query.categoryId !== undefined) {
      where.categoryId = query.categoryId;
    }
    if (query.q) {
      where.name = { contains: query.q.trim() };
    }

    const direction: Prisma.SortOrder = query.order === 'desc' ? 'desc' : 'asc';
    let orderBy: Prisma.SubscriptionOrderByWithRelationInput = { nextPaymentDate: direction };
    if (query.sortBy === 'amount') orderBy = { amount: direction };
    else if (query.sortBy === 'name') orderBy = { name: direction };
    else if (query.sortBy === 'createdAt') orderBy = { createdAt: direction };

    return this.prisma.subscription.findMany({ where, orderBy, include: { category: true } });
  }

  async detail(userId: number, id: number) {
    const sub = await this.prisma.subscription.findFirst({
      where: { id, userId },
      include: {
        category: true,
        payments: { orderBy: { paidAt: 'desc' }, take: 60 },
      },
    });
    if (!sub) {
      throw new NotFoundException('订阅不存在');
    }
    return sub;
  }

  async create(userId: number, dto: CreateSubscriptionDto) {
    await this.assertCategoryOwned(userId, dto.categoryId);
    this.assertCycleFields(dto);

    const firstPaymentDate = new Date(dto.firstPaymentDate);
    const nextPaymentDate = computeNextPaymentDate(
      firstPaymentDate,
      dto.cycle,
      dto.customDays,
    );

    return this.prisma.subscription.create({
      data: {
        userId,
        name: dto.name.trim(),
        logoUrl: dto.logoUrl ?? null,
        categoryId: dto.categoryId ?? null,
        amount: dto.amount,
        currency: (dto.currency ?? 'CNY').toUpperCase(),
        cycle: dto.cycle,
        customDays: dto.cycle === 'custom' ? dto.customDays! : null,
        firstPaymentDate,
        nextPaymentDate,
        paymentMethod: dto.paymentMethod ?? null,
        autoRenew: dto.autoRenew ?? false,
        notes: dto.notes?.trim() || null,
        status: dto.status ?? 'active',
      },
      include: { category: true },
    });
  }

  async update(userId: number, id: number, dto: UpdateSubscriptionDto) {
    const existing = await this.mustGet(userId, id);
    await this.assertCategoryOwned(userId, dto.categoryId);
    this.assertCycleFields(dto);

    const cycle = (dto.cycle ?? existing.cycle) as Cycle;
    const customDays = cycle === 'custom' ? dto.customDays ?? existing.customDays ?? 30 : null;
    const firstPaymentDate = dto.firstPaymentDate
      ? new Date(dto.firstPaymentDate)
      : existing.firstPaymentDate;

    const cycleChanged =
      (dto.cycle !== undefined && dto.cycle !== existing.cycle) ||
      (dto.customDays !== undefined && dto.customDays !== existing.customDays) ||
      dto.firstPaymentDate !== undefined;
    // 从暂停恢复时时间已过去,需要重新滚到当前周期
    const resumed = dto.status === 'active' && existing.status === 'paused';
    const nextPaymentDate =
      cycleChanged || resumed
        ? computeNextPaymentDate(firstPaymentDate, cycle, customDays)
        : existing.nextPaymentDate;

    return this.prisma.subscription.update({
      where: { id },
      data: {
        name: dto.name !== undefined ? dto.name.trim() : undefined,
        logoUrl: dto.logoUrl ?? undefined,
        categoryId: dto.categoryId ?? undefined,
        amount: dto.amount ?? undefined,
        currency: dto.currency !== undefined ? dto.currency.toUpperCase() : undefined,
        cycle,
        customDays,
        firstPaymentDate,
        nextPaymentDate,
        paymentMethod: dto.paymentMethod ?? undefined,
        autoRenew: dto.autoRenew ?? undefined,
        notes: dto.notes !== undefined ? dto.notes.trim() || null : undefined,
        status: dto.status ?? undefined,
      },
      include: { category: true },
    });
  }

  async remove(userId: number, id: number) {
    await this.mustGet(userId, id);
    await this.prisma.subscription.delete({ where: { id } });
    return { ok: true };
  }

  /** 手动补记一笔扣款 */
  async addPayment(userId: number, id: number, dto: AddPaymentDto) {
    const sub = await this.mustGet(userId, id);
    const paidAt = new Date(dto.paidAt);
    return this.prisma.payment.create({
      data: {
        subscriptionId: sub.id,
        amount: dto.amount ?? sub.amount,
        currency: sub.currency,
        paidAt,
        source: 'manual',
      },
    });
  }

  /** 日历视图:展开某月内所有(生效/试用)订阅的扣款日 */
  async calendar(userId: number, month: string) {
    const match = /^(\d{4})-(\d{2})$/.exec(month);
    const year = match ? Number(match[1]) : NaN;
    const monthNumber = match ? Number(match[2]) : NaN;
    if (!match || !(year >= 2000 && year <= 2100) || !(monthNumber >= 1 && monthNumber <= 12)) {
      throw new BadRequestException('month 参数格式应为 YYYY-MM');
    }

    const start = new Date(year, monthNumber - 1, 1);
    const end = new Date(year, monthNumber, 1);

    const subs = await this.prisma.subscription.findMany({
      where: { userId, status: { in: ['active', 'trial'] } },
      include: { category: true },
    });

    const days: Record<string, CalendarItem[]> = {};
    for (const sub of subs) {
      const dates = occurrencesInRange(
        sub.firstPaymentDate,
        sub.cycle as Cycle,
        sub.customDays,
        start,
        end,
      );
      for (const date of dates) {
        const item: CalendarItem = {
          subscriptionId: sub.id,
          name: sub.name,
          amount: sub.amount,
          currency: sub.currency,
          autoRenew: sub.autoRenew,
          category: sub.category
            ? { name: sub.category.name, color: sub.category.color }
            : null,
        };
        const key = localDateKey(date);
        (days[key] ??= []).push(item);
      }
    }
    return { month, days };
  }

  private async mustGet(userId: number, id: number) {
    const sub = await this.prisma.subscription.findFirst({
      where: { id, userId },
      include: { category: true },
    });
    if (!sub) {
      throw new NotFoundException('订阅不存在');
    }
    return sub;
  }

  private async assertCategoryOwned(userId: number, categoryId?: number) {
    if (categoryId === undefined || categoryId === null) return;
    const category = await this.prisma.category.findFirst({
      where: { id: categoryId, userId },
    });
    if (!category) {
      throw new BadRequestException('分类不存在');
    }
  }

  private assertCycleFields(dto: { cycle?: string; customDays?: number }) {
    if (dto.cycle === 'custom' && (dto.customDays === undefined || dto.customDays === null)) {
      throw new BadRequestException('自定义周期必须提供 customDays(1-365 天)');
    }
  }
}

function localDateKey(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
