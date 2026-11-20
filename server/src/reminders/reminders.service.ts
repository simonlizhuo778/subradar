import { Injectable, Logger, OnApplicationShutdown, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { addCycle, addDays, computeNextPaymentDate } from '../common/utils/cycle-date';
import type { Cycle } from '../common/utils/cycle-date';

/** 提前提醒天数(PRD 默认 3 天) */
const REMIND_DAYS_BEFORE = 3;

/** 扫描间隔:6 小时(防漏,幂等保证重复执行无副作用) */
const SCAN_INTERVAL_MS = 6 * 60 * 60 * 1000;

/**
 * 到期提醒:
 * 1) 追平逾期订阅(自动续费的补记扣款);
 * 2) 为「3 天内将扣款」的订阅生成提醒(站内/浏览器通知),同一周期绝不重复。
 *
 * 说明:这里用 setInterval 而非 @nestjs/schedule,避免额外依赖;
 * 换成 @Cron 装饰器时只需把 scanOnce 挂上去,逻辑不用动。
 */
@Injectable()
export class RemindersService implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(RemindersService.name);
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    void this.scanOnce().catch((e) => this.logger.warn(`启动扫描失败:${String(e)}`));
    this.timer = setInterval(
      () => void this.scanOnce().catch((e) => this.logger.warn(`定时扫描失败:${String(e)}`)),
      SCAN_INTERVAL_MS,
    );
    this.timer.unref?.();
  }

  onApplicationShutdown() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async scanOnce(): Promise<{ rolled: number; created: number }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let rolled = 0;
    let created = 0;

    // ---- 1. 追平逾期:nextPaymentDate 已过期的生效订阅 ----
    const overdue = await this.prisma.subscription.findMany({
      where: {
        status: { in: ['active', 'trial'] },
        nextPaymentDate: { lt: today },
      },
    });
    for (const sub of overdue) {
      const cycle = sub.cycle as Cycle;
      const nextPaymentDate = computeNextPaymentDate(
        sub.firstPaymentDate,
        cycle,
        sub.customDays,
        today,
      );
      // 自动续费视为已扣款:把跳过的周期补记进扣款历史
      if (sub.autoRenew) {
        let cursor = new Date(sub.nextPaymentDate);
        let guard = 0;
        while (cursor < nextPaymentDate && guard < 500) {
          await this.prisma.payment.create({
            data: {
              subscriptionId: sub.id,
              amount: sub.amount,
              currency: sub.currency,
              paidAt: cursor,
              source: 'auto',
            },
          });
          cursor = addCycle(cursor, cycle, sub.customDays);
          guard += 1;
        }
      }
      await this.prisma.subscription.update({
        where: { id: sub.id },
        data: { nextPaymentDate },
      });
      rolled += 1;
    }

    // ---- 2. 生成提醒:3 天内将扣款的订阅 ----
    // 用 lt: today+4 天 覆盖完整的第 3 个自然日(避免扣款日带时间被边界卡掉)
    const due = await this.prisma.subscription.findMany({
      where: {
        status: { in: ['active', 'trial'] },
        nextPaymentDate: { gte: today, lt: addDays(today, REMIND_DAYS_BEFORE + 1) },
      },
    });
    for (const sub of due) {
      const remindDate = addDays(sub.nextPaymentDate, -REMIND_DAYS_BEFORE);
      // 幂等:同一订阅同一提醒日只生成一次
      const exists = await this.prisma.reminder.findFirst({
        where: { subscriptionId: sub.id, remindDate },
      });
      if (exists) continue;
      await this.prisma.reminder.create({
        data: {
          subscriptionId: sub.id,
          remindDate,
          daysBefore: REMIND_DAYS_BEFORE,
          channel: 'web',
          status: 'sent', // 站内通知:创建即送达
          sentAt: new Date(),
        },
      });
      created += 1;
    }

    return { rolled, created };
  }

  /** 通知列表:最近 30 天的提醒(按提醒日倒序) */
  async list(userId: number) {
    const since = addDays(new Date(), -30);
    const reminders = await this.prisma.reminder.findMany({
      where: { subscription: { userId }, remindDate: { gte: since } },
      orderBy: { remindDate: 'desc' },
      take: 50,
      include: {
        subscription: {
          select: {
            id: true,
            name: true,
            amount: true,
            currency: true,
            nextPaymentDate: true,
            category: { select: { name: true, color: true } },
          },
        },
      },
    });
    return reminders.map((r) => ({
      id: r.id,
      remindDate: r.remindDate,
      sentAt: r.sentAt,
      subscription: {
        id: r.subscription.id,
        name: r.subscription.name,
        amount: r.subscription.amount,
        currency: r.subscription.currency,
        nextPaymentDate: r.subscription.nextPaymentDate,
        categoryName: r.subscription.category?.name ?? null,
        categoryColor: r.subscription.category?.color ?? null,
      },
    }));
  }
}
