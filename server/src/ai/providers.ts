/**
 * AI Provider 适配层:全部走 OpenAI 兼容协议(POST {baseUrl}/chat/completions)。
 * DeepSeek / 智谱 / OpenAI 原生兼容;Gemini 走其官方 OpenAI 兼容入口;
 * 任何自托管或第三方兼容服务(OneAPI / NewAPI / vLLM…)用 custom。
 */

export interface ResolvedAiSettings {
  provider: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  visionModel: string | null;
  dailyLimit: number;
}

export interface ProviderPreset {
  label: string;
  baseUrl: string;
  defaultModel: string;
  defaultVisionModel: string | null;
  supportsVision: boolean;
  hint: string;
}

/** 预设仅为默认值,模型名以各厂商当前文档为准,均可在设置页修改 */
export const PROVIDER_PRESETS: Record<string, ProviderPreset> = {
  deepseek: {
    label: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com',
    defaultModel: 'deepseek-chat',
    defaultVisionModel: null,
    supportsVision: false,
    hint: '文本抽取便宜好用;官方 API 暂不支持图片识别',
  },
  zhipu: {
    label: '智谱 GLM',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    defaultModel: 'glm-4.5',
    defaultVisionModel: 'glm-4.5v',
    supportsVision: true,
    hint: '文本 + 视觉模型都有,国内直连',
  },
  openai: {
    label: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o-mini',
    defaultVisionModel: 'gpt-4o-mini',
    supportsVision: true,
    hint: '文本/视觉同一个模型即可',
  },
  gemini: {
    label: 'Google Gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    defaultModel: 'gemini-2.5-flash',
    defaultVisionModel: 'gemini-2.5-flash',
    supportsVision: true,
    hint: '走 Google 官方的 OpenAI 兼容入口',
  },
  custom: {
    label: '自定义(OpenAI 兼容)',
    baseUrl: '',
    defaultModel: '',
    defaultVisionModel: '',
    supportsVision: true,
    hint: '填 Base URL,适用于 OneAPI / NewAPI / vLLM 等中转或自托管服务',
  },
};

export type ChatContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | ChatContentPart[];
}

export interface ChatCompletionResult {
  content: string;
  usage: { promptTokens: number; completionTokens: number } | null;
}

export class AiProviderError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = 'AiProviderError';
  }
}

interface ChatOptions {
  /** 强制 JSON 输出(response_format) */
  json?: boolean;
  /** 用视觉模型(用于图片输入) */
  vision?: boolean;
  maxTokens?: number;
}

export async function chatCompletion(
  settings: ResolvedAiSettings,
  messages: ChatMessage[],
  options: ChatOptions = {},
): Promise<ChatCompletionResult> {
  const model = options.vision ? settings.visionModel ?? settings.model : settings.model;
  const body: Record<string, unknown> = {
    model,
    messages,
    temperature: 0.1,
    max_tokens: options.maxTokens ?? 1024,
  };
  if (options.json) {
    body.response_format = { type: 'json_object' };
  }

  let res: Response;
  try {
    res = await fetch(`${settings.baseUrl.replace(/\/+$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${settings.apiKey}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60_000),
    });
  } catch (e) {
    const err = e as Error;
    if (err.name === 'TimeoutError' || err.name === 'AbortError' || /aborted/i.test(err.message)) {
      throw new AiProviderError('模型请求超时(60 秒),请稍后重试');
    }
    throw new AiProviderError(`无法连接模型服务(${err.message}),请检查网络或 Base URL`);
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    const snippet = text.slice(0, 200);
    if (res.status === 401) {
      throw new AiProviderError('API Key 无效或未授权(401)', 401);
    }
    if (res.status === 429) {
      throw new AiProviderError('额度不足或被限流(429)', 429);
    }
    if (res.status === 404) {
      throw new AiProviderError('接口路径或模型名不正确(404)', 404);
    }
    throw new AiProviderError(`模型服务返回 ${res.status}:${snippet}`, res.status);
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  const content = data.choices?.[0]?.message?.content;
  if (typeof content !== 'string') {
    throw new AiProviderError('模型返回内容为空或格式异常');
  }
  return {
    content,
    usage: data.usage
      ? {
          promptTokens: data.usage.prompt_tokens ?? 0,
          completionTokens: data.usage.completion_tokens ?? 0,
        }
      : null,
  };
}
