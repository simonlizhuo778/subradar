import { describe, expect, it } from 'vitest';
import { cycleDays, round2, yearlyCost } from './cost';

describe('cycleDays(周期天数口径)', () => {
  it('各周期口径', () => {
    expect(cycleDays('weekly')).toBe(7);
    expect(cycleDays('monthly')).toBe(30.44);
    expect(cycleDays('yearly')).toBe(365);
    expect(cycleDays('custom', 90)).toBe(90);
  });

  it('custom 未给天数时兜底 30 天', () => {
    expect(cycleDays('custom')).toBe(30);
    expect(cycleDays('custom', null)).toBe(30);
  });
});

describe('yearlyCost(年度成本折算)', () => {
  it('月付 30 元 ≈ 360 元/年', () => {
    expect(yearlyCost(30, 'monthly')).toBeCloseTo(360, 0);
  });

  it('年付保持原值', () => {
    expect(yearlyCost(148, 'yearly')).toBe(148);
  });

  it('季付 25 元 ≈ 100 元/年', () => {
    expect(yearlyCost(25, 'quarterly')).toBeCloseTo(100, 0);
  });

  it('周付 10 元 ≈ 521 元/年', () => {
    expect(yearlyCost(10, 'weekly')).toBeCloseTo(521.4, 0);
  });

  it('自定义 90 天 238 元', () => {
    expect(yearlyCost(238, 'custom', 90)).toBeCloseTo(965, 0);
  });

  it('免费订阅成本为 0', () => {
    expect(yearlyCost(0, 'monthly')).toBe(0);
  });
});

describe('round2', () => {
  it('保留两位小数', () => {
    expect(round2(123.456)).toBe(123.46);
    expect(round2(123.454)).toBe(123.45);
    expect(round2(0.1 + 0.2)).toBe(0.3);
  });
});
