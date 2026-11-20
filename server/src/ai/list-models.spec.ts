import { describe, expect, it } from 'vitest';
import { extractModelIds } from './ai-settings.service';

describe('extractModelIds(各家 /models 响应解析)', () => {
  it('OpenAI / DashScope / DeepSeek 标准格式:{object:"list",data:[{id}]}', () => {
    const payload = {
      object: 'list',
      data: [
        { id: 'qwen-plus', object: 'model' },
        { id: 'qwen-vl-plus', object: 'model' },
      ],
    };
    expect(extractModelIds(payload)).toEqual(['qwen-plus', 'qwen-vl-plus']);
  });

  it('数组里直接是字符串(部分中转站)', () => {
    expect(extractModelIds({ data: ['deepseek-v3.2', 'deepseek-v4-flash'] })).toEqual([
      'deepseek-v3.2',
      'deepseek-v4-flash',
    ]);
  });

  it('{ models: [...] } 与裸数组', () => {
    expect(extractModelIds({ models: [{ id: 'glm-4.5' }] })).toEqual(['glm-4.5']);
    expect(extractModelIds(['a', 'b'])).toEqual(['a', 'b']);
  });

  it('用 name 字段命名的服务也能解析', () => {
    expect(extractModelIds({ data: [{ name: 'ep-20250101' }] })).toEqual(['ep-20250101']);
  });

  it('去重 + 排序', () => {
    expect(extractModelIds({ data: [{ id: 'b' }, { id: 'a' }, { id: 'b' }] })).toEqual(['a', 'b']);
  });

  it('无法识别的响应返回空数组(由调用方给出友好提示)', () => {
    expect(extractModelIds(null)).toEqual([]);
    expect(extractModelIds({})).toEqual([]);
    expect(extractModelIds({ data: [{ foo: 1 }] })).toEqual([]);
  });
});