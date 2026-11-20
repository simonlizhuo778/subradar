import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { parseExtraction } from './extract.service';

/** parseExtraction 是纯函数,直接喂各种模型真实会返回的"脏"输出 */

describe('parseExtraction(模型输出解析与规范化)', () => {
  it('标准单对象:字段全部映射', () => {
    const result = parseExtraction(
      JSON.stringify({
        is_subscription: true,
        name: '腾讯视频VIP',
        merchant: '腾讯',
        amount: 30,
        currency: 'cny',
        cycle: 'monthly',
        first_payment_date: '2026-5-15',
        next_payment_date: '2026-12-15',
        payment_method: 'alipay',
        auto_renew: true,
        confidence: 0.9,
        evidence: '截图中含"每月自动续费"',
      }),
    );
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      name: '腾讯视频VIP',
      amount: 30,
      currency: 'CNY', // 大写归一
      cycle: 'monthly',
      first_payment_date: '2026-05-15', // 补零
      payment_method: 'alipay',
    });
    expect(result[0].auto_renew).toBe(true);
  });

  it('容忍 ```json 围栏和前后废话', () => {
    const raw = '好的,以下是抽取结果:\n```json\n{"is_subscription":true,"name":"Keep","amount":19,"currency":"CNY","cycle":"monthly","confidence":0.8,"evidence":"每月19元"}\n```\n如需调整请告诉我';
    const result = parseExtraction(raw);
    expect(result[0].name).toBe('Keep');
  });

  it('数组输出:多条订阅全部保留', () => {
    const raw = JSON.stringify([
      { is_subscription: true, name: 'A', amount: 10, cycle: 'monthly', currency: 'CNY' },
      { is_subscription: true, name: 'B', amount: 20, cycle: 'yearly', currency: 'USD' },
    ]);
    const result = parseExtraction(raw);
    expect(result.map((c) => c.name)).toEqual(['A', 'B']);
    expect(result[1].currency).toBe('USD');
  });

  it('非订阅内容:抛出友好错误', () => {
    expect(() => parseExtraction('{"is_subscription": false}')).toThrow(BadRequestException);
  });

  it('非法 JSON:抛错', () => {
    expect(() => parseExtraction('这不是 JSON')).toThrow(BadRequestException);
  });

  it('字段防御:非法枚举→null,字符串金额→数字,confidence 越界钳制', () => {
    const result = parseExtraction(
      JSON.stringify({
        is_subscription: true,
        name: 'X',
        amount: '29.9',
        cycle: 'every-month', // 非法
        payment_method: 'paypal', // 非法
        confidence: 1.8, // 越界
        currency: 'XXX', // 非法 → 默认 CNY
      }),
    );
    expect(result[0]).toMatchObject({
      amount: 29.9,
      cycle: null,
      payment_method: null,
      confidence: 1,
      currency: 'CNY',
    });
  });

  it('缺少 is_subscription 字段:默认按订阅处理', () => {
    const result = parseExtraction(JSON.stringify({ name: 'Y', amount: 1, cycle: 'weekly' }));
    expect(result[0].is_subscription).toBe(true);
  });

  it('数组中混入非订阅项:被过滤掉', () => {
    const raw = JSON.stringify([
      { is_subscription: true, name: 'A', amount: 10 },
      { is_subscription: false, name: '外卖订单' },
    ]);
    const result = parseExtraction(raw);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('A');
  });
});
