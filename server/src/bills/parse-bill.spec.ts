import { describe, expect, it } from 'vitest';
import { BillFormatError, parseBillAmount, parseBillCsv, parseBillDate } from './parse-bill';

/** 用本地日期分量断言(时区无关:CI 的 UTC 与本地 +08 结果一致) */
const ymd = (date: Date) => `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;

describe('parseBillCsv(支付宝格式)', () => {
  const alipayCsv = [
    '支付宝交易记录明细查询',
    '账号:[demo@subradar.app]',
    '起始日期:[2026-05-01 00:00:00]    终止日期:[2026-11-01 00:00:00]',
    '----------------------------------------交易记录明细列表----------------------------------------',
    '',
    '交易时间,交易分类,交易对方,商品说明,收/支,金额,收/付款方式,交易状态,交易订单号,商家订单号,备注',
    '2026-05-15 08:00:00,"文化休闲","腾讯科技(深圳)有限公司","腾讯视频VIP会员",支出,"30.00",余额宝,"交易成功",202605151,ORDER01,',
    '2026-06-15 08:00:00,"文化休闲","腾讯科技(深圳)有限公司","腾讯视频VIP会员",支出,"30.00",余额宝,"交易成功",202606151,ORDER02,',
    '2026-07-14 08:00:00,"文化休闲","腾讯科技(深圳)有限公司","腾讯视频VIP会员",支出,"30.00",余额宝,"交易成功",202607141,ORDER03,',
    '2026-08-15 08:00:00,"文化休闲","腾讯科技(深圳)有限公司","腾讯视频VIP会员",支出,"30.00",余额宝,"交易成功",202608141,ORDER04,',
    '2026-09-15 08:00:00,"文化休闲","腾讯科技(深圳)有限公司","腾讯视频VIP会员",支出,"30.00",余额宝,"交易成功",202609151,ORDER05,',
    '2026-10-15 08:00:00,"文化休闲","腾讯科技(深圳)有限公司","腾讯视频VIP会员",支出,"30.00",余额宝,"交易成功",202610151,ORDER06,',
    '2026-10-20 12:00:00,"日用百货","美团平台商户","外卖订单",支出,"45.50",余额,"交易成功",202610201,ORDER07,',
    '2026-10-21 12:00:00,"日用百货","美团平台商户","外卖订单",支出,"22.00",余额,"交易成功",202610211,ORDER08,',
    '2026-10-01 10:00:00,"转账","某人","还款",收入,"100.00",余额,"交易成功",202610011,ORDER09,',
    '2026-10-02 10:00:00,"退款","腾讯科技(深圳)有限公司","退款",支出,"30.00",余额,"退款成功",202610021,ORDER10,',
    '2026-xx-xx 10:00:00,"坏行","坏行","x",支出,"30.00",余额,"交易成功",202610031,ORDER11,',
    '----------------------------------------交易记录明细列表结束----------------------------------------',
  ].join('\r\n');

  it('跳过头尾说明行,正确解析数据行', () => {
    const result = parseBillCsv(alipayCsv);
    // 12 行数据(含坏行):腾讯 6 + 美团 2 + 收入 1 + 退款 1 + 坏行 1 + 结束行不计
    expect(result.totalRows).toBe(11);
    // 收入/退款静默跳过;坏行进 failedRows
    expect(result.rows).toHaveLength(8);
    expect(result.failedRows).toEqual([
      { line: 17, reason: '交易时间无法解析:"2026-xx-xx 10:00:00"' },
    ]);
    const first = result.rows[0];
    expect(first.merchant).toBe('腾讯科技(深圳)有限公司');
    expect(first.amount).toBe(30);
    expect(first.direction).toBe('out');
    expect(first.memo).toBe('腾讯视频VIP会员');
    expect(ymd(first.occurredAt)).toBe('2026-5-15');
    expect(first.occurredAt.getHours()).toBe(8);
  });

  it('找不到表头:抛 BillFormatError', () => {
    expect(() => parseBillCsv('随便什么内容\n没有表头')).toThrow(BillFormatError);
  });
});

describe('parseBillCsv(微信格式)', () => {
  const wechatCsv = [
    '微信支付账单明细',
    '姓名:张三    导出时间:[2026-11-01 10:00:00]',
    '----------------------',
    '交易时间,交易类型,交易对方,商品,收/支,金额(元),支付方式,当前状态,交易单号,商户单号,备注',
    '2026-05-10 09:00:00,"商户消费","网易云音乐","黑胶VIP",支出,"¥18.00","零钱","已支付",W001,M001,',
    '2026-06-10 09:00:00,"商户消费","网易云音乐","黑胶VIP",支出,"¥18.00","零钱","已支付",W002,M002,',
    '2026-07-10 09:00:00,"商户消费","网易云音乐","黑胶VIP",支出,"¥18.00","零钱","已支付",W003,M003,',
    '已导出全部数据',
  ].join('\n');

  it('微信列名(商品/金额(元)/当前状态)正确映射', () => {
    const result = parseBillCsv(wechatCsv);
    expect(result.rows).toHaveLength(3);
    const first = result.rows[0];
    expect(first.merchant).toBe('网易云音乐');
    expect(first.amount).toBe(18);
    expect(first.memo).toBe('黑胶VIP');
    expect(ymd(first.occurredAt)).toBe('2026-5-10');
    expect(first.occurredAt.getHours()).toBe(9);
    expect(result.failedRows).toHaveLength(0);
  });
});

describe('parseBillDate / parseBillAmount', () => {
  it('日期:带时间与不带时间都支持(按本地时区分量断言)', () => {
    const withTime = parseBillDate('2026-01-01 08:30:00');
    expect(withTime).not.toBeNull();
    expect(ymd(withTime!)).toBe('2026-1-1');
    expect(withTime!.getHours()).toBe(8);
    expect(withTime!.getMinutes()).toBe(30);

    const dateOnly = parseBillDate('2026-01-01');
    expect(ymd(dateOnly!)).toBe('2026-1-1');
    expect(dateOnly!.getHours()).toBe(0);

    expect(parseBillDate('2026/01/01')).toBeNull();
  });

  it('金额:¥ 前缀与千分位逗号都能解析', () => {
    expect(parseBillAmount('30.00')).toBe(30);
    expect(parseBillAmount('¥1,299.00')).toBe(1299);
    expect(parseBillAmount('￥18')).toBe(18);
    expect(parseBillAmount('abc')).toBeNull();
    expect(parseBillAmount('-5')).toBeNull();
  });
});
