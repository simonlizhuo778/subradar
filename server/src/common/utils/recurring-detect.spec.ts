import { describe, expect, it } from 'vitest';
import {
  beautifyMerchant,
  detectRecurring,
  normalizeMerchant,
} from './recurring-detect';
import type { DetectTransaction } from './recurring-detect';

const d = (iso: string) => new Date(`${iso}T12:00:00`);

function tx(merchant: string, date: string, amount: number): DetectTransaction {
  return { occurredAt: d(date), merchant, amount };
}

describe('detectRecurring(周期扣款识别)', () => {
  it('月付订阅:容忍 28~31 天漂移,正确识别为 monthly', () => {
    const result = detectRecurring([
      tx('腾讯科技(深圳)有限公司', '2026-05-15', 30),
      tx('腾讯科技(深圳)有限公司', '2026-06-15', 30),
      tx('腾讯科技(深圳)有限公司', '2026-07-14', 30), // 29 天
      tx('腾讯科技(深圳)有限公司', '2026-08-15', 30), // 32 天
      tx('腾讯科技(深圳)有限公司', '2026-09-15', 30),
      tx('腾讯科技(深圳)有限公司', '2026-10-15', 30),
    ]);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      cycle: 'monthly',
      amount: 30,
      count: 6,
      firstPaymentDate: '2026-05-15',
      displayName: '腾讯科技',
    });
    expect(result[0].confidence).toBeGreaterThanOrEqual(0.6);
  });

  it('年付:按年出现 3 次 → yearly', () => {
    const result = detectRecurring([
      tx('阿里云计算有限公司', '2024-12-01', 78),
      tx('阿里云计算有限公司', '2025-12-01', 78),
      tx('阿里云计算有限公司', '2026-12-01', 78),
    ]);
    expect(result[0].cycle).toBe('yearly');
    expect(result[0].amount).toBe(78);
  });

  it('外卖类消费:金额波动大 + 间隔不规律 → 不误报', () => {
    const result = detectRecurring([
      tx('美团平台商户', '2026-09-02', 35.5),
      tx('美团平台商户', '2026-09-05', 22.0),
      tx('美团平台商户', '2026-09-09', 48.3),
      tx('美团平台商户', '2026-09-10', 19.9),
      tx('美团平台商户', '2026-09-15', 55.0),
      tx('美团平台商户', '2026-09-18', 28.0),
    ]);
    expect(result).toHaveLength(0);
  });

  it('每日通勤类高频消费(p < 6)→ 直接忽略', () => {
    const result = detectRecurring([
      tx('地铁购票', '2026-10-01', 4),
      tx('地铁购票', '2026-10-02', 4),
      tx('地铁购票', '2026-10-03', 4),
      tx('地铁购票', '2026-10-04', 4),
      tx('地铁购票', '2026-10-05', 4),
    ]);
    expect(result).toHaveLength(0);
  });

  it('同一商户涨价:拆成两条金额序列,各自判定', () => {
    const result = detectRecurring([
      tx('某视频会员', '2026-05-10', 15),
      tx('某视频会员', '2026-06-10', 15),
      tx('某视频会员', '2026-07-10', 15),
      tx('某视频会员', '2026-08-10', 18), // 涨价
      tx('某视频会员', '2026-09-10', 18),
      tx('某视频会员', '2026-10-10', 18),
    ]);
    // 两条序列各 3 笔,都判定为月付
    expect(result).toHaveLength(2);
    expect(result.map((r) => r.amount).sort((a, b) => a - b)).toEqual([15, 18]);
  });

  it('间隔不稳的伪周期(30 天与 45 天交替)→ 不识别', () => {
    const result = detectRecurring([
      tx('某服务', '2026-01-01', 20),
      tx('某服务', '2026-02-01', 20),
      tx('某服务', '2026-03-15', 20),
      tx('某服务', '2026-04-15', 20),
      tx('某服务', '2026-05-30', 20),
    ]);
    expect(result).toHaveLength(0);
  });

  it('季付:约 90 天间隔 → quarterly', () => {
    const result = detectRecurring([
      tx('某云服务商', '2026-01-10', 238),
      tx('某云服务商', '2026-04-10', 238),
      tx('某云服务商', '2026-07-09', 238),
      tx('某云服务商', '2026-10-08', 238),
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].cycle).toBe('quarterly');
  });

  it('非标准周期(如 60 天)→ custom + cycleDays', () => {
    const result = detectRecurring([
      tx('某云服务商', '2026-01-10', 238),
      tx('某云服务商', '2026-03-11', 238),
      tx('某云服务商', '2026-05-10', 238),
      tx('某云服务商', '2026-07-09', 238),
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].cycle).toBe('custom');
    expect(result[0].cycleDays).toBe(60);
  });

  it('不足 3 笔的序列不判定', () => {
    const result = detectRecurring([
      tx('某订阅', '2026-06-01', 25),
      tx('某订阅', '2026-07-01', 25),
    ]);
    expect(result).toHaveLength(0);
  });
});

describe('normalizeMerchant / beautifyMerchant', () => {
  it('归一化:去空白装饰符,忽略大小写', () => {
    expect(normalizeMerchant('  Tencent Tech ')).toBe('tencenttech');
    expect(normalizeMerchant('●美团')).toBe('美团');
  });

  it('同名不同空格的商户合并到一组', () => {
    const result = detectRecurring([
      tx('某视频 VIP', '2026-05-01', 30),
      tx('某视频VIP', '2026-06-01', 30),
      tx('某视频 VIP', '2026-07-01', 30),
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].count).toBe(3);
  });

  it('美化:去括注与公司后缀', () => {
    expect(beautifyMerchant('腾讯科技(深圳)有限公司')).toBe('腾讯科技');
    expect(beautifyMerchant('某某网络技术股份有限公司')).toBe('某某网络技术');
    expect(beautifyMerchant('普通商户')).toBe('普通商户');
  });
});
