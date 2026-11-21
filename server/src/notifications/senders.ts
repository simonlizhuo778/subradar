import { createHmac } from 'node:crypto';

/** 一条提醒消息的通用结构(各渠道自行渲染) */
export interface ReminderMessage {
  subscriptionName: string;
  amount: number;
  currency: string;
  /** YYYY-MM-DD */
  nextPaymentDate: string;
  daysLeft: number;
  autoRenew: boolean;
  categoryName: string | null;
  /** 点击直达网页处理 */
  link: string;
}

const CURRENCY_SYMBOL: Record<string, string> = {
  CNY: '¥',
  USD: '$',
  EUR: '€',
  HKD: 'HK$',
  JPY: '¥',
};

export function formatMoney(amount: number, currency: string): string {
  const symbol = CURRENCY_SYMBOL[currency] ?? `${currency} `;
  return `${symbol}${Number.isInteger(amount) ? amount.toFixed(0) : amount.toFixed(2)}`;
}

export function buildTitle(m: ReminderMessage): string {
  return `🔔 ${m.subscriptionName} 将于 ${m.nextPaymentDate} 扣款`;
}

function buildBodyLines(m: ReminderMessage): string[] {
  const lines = [
    `**${m.subscriptionName}** 将在 **${m.daysLeft} 天后**(${m.nextPaymentDate})扣款 **${formatMoney(m.amount, m.currency)}**`,
  ];
  if (m.autoRenew) {
    lines.push('⚠️ 该订阅已开启**自动续费**,不想续费请在扣款前取消。');
  } else {
    lines.push('该订阅未开启自动续费,到期不会自动扣款。');
  }
  if (m.categoryName) {
    lines.push(`分类:${m.categoryName}`);
  }
  return lines;
}

/** 纯文本(邮件正文 / webhook 兜底) */
export function buildPlainText(m: ReminderMessage): string {
  return buildBodyLines(m)
    .map((line) => line.replace(/\*\*/g, ''))
    .concat(`打开订阅雷达:${m.link}`)
    .join('\n');
}

/* ------------------------------ 飞书群机器人 ------------------------------ */

/**
 * 飞书自定义机器人卡片消息。
 * 若机器人开启了「签名校验」,需要在 body 里附带 timestamp + sign:
 *   stringToSign = `${timestamp}\n${secret}`
 *   sign = base64(HmacSHA256(key=stringToSign, data=""))
 */
export function buildFeishuCard(m: ReminderMessage) {
  const color = m.autoRenew ? 'red' : 'blue';
  return {
    msg_type: 'interactive',
    card: {
      config: { wide_screen_mode: true },
      header: {
        template: color,
        title: { tag: 'plain_text', content: buildTitle(m) },
      },
      elements: [
        {
          tag: 'div',
          text: { tag: 'lark_md', content: buildBodyLines(m).join('\n') },
        },
        { tag: 'hr' },
        {
          tag: 'action',
          actions: [
            {
              tag: 'button',
              text: { tag: 'plain_text', content: '去订阅雷达处理' },
              type: 'primary',
              url: m.link,
            },
          ],
        },
        {
          tag: 'note',
          elements: [{ tag: 'plain_text', content: '订阅雷达 SubRadar · 到期前 3 天自动提醒' }],
        },
      ],
    },
  };
}

export async function sendFeishu(
  targetUrl: string,
  secret: string | null,
  message: ReminderMessage,
): Promise<void> {
  const body: Record<string, unknown> = buildFeishuCard(message);
  if (secret) {
    const timestamp = String(Math.floor(Date.now() / 1000));
    const stringToSign = `${timestamp}\n${secret}`;
    body.timestamp = timestamp;
    body.sign = createHmac('sha256', stringToSign).update('').digest('base64');
  }

  const res = await postJson(targetUrl, body);
  // 飞书成功返回 {"code":0,"msg":"success"}
  const code = (res.data as { code?: number } | null)?.code;
  const msg = (res.data as { msg?: string } | null)?.msg;
  if (!res.ok || (code !== undefined && code !== 0)) {
    throw new Error(`飞书返回失败:${msg ?? `HTTP ${res.status}`}`);
  }
}

/* ------------------------------- 通用 webhook ------------------------------ */

export interface WebhookPayload {
  source: 'subradar';
  event: 'subscription.renewal_reminder';
  title: string;
  text: string;
  subscription: {
    name: string;
    amount: number;
    currency: string;
    nextPaymentDate: string;
    daysLeft: number;
    autoRenew: boolean;
    category: string | null;
  };
  url: string;
}

export function buildWebhookPayload(m: ReminderMessage): WebhookPayload {
  return {
    source: 'subradar',
    event: 'subscription.renewal_reminder',
    title: buildTitle(m),
    text: buildPlainText(m),
    subscription: {
      name: m.subscriptionName,
      amount: m.amount,
      currency: m.currency,
      nextPaymentDate: m.nextPaymentDate,
      daysLeft: m.daysLeft,
      autoRenew: m.autoRenew,
      category: m.categoryName,
    },
    url: m.link,
  };
}

/** 通用 webhook:POST JSON,2xx 视为成功(可对接企业微信/钉钉/Server酱/自建服务) */
export async function sendWebhook(targetUrl: string, message: ReminderMessage): Promise<void> {
  const res = await postJson(targetUrl, buildWebhookPayload(message));
  if (!res.ok) {
    const snippet = (res.text ?? '').slice(0, 120);
    throw new Error(`webhook 返回 ${res.status}${snippet ? `:${snippet}` : ''}`);
  }
}

/* --------------------------------- 邮件 --------------------------------- */

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
}

export async function sendEmail(
  smtp: SmtpConfig,
  to: string,
  message: ReminderMessage,
): Promise<void> {
  // 延迟加载,避免未使用邮件渠道时也引入依赖
  const nodemailer = await import('nodemailer');
  const transporter = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    auth: { user: smtp.user, pass: smtp.pass },
  });

  const lines = buildBodyLines(message).map((line) => line.replace(/\*\*/g, '').replace(/⚠️ /g, ''));
  await transporter.sendMail({
    from: smtp.from || smtp.user,
    to,
    subject: buildTitle(message),
    text: buildPlainText(message),
    html: `
      <div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;padding:24px">
        <h2 style="margin:0 0 16px;font-size:18px;color:#0f172a">${escapeHtml(buildTitle(message))}</h2>
        <div style="padding:16px;border-radius:12px;background:${message.autoRenew ? '#fef2f2' : '#f8fafc'};border:1px solid ${message.autoRenew ? '#fecaca' : '#e2e8f0'}">
          ${lines.map((line) => `<p style="margin:0 0 8px;font-size:14px;color:#334155;line-height:1.6">${escapeHtml(line)}</p>`).join('')}
        </div>
        <p style="margin:20px 0 0">
          <a href="${escapeHtml(message.link)}" style="display:inline-block;padding:10px 18px;border-radius:8px;background:#0f172a;color:#fff;text-decoration:none;font-size:14px">去订阅雷达处理</a>
        </p>
        <p style="margin:24px 0 0;font-size:12px;color:#94a3b8">订阅雷达 SubRadar · 到期前 3 天自动提醒</p>
      </div>`,
  });
}

/* -------------------------------- 公共工具 -------------------------------- */

interface PostResult {
  ok: boolean;
  status: number;
  text: string;
  data: unknown;
}

async function postJson(url: string, body: unknown): Promise<PostResult> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    });
  } catch (e) {
    const err = e as Error;
    if (err.name === 'TimeoutError' || err.name === 'AbortError') {
      throw new Error('推送请求超时(15 秒)');
    }
    throw new Error(`无法连接推送地址:${err.message}`);
  }
  const text = await res.text().catch(() => '');
  let data: unknown = null;
  try {
    data = JSON.parse(text);
  } catch {
    // 非 JSON 响应(部分 webhook 返回纯文本),忽略
  }
  return { ok: res.ok, status: res.status, text, data };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}