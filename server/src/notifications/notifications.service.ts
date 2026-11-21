import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { decryptSecret, encryptSecret } from '../common/utils/secret-crypto';
import { addDays } from '../common/utils/cycle-date';
import { CreateChannelDto, EMAIL_PATTERN, URL_PATTERN } from './dto/channel.dto';
import { sendEmail, sendFeishu, sendWebhook } from './senders';
import type { ReminderMessage, SmtpConfig } from './senders';

/** 待推送的一条到期提醒 */
export interface DispatchItem {
  reminderId: number;
  subscriptionName: string;
  amount: number;
  currency: string;
  nextPaymentDate: Date;
  autoRenew: boolean;
  categoryName: string | null;
}

export interface DispatchResult {
  sent: number;
  failed: number;
  details: Array<{ channel: string; ok: boolean; error?: string }>;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private appUrl(): string {
    return (this.config.get<string>('APP_URL') ?? 'http://localhost:5173').replace(/\/+$/, '');
  }

  /* ------------------------------ 渠道管理 ------------------------------ */

  async list(userId: number) {
    const rows = await this.prisma.notificationChannel.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((row) => ({
      id: row.id,
      type: row.type,
      label: row.label,
      targetHint: row.targetHint,
      enabled: row.enabled,
      lastStatus: row.lastStatus,
      lastError: row.lastError,
      lastSentAt: row.lastSentAt,
      createdAt: row.createdAt,
      hasSmtp: Boolean(row.smtpHost),
      smtpHost: row.smtpHost,
      smtpUser: row.smtpUser,
    }));
  }

  async create(userId: number, dto: CreateChannelDto) {
    const isUrlType = dto.type === 'feishu' || dto.type === 'webhook';

    if (isUrlType) {
      if (!URL_PATTERN.test(dto.target.trim())) {
        throw new BadRequestException('推送地址应以 http:// 或 https:// 开头');
      }
      if (dto.type === 'feishu' && !/\/hook\//.test(dto.target)) {
        throw new BadRequestException(
          '这不像飞书机器人地址(应包含 /hook/)。请在飞书群 → 设置 → 群机器人 → 添加自定义机器人后复制 Webhook 地址',
        );
      }
    } else {
      if (!EMAIL_PATTERN.test(dto.target.trim())) {
        throw new BadRequestException('请填写正确的收件邮箱地址');
      }
      if (!dto.smtp) {
        throw new BadRequestException('邮件渠道需要填写 SMTP 服务器配置');
      }
    }

    const count = await this.prisma.notificationChannel.count({ where: { userId } });
    if (count >= 10) {
      throw new BadRequestException('最多添加 10 个推送渠道');
    }

    const target = dto.target.trim();
    const row = await this.prisma.notificationChannel.create({
      data: {
        userId,
        type: dto.type,
        label: dto.label.trim(),
        targetCipher: encryptSecret(target),
        targetHint: maskTarget(dto.type, target),
        secretCipher: dto.secret?.trim() ? encryptSecret(dto.secret.trim()) : null,
        smtpHost: dto.smtp?.host.trim() ?? null,
        smtpPort: dto.smtp?.port ?? null,
        smtpSecure: dto.smtp?.secure ?? true,
        smtpUser: dto.smtp?.user.trim() ?? null,
        smtpPassCipher: dto.smtp?.pass ? encryptSecret(dto.smtp.pass) : null,
        smtpFrom: dto.smtp?.from?.trim() || dto.smtp?.user.trim() || null,
      },
    });
    return { id: row.id, ok: true };
  }

  async setEnabled(userId: number, id: number, enabled: boolean) {
    await this.mustGet(userId, id);
    await this.prisma.notificationChannel.update({ where: { id }, data: { enabled } });
    return { ok: true };
  }

  async remove(userId: number, id: number) {
    await this.mustGet(userId, id);
    await this.prisma.notificationChannel.delete({ where: { id } });
    return { ok: true };
  }

  /** 发送一条测试消息,立即反馈是否可达 */
  async test(userId: number, id: number) {
    const channel = await this.mustGet(userId, id);
    const subscriptionCount = await this.prisma.subscription.count({
      where: { userId, status: { in: ['active', 'trial'] } },
    });
    const message: ReminderMessage = {
      subscriptionName: '这是一条测试提醒',
      amount: 30,
      currency: 'CNY',
      nextPaymentDate: addDays(new Date(), 3).toISOString().slice(0, 10),
      daysLeft: 3,
      autoRenew: true,
      categoryName: null,
      link: `${this.appUrl()}/subscriptions`,
    };
    try {
      await this.send(channel, message);
      await this.prisma.notificationChannel.update({
        where: { id },
        data: { lastStatus: 'ok', lastError: null, lastSentAt: new Date() },
      });
      await this.writeLog(userId, id, null, '测试消息', true, null);
      return { ok: true, message: '测试消息已发送,请到对应渠道查看', subscriptionCount };
    } catch (e) {
      const error = e instanceof Error ? e.message : '发送失败';
      await this.prisma.notificationChannel.update({
        where: { id },
        data: { lastStatus: 'failed', lastError: error.slice(0, 500) },
      });
      await this.writeLog(userId, id, null, '测试消息', false, error.slice(0, 500));
      return { ok: false, error };
    }
  }

  /* ------------------------------ 提醒分发 ------------------------------ */

  /**
   * 把一批到期提醒推送到用户所有启用的渠道。
   * 全程容错:单个渠道失败不影响其他渠道。
   */
  async dispatch(userId: number, items: DispatchItem[]): Promise<DispatchResult> {
    const result: DispatchResult = { sent: 0, failed: 0, details: [] };
    if (items.length === 0) return result;

    const channels = await this.prisma.notificationChannel.findMany({
      where: { userId, enabled: true },
    });
    if (channels.length === 0) return result;

    for (const item of items) {
      const message: ReminderMessage = {
        subscriptionName: item.subscriptionName,
        amount: item.amount,
        currency: item.currency,
        nextPaymentDate: item.nextPaymentDate.toISOString().slice(0, 10),
        daysLeft: 3,
        autoRenew: item.autoRenew,
        categoryName: item.categoryName,
        link: `${this.appUrl()}/subscriptions`,
      };

      for (const channel of channels) {
        const title = `${item.subscriptionName} 到期提醒`;
        try {
          await this.send(channel, message);
          result.sent += 1;
          result.details.push({ channel: channel.label, ok: true });
          await this.prisma.notificationChannel.update({
            where: { id: channel.id },
            data: { lastStatus: 'ok', lastError: null, lastSentAt: new Date() },
          });
          await this.writeLog(userId, channel.id, item.reminderId, title, true, null);
        } catch (e) {
          const error = e instanceof Error ? e.message : '发送失败';
          this.logger.warn(`推送失败(${channel.label}): ${error}`);
          result.failed += 1;
          result.details.push({ channel: channel.label, ok: false, error });
          await this.prisma.notificationChannel.update({
            where: { id: channel.id },
            data: { lastStatus: 'failed', lastError: error.slice(0, 500) },
          });
          await this.writeLog(userId, channel.id, item.reminderId, title, false, error.slice(0, 500));
        }
      }
    }
    return result;
  }

  /** 推送记录(最近 50 条) */
  async logs(userId: number) {
    const rows = await this.prisma.notificationLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      ok: row.ok,
      error: row.error,
      channelId: row.channelId,
      createdAt: row.createdAt,
    }));
  }

  /* -------------------------------- 内部 -------------------------------- */

  private async send(
    channel: {
      type: string;
      targetCipher: string;
      secretCipher: string | null;
      smtpHost: string | null;
      smtpPort: number | null;
      smtpSecure: boolean | null;
      smtpUser: string | null;
      smtpPassCipher: string | null;
      smtpFrom: string | null;
    },
    message: ReminderMessage,
  ): Promise<void> {
    const target = decryptSecret(channel.targetCipher);
    if (channel.type === 'feishu') {
      const secret = channel.secretCipher ? decryptSecret(channel.secretCipher) : null;
      await sendFeishu(target, secret, message);
      return;
    }
    if (channel.type === 'webhook') {
      await sendWebhook(target, message);
      return;
    }
    if (channel.type === 'email') {
      if (!channel.smtpHost || !channel.smtpPort || !channel.smtpUser || !channel.smtpPassCipher) {
        throw new Error('SMTP 配置不完整,请重新添加邮件渠道');
      }
      const smtp: SmtpConfig = {
        host: channel.smtpHost,
        port: channel.smtpPort,
        secure: channel.smtpSecure ?? true,
        user: channel.smtpUser,
        pass: decryptSecret(channel.smtpPassCipher),
        from: channel.smtpFrom ?? channel.smtpUser,
      };
      await sendEmail(smtp, target, message);
      return;
    }
    throw new Error(`未知渠道类型:${channel.type}`);
  }

  private async mustGet(userId: number, id: number) {
    const channel = await this.prisma.notificationChannel.findFirst({ where: { id, userId } });
    if (!channel) {
      throw new NotFoundException('推送渠道不存在');
    }
    return channel;
  }

  private async writeLog(
    userId: number,
    channelId: number | null,
    reminderId: number | null,
    title: string,
    ok: boolean,
    error: string | null,
  ) {
    await this.prisma.notificationLog
      .create({ data: { userId, channelId, reminderId, title, ok, error } })
      .catch(() => undefined);
  }
}

/** 目标掩码:URL 只露主机与尾部,邮箱保留完整(不是秘密) */
export function maskTarget(type: string, target: string): string {
  if (type === 'email') return target;
  try {
    const url = new URL(target);
    const tail = target.slice(-4);
    return `${url.protocol}//${url.host}/…${tail}`;
  } catch {
    return `${target.slice(0, 8)}…${target.slice(-4)}`;
  }
}