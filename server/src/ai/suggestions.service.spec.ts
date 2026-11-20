import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { parseSuggestions } from './suggestions.service';

describe('parseSuggestions(省钱建议输出解析)', () => {
  it('标准数组输出:字段全部映射', () => {
    const result = parseSuggestions(
      JSON.stringify([
        {
          title: '合并视频会员',
          detail: '腾讯视频与爱奇艺功能重叠,保留一个每年可省 300 元',
          priority: 'HIGH',
          related: ['腾讯视频 VIP', '爱奇艺黄金 VIP'],
          potential_yearly_saving: 300,
        },
      ]),
    );
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      title: '合并视频会员',
      detail: '腾讯视频与爱奇艺功能重叠,保留一个每年可省 300 元',
      priority: 'high', // 大写归一
      related: ['腾讯视频 VIP', '爱奇艺黄金 VIP'],
      potentialYearlySaving: 300,
    });
  });

  it('容忍 ```json 围栏', () => {
    const raw = '```json\n[{"title":"t","detail":"d","priority":"low"}]\n```';
    expect(parseSuggestions(raw)).toHaveLength(1);
  });

  it('单对象输出 → 包装为数组', () => {
    expect(parseSuggestions('{"title":"t","detail":"d"}')).toHaveLength(1);
  });

  it('缺 title 或 detail 的项被丢弃;上限 8 条', () => {
    const list = Array.from({ length: 12 }, (_, i) => ({ title: `t${i}`, detail: 'd' }));
    list.push({ title: '只有标题没有正文', detail: '' });
    const result = parseSuggestions(JSON.stringify(list));
    expect(result).toHaveLength(8);
  });

  it('非法 priority 归为 medium;非法金额归为 null', () => {
    const result = parseSuggestions(
      JSON.stringify([{ title: 't', detail: 'd', priority: 'urgent', potential_yearly_saving: -5 }]),
    );
    expect(result[0].priority).toBe('medium');
    expect(result[0].potentialYearlySaving).toBeNull();
  });

  it('related 里混入非字符串被过滤', () => {
    const result = parseSuggestions(
      JSON.stringify([{ title: 't', detail: 'd', related: ['A', 42, null] }]),
    );
    expect(result[0].related).toEqual(['A']);
  });

  it('非法 JSON:抛错', () => {
    expect(() => parseSuggestions('不是 JSON')).toThrow(BadRequestException);
  });
});
