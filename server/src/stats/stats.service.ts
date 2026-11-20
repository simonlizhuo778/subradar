import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { addDays, occurrencesInRange } from '../common/utils/cycle-date';
import type { Cycle } from '../common/utils/cycle-date';
import { round2, yearlyCost } from '../common/utils/cost';

export interface UpcomingItem {
  subscriptionId: number;
  name: string;
  amount: number;
  currency: string;
  nextPaymentDate: Date;
  daysUntil: number;
  categoryName: string | null;
  categoryColor: string | null;
}

export interface SummaryResult {
  activeCount: number;
  pausedCount: number;
  /** 年度成本,按币种分组: { CNY: 4582.2, USD: 1140.0 } */
  yearlyByCurrency: Record<string, number>;
  monthRemaining: number;
  upcoming7Count: number;
  upcoming: UpcomingItem[];
}

export interface CategoryStatRow {
  category: { id: number; name: string; color: string | null } | null;
  count: number;
  yearlyByCurrency: Record<string, number>;
}

export interface MonthlyPoint {
  month: string; // YYYY-MM
  count: number;
  byCurrency: Record<string, number>;
}

export interface TopSubscriptionRow {
  id: number;
  name: string;
  amount: number;
  currency: string;
  cycle: string;
  customDays: number | null;
  yearlyCost: number;
  nextPaymentDate: Date;
  categoryName: string | null;
  categoryColor: string | null;
}

@Injectable()
export class StatsService {
  constructor(private readonly prisma: PrismaService) {}

  /** 概览统计:基于生效/试用订阅的年度折算(口径见 common/utils/cost.ts) */
  async summary(userId: number): Promise<SummaryResult> {
    const subs = await this.prisma.subscription.findMany({
      where: { userId, status: { in: ['active', 'trial'] } },
      include: { category: true },
    });
    const pausedCount = await this.prisma.subscription.count({
      where: { userId, status: 'paused' },
    });

    const now = new Date();
    const in30 = addDays(now, 30);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const yearlyByCurrency: Record<string, number> = {};
    const upcoming: UpcomingItem[] = [];
    let monthRemaining = 0;
    let upcoming7Count = 0;

    for (const sub of subs) {
      yearlyByCurrency[sub.currency] = round2(
        (yearlyByCurrency[sub.currency] ?? 0) + yearlyCost(sub.amount, sub.cycle as Cycle, sub.customDays),
      );

      const daysUntil = Math.ceil((sub.nextPaymentDate.getTime() - now.getTime()) / 86_400_000);
      if (sub.nextPaymentDate <= in30) {
        upcoming.push({
          subscriptionId: sub.id,
          name: sub.name,
          amount: sub.amount,
          currency: sub.currency,
          nextPaymentDate: sub.nextPaymentDate,
          daysUntil,
          categoryName: sub.category?.name ?? null,
          categoryColor: sub.category?.color ?? null,
        });
      }
      if (sub.nextPaymentDate < monthEnd) {
        monthRemaining += 1;
      }
      if (daysUntil <= 7) {
        upcoming7Count += 1;
      }
    }

    upcoming.sort((a, b) => a.nextPaymentDate.getTime() - b.nextPaymentDate.getTime());

    return {
      activeCount: subs.length,
      pausedCount,
      yearlyByCurrency,
      monthRemaining,
      upcoming7Count,
      upcoming: upcoming.slice(0, 10),
    };
  }

  /** 分类统计:每个分类的订阅数与年度成本(按币种) */
  async byCategory(userId: number): Promise<CategoryStatRow[]> {
    const subs = await this.prisma.subscription.findMany({
      where: { userId, status: { in: ['active', 'trial'] } },
      include: { category: true },
    });

    const rows = new Map<string, CategoryStatRow>();
    for (const sub of subs) {
      const key = sub.categoryId == null ? 'none' : String(sub.categoryId);
      let row = rows.get(key);
      if (!row) {
        row = {
          category: sub.category
            ? { id: sub.category.id, name: sub.category.name, color: sub.category.color }
            : null,
          count: 0,
          yearlyByCurrency: {},
        };
        rows.set(key, row);
      }
      row.count += 1;
      row.yearlyByCurrency[sub.currency] = round2(
        (row.yearlyByCurrency[sub.currency] ?? 0) +
          yearlyCost(sub.amount, sub.cycle as Cycle, sub.customDays),
      );
    }

    // 展示顺序:取各分类年成本最大币种值排序,大到小
    const maxOf = (row: CategoryStatRow) => Math.max(0, ...Object.values(row.yearlyByCurrency));
    return Array.from(rows.values()).sort((a, b) => maxOf(b) - maxOf(a));
  }

  /**
   * 月度扣款序列(过去 6 个月 + 未来 6 个月):
   * 把所有生效/试用订阅按周期展开,展示"如果保持现状,每个月会扣多少"。
   * 过去月份是回顾口径,未来月份是预测口径。
   */
  async monthly(userId: number, months = 12): Promise<MonthlyPoint[]> {
    const total = Math.min(24, Math.max(4, Math.floor(months) || 12));
    const pastCount = Math.floor(total / 2);
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() - (pastCount - 1), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + (total - pastCount) + 1, 1);

    const subs = await this.prisma.subscription.findMany({
      where: { userId, status: { in: ['active', 'trial'] } },
    });

    const byMonth = new Map<string, MonthlyPoint>();
    // 先铺满时间轴(包括没有扣款的月份),图表不断档
    for (let cursor = new Date(start); cursor < end; cursor.setMonth(cursor.getMonth() + 1)) {
      const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`;
      byMonth.set(key, { month: key, count: 0, byCurrency: {} });
    }

    for (const sub of subs) {
      const dates = occurrencesInRange(
        sub.firstPaymentDate,
        sub.cycle as Cycle,
        sub.customDays,
        start,
        end,
      );
      for (const date of dates) {
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const point = byMonth.get(key);
        if (!point) continue;
        point.count += 1;
        point.byCurrency[sub.currency] = round2(
          (point.byCurrency[sub.currency] ?? 0) + sub.amount,
        );
      }
    }

    return Array.from(byMonth.values());
  }

  /**
   * 订阅年成本排行(默认前 8):
   * 注意多币种时按数值直接排序,展示端标注币种。
   */
  async top(userId: number, limit = 8): Promise<TopSubscriptionRow[]> {
    const subs = await this.prisma.subscription.findMany({
      where: { userId, status: { in: ['active', 'trial'] } },
      include: { category: true },
    });
    const rows: TopSubscriptionRow[] = subs.map((sub) => ({
      id: sub.id,
      name: sub.name,
      amount: sub.amount,
      currency: sub.currency,
      cycle: sub.cycle,
      customDays: sub.customDays,
      yearlyCost: round2(yearlyCost(sub.amount, sub.cycle as Cycle, sub.customDays)),
      nextPaymentDate: sub.nextPaymentDate,
      categoryName: sub.category?.name ?? null,
      categoryColor: sub.category?.color ?? null,
    }));
    rows.sort((a, b) => b.yearlyCost - a.yearlyCost);
    return rows.slice(0, Math.min(50, Math.max(1, Math.floor(limit) || 8)));
  }
}
