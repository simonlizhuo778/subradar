import { describe, expect, it } from 'vitest';
import { maskTarget } from './notifications.service';
import {
  buildFeishuCard,
  buildPlainText,
  buildTitle,
  buildWebhookPayload,
  formatMoney,
} from './senders';
import type { ReminderMessage } from './senders';

const message: ReminderMessage = {
  subscriptionName: '腾讯视频 VIP',
  amount: 30,
  currency: 'CNY',
  nextPaymentDate: '2026-11-23',
  daysLeft: 3,
  autoRenew: true,
  categoryName: '视频',
  link: 'http://localhost:5173/subscriptions',
};

describe('formatMoney', () => {
  it('整数不带小数,小数保留两位', () => {
    expect(formatMoney(30, 'CNY')).toBe('¥30');
    expect(formatMoney(29.9, 'CNY')).toBe('¥29.90');
    expect(formatMoney(20, 'USD')).toBe('$20');
  });

  it('未知币种回退为前缀代码', () => {
    expect(formatMoney(5, 'SGD')).toBe('SGD 5');
  });
});

describe('buildTitle', () => {
  it('包含名称与扣款日', () => {
    const title = buildTitle(message);
    expect(title).toContain('腾讯视频 VIP');
    expect(title).toContain('2026-11-23');
  });
});

describe('buildPlainText', () => {
  it('自动续费订阅带取消提示,且不残留 markdown 星号', () => {
    const text = buildPlainText(message);
    expect(text).toContain('自动续费');
    expect(text).toContain('取消');
    expect(text).not.toContain('**');
    expect(text).toContain(message.link);
  });

  it('非自动续费订阅给出不同说明', () => {
    const text = buildPlainText({ ...message, autoRenew: false });
    expect(text).toContain('未开启自动续费');
    expect(text).not.toContain('请在扣款前取消');
  });
});

describe('buildFeishuCard', () => {
  it('自动续费用红色卡片并带跳转按钮', () => {
    const card = buildFeishuCard(message) as {
      msg_type: string;
      card: { header: { template: string }; elements: Array<Record<string, unknown>> };
    };
    expect(card.msg_type).toBe('interactive');
    expect(card.card.header.template).toBe('red');
    const action = card.card.elements.find((el) => el.tag === 'action') as {
      actions: Array<{ url: string }>;
    };
    expect(action.actions[0].url).toBe(message.link);
  });

  it('非自动续费用蓝色卡片', () => {
    const card = buildFeishuCard({ ...message, autoRenew: false }) as {
      card: { header: { template: string } };
    };
    expect(card.card.header.template).toBe('blue');
  });
});

describe('buildWebhookPayload', () => {
  it('结构化字段齐全,便于第三方对接', () => {
    const payload = buildWebhookPayload(message);
    expect(payload).toMatchObject({
      source: 'subradar',
      event: 'subscription.renewal_reminder',
      url: message.link,
      subscription: {
        name: '腾讯视频 VIP',
        amount: 30,
        currency: 'CNY',
        nextPaymentDate: '2026-11-23',
        daysLeft: 3,
        autoRenew: true,
        category: '视频',
      },
    });
  });
});

describe('maskTarget(目标掩码)', () => {
  it('URL 只露主机与尾部', () => {
    const masked = maskTarget('feishu', 'https://open.feishu.cn/open-apis/bot/v2/hook/abc123xyz');
    expect(masked).toBe('https://open.feishu.cn/…3xyz');
    expect(masked).not.toContain('abc123');
  });

  it('邮箱完整保留(不是秘密)', () => {
    expect(maskTarget('email', 'me@qq.com')).toBe('me@qq.com');
  });

  it('非法 URL 走兜底截断', () => {
    expect(maskTarget('webhook', 'not-a-url-value')).toBe('not-a-ur…alue');
  });
});