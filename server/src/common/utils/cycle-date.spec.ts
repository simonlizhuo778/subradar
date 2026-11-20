import { describe, expect, it } from 'vitest';
import {
  addCycle,
  addCycles,
  addDays,
  addMonthsClamped,
  computeNextPaymentDate,
  occurrencesInRange,
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
    const first = d(2025, 1, 31); // 1-31 起步,连续滚到 2026-11-20 之后
    const next = computeNextPaymentDate(first, 'monthly', null, d(2026, 11, 20));
    // 首月钳制到 28 号后链式保持,滚到 2026-11-28(11 月的月份索引是 10)
    expect(next.getFullYear()).toBe(2026);
    expect(next.getMonth()).toBe(10);
    expect(next.getDate()).toBe(28);
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

describe('occurrencesInRange(日历展开)', () => {
  it('月付:每月出现一次', () => {
    const r = occurrencesInRange(d(2026, 1, 15), 'monthly', null, d(2026, 11, 1), d(2026, 12, 1));
    expect(r).toEqual([d(2026, 11, 15)]);
  });

  it('周付:一个月出现 4~5 次', () => {
    const r = occurrencesInRange(d(2026, 1, 5), 'weekly', null, d(2026, 11, 1), d(2026, 12, 1));
    expect(r.length).toBeGreaterThanOrEqual(4);
    expect(r.length).toBeLessThanOrEqual(5);
  });

  it('年付:只在周年月出现', () => {
    const hit = occurrencesInRange(d(2024, 11, 20), 'yearly', null, d(2026, 11, 1), d(2026, 12, 1));
    expect(hit).toEqual([d(2026, 11, 20)]);
    const miss = occurrencesInRange(d(2024, 6, 15), 'yearly', null, d(2026, 11, 1), d(2026, 12, 1));
    expect(miss).toEqual([]);
  });

  it('首次扣款日在区间内:从首次日期开始收集', () => {
    const r = occurrencesInRange(d(2026, 11, 25), 'monthly', null, d(2026, 11, 1), d(2026, 12, 1));
    expect(r).toEqual([d(2026, 11, 25)]);
  });

  it('自定义 90 天周期:整年展开 4 次', () => {
    const r = occurrencesInRange(d(2026, 3, 30), 'custom', 90, d(2026, 1, 1), d(2027, 1, 1));
    const keys = r.map((x) => `${x.getFullYear()}-${x.getMonth() + 1}-${x.getDate()}`);
    expect(keys).toEqual(['2026-3-30', '2026-6-28', '2026-9-26', '2026-12-25']);
  });

  it('区间完全在首次扣款日之前:空结果', () => {
    const r = occurrencesInRange(d(2027, 6, 1), 'monthly', null, d(2026, 11, 1), d(2026, 12, 1));
    expect(r).toEqual([]);
  });
});
