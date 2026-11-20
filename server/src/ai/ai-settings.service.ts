import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { decryptSecret, encryptSecret, maskSecret } from '../common/utils/secret-crypto';
import { addDays } from '../common/utils/cycle-date';
import { chatCompletion, PROVIDER_PRESETS } from './providers';
import type { ResolvedAiSettings } from './providers';
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
