import { describe, expect, it } from 'vitest';
import { decodeCsvText, parseCsvLine, stripBom } from './csv';

describe('parseCsvLine', () => {
  it('普通字段', () => {
    expect(parseCsvLine('a,b,c')).toEqual(['a', 'b', 'c']);
  });

  it('引号包裹的字段内含逗号', () => {
    expect(parseCsvLine('"腾讯科技(深圳)有限公司","30.00",支出')).toEqual([
      '腾讯科技(深圳)有限公司',
      '30.00',
      '支出',
    ]);
  });

  it('转义的双引号(引号里套引号)', () => {
    expect(parseCsvLine('"他说""好""",b')).toEqual(['他说"好"', 'b']);
  });

  it('字段自动去首尾空白', () => {
    expect(parseCsvLine(' a , "b" ,c ')).toEqual(['a', 'b', 'c']);
  });

  it('空行 → 单个空字段', () => {
    expect(parseCsvLine('')).toEqual(['']);
  });
});

describe('decodeCsvText(编码探测)', () => {
  it('UTF-8 内容按 UTF-8 解', () => {
    const buffer = Buffer.from('交易时间,金额\n2026-01-01,30.00', 'utf8');
    expect(decodeCsvText(buffer)).toContain('交易时间');
  });

  it('GBK/GB18030 内容自动回退解码(支付宝导出场景)', () => {
    // '腾讯科技(深圳)有限公司,支出' 的 GB18030 字节序列(Node Buffer 不支持 gb18030 编码,故用 hex)
    const buffer = Buffer.from('ccdad1b6bfc6bcbc28c9eedbda29d3d0cfdeb9abcbbe2cd6a7b3f6', 'hex');
    // 强制非 UTF-8 字节,应回退到 gb18030 且不乱码
    expect(decodeCsvText(buffer)).toBe('腾讯科技(深圳)有限公司,支出');
  });
});

describe('stripBom', () => {
  it('去掉 UTF-8 BOM', () => {
    expect(stripBom('\uFEFF交易时间')).toBe('交易时间');
    expect(stripBom('交易时间')).toBe('交易时间');
  });
});
