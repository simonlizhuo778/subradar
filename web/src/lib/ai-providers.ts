/** 与后端 server/src/ai/providers.ts 的预设保持一致(前端展示用) */
export interface ProviderPresetInfo {
  key: string;
  label: string;
  baseUrl: string;
  defaultModel: string;
  defaultVisionModel: string;
  supportsVision: boolean;
  hint: string;
}

export const AI_PROVIDERS: ProviderPresetInfo[] = [
  {
    key: 'deepseek',
    label: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com',
    defaultModel: 'deepseek-chat',
    defaultVisionModel: '',
    supportsVision: false,
    hint: '文本抽取便宜好用;官方 API 暂不支持图片识别',
  },
  {
    key: 'zhipu',
    label: '智谱 GLM',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    defaultModel: 'glm-4.5',
    defaultVisionModel: 'glm-4.5v',
    supportsVision: true,
    hint: '文本 + 视觉模型都有,国内直连',
  },
  {
    key: 'openai',
    label: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o-mini',
    defaultVisionModel: 'gpt-4o-mini',
    supportsVision: true,
    hint: '文本/视觉可共用同一个模型',
  },
  {
    key: 'gemini',
    label: 'Google Gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    defaultModel: 'gemini-2.5-flash',
    defaultVisionModel: 'gemini-2.5-flash',
    supportsVision: true,
    hint: '走 Google 官方的 OpenAI 兼容入口',
  },
  {
    key: 'custom',
    label: '自定义(OpenAI 兼容)',
    baseUrl: '',
    defaultModel: '',
    defaultVisionModel: '',
    supportsVision: true,
    hint: '填 Base URL,适用于 OneAPI / NewAPI / vLLM 等服务',
  },
];
