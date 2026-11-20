/**
 * 订阅周期日期推算 —— 全项目最核心的领域逻辑(W2 订阅 CRUD、W5 提醒任务都依赖它)。
 *
 * 关键点:JS 的 setMonth 会"溢出"(1-31 加 1 个月会变成 3-3 而不是 2-28),
 * 所以月度运算必须自己做"月末钳制"(clamp)。
 */

export type Cycle = 'monthly' | 'quarterly' | 'yearly' | 'weekly' | 'custom';

export const CYCLES: Cycle[] = ['monthly', 'quarterly', 'yearly', 'weekly', 'custom'];

const CYCLE_MONTHS: Record<'monthly' | 'quarterly' | 'yearly', number> = {
  monthly: 1,
  quarterly: 3,
  yearly: 12,
};

function daysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

/**
 * 按月加减并做月末钳制:
 *   2026-01-31 + 1 个月 → 2026-02-28
 *   2024-02-29 + 12 个月 → 2025-02-28
 *   2026-03-31 - 1 个月 → 2026-02-28
 */
export function addMonthsClamped(date: Date, months: number): Date {
  const day = date.getDate();
  const result = new Date(
    date.getFullYear(),
    date.getMonth(),
    1,
    date.getHours(),
    date.getMinutes(),
    date.getSeconds(),
    date.getMilliseconds(),
  );
  result.setMonth(result.getMonth() + months);
  const lastDay = daysInMonth(result.getFullYear(), result.getMonth());
  result.setDate(Math.min(day, lastDay));
  return result;
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/** 在 date 基础上前进/后退 count 个周期(count 可为负数) */
export function addCycles(
  date: Date,
  cycle: Cycle,
  customDays: number | null | undefined,
  count = 1,
): Date {
  switch (cycle) {
    case 'monthly':
    case 'quarterly':
    case 'yearly':
      return addMonthsClamped(date, CYCLE_MONTHS[cycle] * count);
    case 'weekly':
      return addDays(date, 7 * count);
    case 'custom':
      return addDays(date, (customDays ?? 30) * count);
    default: {
      const exhaustive: never = cycle;
      throw new Error(`未知的订阅周期: ${String(exhaustive)}`);
    }
  }
}

export function addCycle(date: Date, cycle: Cycle, customDays?: number | null): Date {
  return addCycles(date, cycle, customDays, 1);
}

/**
 * 从首次扣款日推算"下一个"扣款日:
 * 把已经过去的周期全部滚过去,直到落在 now 之后。
 * 每天跑一次的定时任务靠它把逾期订阅"追平"到当前周期。
 */
export function computeNextPaymentDate(
  firstPaymentDate: Date,
  cycle: Cycle,
  customDays?: number | null,
  now: Date = new Date(),
): Date {
  let next = new Date(firstPaymentDate);
  let guard = 0;
  while (next <= now && guard < 10_000) {
    next = addCycle(next, cycle, customDays);
    guard += 1;
  }
  return next;
}

/**
 * 计算订阅在 [start, end) 区间内的所有扣款日 —— 日历视图的核心:
 * 月付订阅每个月都出现,年付只在周年月出现,周付一个月 4~5 次。
 * 先把游标滚到区间起点,再逐周期收集。
 */
export function occurrencesInRange(
  firstPaymentDate: Date,
  cycle: Cycle,
  customDays: number | null | undefined,
  start: Date,
  end: Date,
): Date[] {
  const result: Date[] = [];
  let cursor = new Date(firstPaymentDate);
  let guard = 0;

  // 滚过区间之前的周期
  while (cursor.getTime() < start.getTime() && guard < 10_000) {
    cursor = addCycle(cursor, cycle, customDays);
    guard += 1;
  }
  // 收集区间内的周期
  guard = 0;
  while (cursor.getTime() < end.getTime() && guard < 10_000) {
    result.push(new Date(cursor));
    cursor = addCycle(cursor, cycle, customDays);
    guard += 1;
  }
  return result;
}
