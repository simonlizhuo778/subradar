import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { decryptSecret, encryptSecret, maskSecret } from '../common/utils/secret-crypto';
import { addDays } from '../common/utils/cycle-date';
import { chatCompletion, PROVIDER_PRESETS } from './providers';
import type { ResolvedAiSettings } from './providers';
import { ListModelsDto } from './dto/list-models.dto';
import { SaveAiSettingsDto } from './dto/save-ai-settings.dto';

@Injectable()
export class AiSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  /** 掩码读:前端展示用,绝不返回明文 Key */
  async getMasked(userId: number) {
    const row = await this.prisma.aiSetting.findUnique({ where: { userId } });
    if (!row) {
      return { configured: false };
    }
    let keyHint = '****';
    try {
      keyHint = maskSecret(decryptSecret(row.apiKeyCipher));
    } catch {
      // MASTER_KEY 更换过等场景:提示用户重新保存
      keyHint = '****(无法解密,请重新保存 Key)';
    }
    return {
      configured: true,
      provider: row.provider,
      baseUrl: row.baseUrl,
      model: row.model,
      visionModel: row.visionModel,
      dailyLimit: row.dailyLimit,
      keyHint,
      updatedAt: row.updatedAt,
    };
  }

  /** 解析为可直接调用的配置(含明文 Key,仅服务端内部使用) */
  async resolve(userId: number): Promise<ResolvedAiSettings> {
    const row = await this.prisma.aiSetting.findUnique({ where: { userId } });
    if (!row) {
      throw new BadRequestException('请先在「设置 → AI 接入」中配置 API Key');
    }
    let apiKey: string;
    try {
      apiKey = decryptSecret(row.apiKeyCipher);
    } catch {
      throw new BadRequestException('API Key 无法解密(服务端 MASTER_KEY 可能已更换),请重新保存');
    }
    const preset = PROVIDER_PRESETS[row.provider];
    const provider = preset ? row.provider : 'custom';
    const baseUrl = (row.baseUrl || preset?.baseUrl || '').replace(/\/+$/, '');
    if (!baseUrl) {
      throw new BadRequestException('缺少模型服务地址(Base URL)');
    }
    return {
      provider,
      baseUrl,
      apiKey,
      model: row.model || preset?.defaultModel || '',
      visionModel: row.visionModel,
      dailyLimit: row.dailyLimit,
    };
  }

  async save(userId: number, dto: SaveAiSettingsDto) {
    if (dto.provider === 'custom' && !dto.baseUrl?.trim()) {
      throw new BadRequestException('自定义 Provider 必须填写 Base URL');
    }
    if (dto.model !== undefined && !dto.model.trim()) {
      throw new BadRequestException('模型名不能为空');
    }

    const existing = await this.prisma.aiSetting.findUnique({ where: { userId } });
    let apiKeyCipher: string;
    if (dto.apiKey?.trim()) {
      apiKeyCipher = encryptSecret(dto.apiKey.trim());
    } else if (existing) {
      apiKeyCipher = existing.apiKeyCipher; // 留空 = 沿用已保存的 Key
    } else {
      throw new BadRequestException('请填写 API Key');
    }

    const data = {
      provider: dto.provider,
      baseUrl: dto.baseUrl?.trim() || null,
      model: dto.model?.trim() || null,
      visionModel: dto.visionModel?.trim() || null,
      dailyLimit: dto.dailyLimit ?? 50,
      apiKeyCipher,
    };

    await this.prisma.aiSetting.upsert({
      where: { userId },
      create: { userId, ...data } as Prisma.AiSettingUncheckedCreateInput,
      update: data,
    });
    return this.getMasked(userId);
  }

  /** 连通性测试:发一条极小的请求,返回可读结果(不上抛异常) */
  async test(userId: number) {
    let settings: ResolvedAiSettings;
    try {
      settings = await this.resolve(userId);
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : '配置无效' };
    }
    const started = Date.now();
    try {
      const result = await chatCompletion(
        settings,
        [{ role: 'user', content: '连通性测试,请只回复两个字:正常' }],
        { maxTokens: 16 },
      );
      return {
        ok: true,
        latencyMs: Date.now() - started,
        model: settings.model,
        reply: result.content.slice(0, 30),
      };
    } catch (e) {
      return {
        ok: false,
        latencyMs: Date.now() - started,
        error: e instanceof Error ? e.message : '调用失败',
      };
    }
  }

  /**
   * 拉取该 Base URL 下的可用模型列表(GET {baseUrl}/models,OpenAI 兼容协议)。
   * 支持两种用法:
   *  1) 传 baseUrl/apiKey:还没保存就先试(新手填配置时最常用);
   *  2) 都不传:用已保存的配置。
   * 返回纯模型 id 数组,前端做勾选后回填到文本/视觉模型字段。
   */
  async listModels(userId: number, dto: ListModelsDto = {}) {
    const row = await this.prisma.aiSetting.findUnique({ where: { userId } });

    let baseUrl = dto.baseUrl?.trim().replace(/\/+$/, '') ?? '';
    if (!baseUrl) {
      baseUrl = (row?.baseUrl || PROVIDER_PRESETS[row?.provider ?? '']?.baseUrl || '').replace(
        /\/+$/,
        '',
      );
    }
    if (!baseUrl) {
      throw new BadRequestException('请先填写 Base URL(例如 https://api.deepseek.com)');
    }

    let apiKey = dto.apiKey?.trim() ?? '';
    if (!apiKey && row) {
      try {
        apiKey = decryptSecret(row.apiKeyCipher);
      } catch {
        // 解密失败:提示重新填 Key
      }
    }
    if (!apiKey) {
      throw new BadRequestException('请先填写 API Key(或先保存一次配置)');
    }

    const url = `${baseUrl}/models`;
    let res: Response;
    try {
      res = await fetch(url, {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(20_000),
      });
    } catch (e) {
      const err = e as Error;
      if (err.name === 'TimeoutError' || err.name === 'AbortError') {
        throw new BadRequestException('请求超时(20 秒),请检查 Base URL 或网络');
      }
      throw new BadRequestException(`无法连接 ${baseUrl},请检查地址是否正确`);
    }

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      const snippet = text.slice(0, 160);
      if (res.status === 401) {
        throw new BadRequestException('API Key 无效或未授权(401)');
      }
      if (res.status === 404) {
        throw new BadRequestException(
          `该服务没有 /models 接口(404)。可能它不提供模型列表,请手动填写模型名。地址:${url}`,
        );
      }
      throw new BadRequestException(`获取模型列表失败(${res.status}):${snippet}`);
    }

    const payload = (await res.json().catch(() => null)) as unknown;
    const models = extractModelIds(payload);
    if (models.length === 0) {
      throw new BadRequestException(
        '接口返回了响应,但没有解析到模型列表。该服务可能不支持 /models,请手动填写模型名',
      );
    }

    return {
      baseUrl,
      count: models.length,
      models,
      hint:
        models.some((m) => VISION_HINT.test(m))
          ? '带 vl / vision / 4o 字样的通常是多模态模型,可用于截图识别'
          : '未发现明显的视觉模型;截图识别可能不可用,可先用手动填写',
    };
  }

  /** 近 7 天用量看板(成本透明,也是可观测性的一部分) */
  async usage(userId: number) {
    const since = addDays(new Date(), -7);
    const logs = await this.prisma.usageLog.findMany({
      where: { userId, createdAt: { gte: since } },
      orderBy: { createdAt: 'asc' },
    });

    const byDay = new Map<string, { calls: number; ok: number; tokens: number }>();
    let ok = 0;
    let promptTokens = 0;
    let completionTokens = 0;
    for (const log of logs) {
      const day = log.createdAt.toISOString().slice(0, 10);
      const row = byDay.get(day) ?? { calls: 0, ok: 0, tokens: 0 };
      row.calls += 1;
      if (log.ok) {
        row.ok += 1;
        ok += 1;
      }
      row.tokens += log.promptTokens + log.completionTokens;
      promptTokens += log.promptTokens;
      completionTokens += log.completionTokens;
      byDay.set(day, row);
    }

    return {
      total: logs.length,
      ok,
      failed: logs.length - ok,
      promptTokens,
      completionTokens,
      byDay: Array.from(byDay.entries()).map(([date, v]) => ({ date, ...v })),
    };
  }

  /** 每日调用配额检查(AiExtractService 调用) */
  async assertDailyQuota(userId: number) {
    const row = await this.prisma.aiSetting.findUnique({ where: { userId } });
    const limit = row?.dailyLimit ?? 50;
    if (limit <= 0) {
      // 0 = 关闭 AI 功能
      throw new BadRequestException('每日 AI 调用上限为 0,如需使用请在设置中调大');
    }
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const used = await this.prisma.usageLog.count({
      where: { userId, createdAt: { gte: startOfDay } },
    });
    if (used >= limit) {
      throw new BadRequestException(`今日 AI 调用已达上限(${used}/${limit} 次)`);
    }
  }

  async logUsage(
    userId: number,
    feature: string,
    settings: ResolvedAiSettings,
    usage: { promptTokens: number; completionTokens: number } | null,
    latencyMs: number,
    ok: boolean,
  ) {
    await this.prisma.usageLog.create({
      data: {
        userId,
        feature,
        provider: settings.provider,
        model: settings.model,
        promptTokens: usage?.promptTokens ?? 0,
        completionTokens: usage?.completionTokens ?? 0,
        latencyMs,
        ok,
      },
    });
  }

  async assertConfigured(userId: number) {
    const row = await this.prisma.aiSetting.findUnique({ where: { userId } });
    if (!row) {
      throw new NotFoundException('尚未配置 AI,请先到「设置 → AI 接入」填写 API Key');
    }
  }
}

/** 视觉/多模态模型的常见命名特征(仅用于给出提示,不做强制过滤) */
const VISION_HINT = /(vl|vision|4o|multimodal|omni)/i;

/**
 * 从各家的 /models 响应里提取模型 id:
 *  - OpenAI / DashScope / DeepSeek: { object:"list", data:[{id:"..."}] }
 *  - 部分中转站: { data: ["id1","id2"] } 或 { models: [...] } 或裸数组
 */
export function extractModelIds(payload: unknown): string[] {
  const candidates: unknown[] = [];

  if (Array.isArray(payload)) {
    candidates.push(...payload);
  } else if (payload && typeof payload === 'object') {
    const obj = payload as Record<string, unknown>;
    for (const key of ['data', 'models', 'list']) {
      const value = obj[key];
      if (Array.isArray(value)) {
        candidates.push(...value);
      }
    }
  }

  const ids = new Set<string>();
  for (const item of candidates) {
    if (typeof item === 'string') {
      if (item.trim()) ids.add(item.trim());
    } else if (item && typeof item === 'object') {
      const id = (item as Record<string, unknown>).id ?? (item as Record<string, unknown>).name;
      if (typeof id === 'string' && id.trim()) {
        ids.add(id.trim());
      }
    }
  }
  return Array.from(ids).sort();
}
