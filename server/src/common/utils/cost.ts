import type { Cycle } from './cycle-date';

/**
 * 成本折算工具:把"单次金额 + 周期"折算成年度成本。
 * 口径:一年按 365 天,月付按 30.44 天/月(×12 与逐月相加一致)。
 */

export function cycleDays(cycle: Cycle, customDays?: number | null): number {
  switch (cycle) {
    case 'weekly':
      return 7;
    case 'monthly':
      return 30.44;
    case 'quarterly':
      return 91.31;
    case 'yearly':
      return 365;
    case 'custom':
      return Math.max(1, customDays ?? 30);
    default: {
      const exhaustive: never = cycle;
      throw new Error(`未知的订阅周期: ${String(exhaustive)}`);
    }
  }
}

/** 年度成本 = amount × 365 / 周期天数 */
export function yearlyCost(amount: number, cycle: Cycle, customDays?: number | null): number {
  return (amount * 365) / cycleDays(cycle, customDays);
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
