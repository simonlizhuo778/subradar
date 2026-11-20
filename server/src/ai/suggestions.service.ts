import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AiSettingsService } from './ai-settings.service';
import { chatCompletion } from './providers';
import type { ChatMessage } from './providers';
import { SUGGESTIONS_SYSTEM_PROMPT } from './suggestions-prompt';
import { yearlyCost, round2 } from '../common/utils/cost';
import type { Cycle } from '../common/utils/cycle-date';

export interface AiSuggestion {
  title: string;
  detail: string;
  priority: 'high' | 'medium' | 'low';
  related: string[];
  potentialYearlySaving: number | null;
}

const PRIORITY_SET = new Set(['high', 'medium', 'low']);

/** 模型输出解析:容忍围栏/前后缀/单对象,字段防御性规范化(纯函数,独立可测) */
export function parseSuggestions(raw: string): AiSuggestion[] {
  let text = raw.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(text);
  if (fence) {
    text = fence[1].trim();
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new BadRequestException('模型返回的不是合法 JSON,请重试');
  }

  const list = Array.isArray(parsed) ? parsed : [parsed];
  return list
    .map(normalizeSuggestion)
    .filter((s): s is AiSuggestion => s !== null)
    .slice(0, 8);
}

function normalizeSuggestion(item: unknown): AiSuggestion | null {
  if (!item || typeof item !== 'object') return null;
  const o = item as Record<string, unknown>;
  const title = typeof o.title === 'string' ? o.title.trim().slice(0, 40) : '';
  const detail = typeof o.detail === 'string' ? o.detail.trim().slice(0, 300) : '';
  if (!title || !detail) return null;

  const priorityRaw = typeof o.priority === 'string' ? o.priority.toLowerCase() : '';
  const priority = PRIORITY_SET.has(priorityRaw) ? (priorityRaw as AiSuggestion['priority']) : 'medium';

  const related = Array.isArray(o.related)
    ? o.related.filter((r): r is string => typeof r === 'string').slice(0, 5)
    : [];

  const savingRaw = o.potential_yearly_saving;
  const potentialYearlySaving =
    typeof savingRaw === 'number' && Number.isFinite(savingRaw) && savingRaw > 0
      ? round2(savingRaw)
      : null;

  return { title, detail, priority, related, potentialYearlySaving };
}

@Injectable()
export class SuggestionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: AiSettingsService,
  ) {}

  /** 基于当前生效订阅生成省钱建议(消耗模型额度,计入每日限额) */
  async generate(userId: number) {
    const resolved = await this.settings.resolve(userId);
    await this.settings.assertDailyQuota(userId);

    const subs = await this.prisma.subscription.findMany({
      where: { userId, status: { in: ['active', 'trial'] } },
      include: { category: true },
    });
    if (subs.length === 0) {
      throw new BadRequestException('还没有生效的订阅,先添加几个再来问省钱建议');
    }

    const payload = subs.map((sub) => ({
      name: sub.name,
      amount: sub.amount,
      currency: sub.currency,
      cycle: sub.cycle,
      yearly_cost: round2(yearlyCost(sub.amount, sub.cycle as Cycle, sub.customDays)),
      category: sub.category?.name ?? null,
      auto_renew: sub.autoRenew,
      next_payment_date: sub.nextPaymentDate.toISOString().slice(0, 10),
    }));

    const messages: ChatMessage[] = [
      { role: 'system', content: SUGGESTIONS_SYSTEM_PROMPT },
      { role: 'user', content: JSON.stringify(payload) },
    ];

    const started = Date.now();
    let result: Awaited<ReturnType<typeof chatCompletion>>;
    try {
      result = await chatCompletion(resolved, messages, { json: true, maxTokens: 1600 });
    } catch (e) {
      await this.settings.logUsage(userId, 'suggestions', resolved, null, Date.now() - started, false);
      throw new BadRequestException(e instanceof Error ? e.message : 'AI 调用失败');
    }
    await this.settings.logUsage(userId, 'suggestions', resolved, result.usage, Date.now() - started, true);

    return {
      basedOn: subs.length,
      suggestions: parseSuggestions(result.content),
    };
  }
}
