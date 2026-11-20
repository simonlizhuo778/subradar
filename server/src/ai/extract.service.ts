import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AiSettingsService } from './ai-settings.service';
import { buildImageUserPrompt, buildTextUserPrompt, EXTRACT_SYSTEM_PROMPT } from './extract-prompt';
import { chatCompletion } from './providers';
import type { ChatMessage, ResolvedAiSettings } from './providers';

/** 抽取结果的规范化结构(存入 candidates.extracted) */
export interface ExtractedCandidate {
  is_subscription: boolean;
  name: string | null;
  merchant: string | null;
  amount: number | null;
  currency: string;
  cycle: string | null;
  cycle_days: number | null;
  first_payment_date: string | null;
  next_payment_date: string | null;
  payment_method: string | null;
  auto_renew: boolean | null;
  confidence: number;
  evidence: string | null;
}

const CYCLE_SET = new Set(['monthly', 'quarterly', 'yearly', 'weekly', 'custom']);
const METHOD_SET = new Set(['alipay', 'wechat', 'apple', 'card', 'other']);
const CURRENCY_SET = new Set(['CNY', 'USD', 'EUR', 'HKD', 'JPY']);

/**
 * 解析并规范化模型输出:
 * - 容忍 ```json 围栏 / 前后缀废话
 * - 支持单对象或数组(多条订阅)
 * - 字段类型防御:非法枚举 → null,金额转数字
 * 纯函数,独立可测。
 */
export function parseExtraction(raw: string): ExtractedCandidate[] {
  let text = raw.trim();
  // 剥掉 ```json 围栏(允许围栏前后有模型的闲聊文字)
  const fence = /```(?:json)?\s*([\s\S]*?)\s*```/i.exec(text);
  if (fence) {
    text = fence[1].trim();
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new BadRequestException('模型返回的不是合法 JSON,请重试或更换模型');
  }

  const list = Array.isArray(parsed) ? parsed : [parsed];
  const normalized = list.map((item) => normalizeExtracted(item));
  const subscriptions = normalized.filter((c) => c.is_subscription);
  if (subscriptions.length === 0) {
    throw new BadRequestException('识别完成,但内容看起来不是订阅/周期扣款信息');
  }
  return subscriptions;
}

function normalizeExtracted(item: unknown): ExtractedCandidate {
  const o = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;

  const cycle = typeof o.cycle === 'string' && CYCLE_SET.has(o.cycle) ? o.cycle : null;
  const method =
    typeof o.payment_method === 'string' && METHOD_SET.has(o.payment_method) ? o.payment_method : null;
  const currency =
    typeof o.currency === 'string' && CURRENCY_SET.has(o.currency.toUpperCase())
      ? o.currency.toUpperCase()
      : 'CNY';

  const amount = toNumberOrNull(o.amount);
  const cycleDays = toNumberOrNull(o.cycle_days);
  const confidenceRaw = toNumberOrNull(o.confidence);
  const confidence =
    confidenceRaw === null ? 0.5 : Math.min(1, Math.max(0, confidenceRaw));

  return {
    is_subscription: o.is_subscription === undefined ? true : Boolean(o.is_subscription),
    name: typeof o.name === 'string' && o.name.trim() ? o.name.trim().slice(0, 60) : null,
    merchant: typeof o.merchant === 'string' ? o.merchant.trim().slice(0, 60) : null,
    amount: amount === null ? null : Math.round(amount * 100) / 100,
    currency,
    cycle,
    cycle_days: cycle === 'custom' && cycleDays !== null ? Math.round(cycleDays) : cycleDays,
    first_payment_date: normalizeDate(o.first_payment_date),
    next_payment_date: normalizeDate(o.next_payment_date),
    payment_method: method,
    auto_renew: typeof o.auto_renew === 'boolean' ? o.auto_renew : null,
    confidence,
    evidence: typeof o.evidence === 'string' ? o.evidence.trim().slice(0, 200) : null,
  };
}

function toNumberOrNull(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return null;
}

function normalizeDate(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(value.trim());
  if (!m) return null;
  const pad = (n: string) => n.padStart(2, '0');
  return `${m[1]}-${pad(m[2])}-${pad(m[3])}`;
}

@Injectable()
export class AiExtractService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: AiSettingsService,
  ) {}

  async extractFromImage(
    userId: number,
    file: { buffer: Buffer; mimetype: string; size: number; originalname: string },
  ) {
    const resolved = await this.settings.resolve(userId);
    if (!resolved.visionModel) {
      throw new BadRequestException(
        '尚未配置视觉模型(vision_model),无法识别图片;请到「设置 → AI 接入」填写',
      );
    }
    return this.runExtraction(userId, 'image', resolved, [
      {
        role: 'user',
        content: [
          { type: 'text', text: buildImageUserPrompt() },
          {
            type: 'image_url',
            image_url: { url: `data:${file.mimetype};base64,${file.buffer.toString('base64')}` },
          },
        ],
      },
    ]);
  }

  async extractFromText(userId: number, text: string) {
    const resolved = await this.settings.resolve(userId);
    return this.runExtraction(userId, 'text', resolved, [
      { role: 'user', content: buildTextUserPrompt(text) },
    ]);
  }

  private async runExtraction(
    userId: number,
    feature: 'image' | 'text',
    resolved: ResolvedAiSettings,
    messages: ChatMessage[],
  ) {
    await this.settings.assertDailyQuota(userId);

    const started = Date.now();
    let result: Awaited<ReturnType<typeof chatCompletion>>;
    try {
      result = await chatCompletion(
        resolved,
        [{ role: 'system', content: EXTRACT_SYSTEM_PROMPT }, ...messages],
        { json: true, vision: feature === 'image', maxTokens: 1024 },
      );
    } catch (e) {
      await this.settings.logUsage(userId, feature, resolved, null, Date.now() - started, false);
      throw new BadRequestException(e instanceof Error ? e.message : 'AI 调用失败');
    }

    await this.settings.logUsage(userId, feature, resolved, result.usage, Date.now() - started, true);

    // 解析错误属于"调用成功但输出不合规",不重复记失败
    const candidates = parseExtraction(result.content);
    const created = await this.createCandidates(userId, feature, candidates);

    return {
      created,
      message: `识别成功:生成 ${created.length} 条待确认候选`,
    };
  }

  private async createCandidates(
    userId: number,
    source: 'image' | 'text',
    list: ExtractedCandidate[],
  ) {
    const rows = [];
    for (const extracted of list) {
      const row = await this.prisma.subscriptionCandidate.create({
        data: {
          userId,
          source,
          rawRef: source === 'image' ? '截图识别' : '文本识别',
          extracted: JSON.stringify(extracted),
          confidence: extracted.confidence,
          status: 'pending',
        },
      });
      rows.push({ ...row, extracted });
    }
    return rows;
  }
}
