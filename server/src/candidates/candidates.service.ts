import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { addCycle } from '../common/utils/cycle-date';
import type { Cycle } from '../common/utils/cycle-date';
import { CreateSubscriptionDto } from '../subscriptions/dto/create-subscription.dto';

@Injectable()
export class CandidatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly subs: SubscriptionsService,
  ) {}

  /** 待确认队列(默认只看 pending;extracted 反序列化后返回) */
  async list(userId: number, status = 'pending') {
    const rows = await this.prisma.subscriptionCandidate.findMany({
      where: { userId, status },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return rows.map((row) => ({ ...row, extracted: safeParseExtracted(row.extracted) }));
  }

  /**
   * 确认候选 → 创建订阅 + 回填历史扣款(首次扣款日到今天)。
   * 复用 SubscriptionsService.create 的校验与下次扣款日推算。
   */
  async confirm(userId: number, id: number, dto: CreateSubscriptionDto) {
    const candidate = await this.prisma.subscriptionCandidate.findFirst({
      where: { id, userId, status: 'pending' },
    });
    if (!candidate) {
      throw new NotFoundException('候选不存在或已处理');
    }

    const subscription = await this.subs.create(userId, dto);

    // 回填扣款历史,统计页立刻有数据可看
    const today = new Date();
    let cursor = new Date(dto.firstPaymentDate);
    let guard = 0;
    while (cursor < today && guard < 500) {
      await this.prisma.payment.create({
        data: {
          subscriptionId: subscription.id,
          amount: subscription.amount,
          currency: subscription.currency,
          paidAt: cursor,
          source: 'candidate',
        },
      });
      cursor = addCycle(cursor, subscription.cycle as Cycle, subscription.customDays);
      guard += 1;
    }

    await this.prisma.subscriptionCandidate.update({
      where: { id: candidate.id },
      data: { status: 'confirmed', subscriptionId: subscription.id, decidedAt: new Date() },
    });

    return subscription;
  }

  async dismiss(userId: number, id: number) {
    const candidate = await this.prisma.subscriptionCandidate.findFirst({
      where: { id, userId, status: 'pending' },
    });
    if (!candidate) {
      throw new NotFoundException('候选不存在或已处理');
    }
    await this.prisma.subscriptionCandidate.update({
      where: { id: candidate.id },
      data: { status: 'dismissed', decidedAt: new Date() },
    });
    return { ok: true };
  }
}

function safeParseExtracted(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return { is_subscription: true, name: null, confidence: 0, evidence: null };
  }
}
