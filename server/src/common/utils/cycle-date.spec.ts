import { describe, expect, it } from 'vitest';
import {
  addCycle,
  addCycles,
  addDays,
  addMonthsClamped,
  computeNextPaymentDate,
} from './cycle-date';

const d = (y: number, m: number, day: number) => new Date(y, m - 1, day);

describe('addMonthsClamped(月末钳制)', () => {
  it('1-31 加 1 个月应钳制到 2 月最后一天', () => {
    expect(addMonthsClamped(d(2026, 1, 31), 1)).toEqual(d(2026, 2, 28));
  });

  it('闰年 2-29 加 12 个月应钳制到平年 2-28', () => {
    expect(addMonthsClamped(d(2024, 2, 29), 12)).toEqual(d(2025, 2, 28));
  });

  it('3-31 减 1 个月应钳制到 2 月最后一天', () => {
    expect(addMonthsClamped(d(2026, 3, 31), -1)).toEqual(d(2026, 2, 28));
  });

  it('普通日期不受钳制影响', () => {
    expect(addMonthsClamped(d(2026, 5, 15), 1)).toEqual(d(2026, 6, 15));
    expect(addMonthsClamped(d(2026, 1, 10), -3)).toEqual(d(2025, 10, 10));
  });
});

describe('addCycle / addCycles', () => {
  it('weekly:加一周', () => {
    expect(addCycle(d(2026, 1, 1), 'weekly')).toEqual(d(2026, 1, 8));
  });

  it('custom:加自定义天数', () => {
    expect(addCycle(d(2026, 1, 1), 'custom', 90)).toEqual(d(2026, 4, 1));
  });

  it('custom 未提供天数时默认 30 天', () => {
    expect(addCycle(d(2026, 1, 1), 'custom', null)).toEqual(d(2026, 1, 31));
  });

  it('quarterly:加 3 个月', () => {
    expect(addCycle(d(2026, 1, 15), 'quarterly')).toEqual(d(2026, 4, 15));
  });

  it('负数周期可以倒推(账单回填场景)', () => {
    expect(addCycles(d(2026, 6, 15), 'monthly', null, -3)).toEqual(d(2026, 3, 15));
    expect(addCycles(d(2026, 6, 15), 'custom', 30, -2)).toEqual(d(2026, 4, 16));
  });
});

describe('computeNextPaymentDate(滚到下一个未来扣款日)', () => {
  it('首次扣款日在未来:原样返回', () => {
    const future = d(2026, 12, 1);
    expect(computeNextPaymentDate(future, 'monthly', null, d(2026, 11, 20))).toEqual(future);
  });

  it('首次扣款日在过去:滚过所有已过期周期', () => {
    const first = d(2026, 5, 10);
    const next = computeNextPaymentDate(first, 'monthly', null, d(2026, 11, 20));
    expect(next).toEqual(d(2026, 12, 10));
    expect(next.getTime()).toBeGreaterThan(d(2026, 11, 20).getTime());
  });

  it('月末钳制链不产生非法日期', () => {
    const first = d(2025, 1, 31); // 1-31 起步,连续滚 2 年
    const next = computeNextPaymentDate(first, 'monthly', null, d(2026, 11, 20));
    // 结果必须是 2026-12 的某一天,且 ≤ 31
    expect(next.getFullYear()).toBe(2026);
    expect(next.getMonth()).toBe(11);
    expect(next.getDate()).toBeLessThanOrEqual(31);
    expect(next.getDate()).toBe(28); // 从 31 号链式钳制后会收敛到 28
  });

  it('恰好今天到期:应滚到下一周期', () => {
    const first = d(2026, 11, 20);
    const next = computeNextPaymentDate(first, 'monthly', null, d(2026, 11, 20));
    expect(next).toEqual(d(2026, 12, 20));
  });
});

describe('addDays', () => {
  it('跨月进位', () => {
    expect(addDays(d(2026, 1, 30), 3)).toEqual(d(2026, 2, 2));
  });

  it('负数回退', () => {
    expect(addDays(d(2026, 3, 1), -1)).toEqual(d(2026, 2, 28));
  });
});
