import type { Cycle, SubscriptionStatus } from './types';

const CURRENCY_SYMBOLS: Record<string, string> = {
  CNY: '¥',
  USD: '$',
  EUR: '€',
  HKD: 'HK$',
  JPY: '¥',
};

export function money(amount: number, currency: string): string {
  const symbol = CURRENCY_SYMBOLS[currency] ?? `${currency} `;
  return `${symbol}${Number.isInteger(amount) ? amount.toFixed(0) : amount.toFixed(2)}`;
}

export function cycleLabel(cycle: Cycle, customDays: number | null): string {
  switch (cycle) {
    case 'monthly':
      return '每月';
    case 'quarterly':
      return '每季';
    case 'yearly':
      return '每年';
    case 'weekly':
      return '每周';
    case 'custom':
      return `每 ${customDays ?? '?'} 天`;
  }
}

export const STATUS_LABELS: Record<SubscriptionStatus, string> = {
  active: '生效',
  trial: '试用',
  paused: '暂停',
  cancelled: '已取消',
};

export function statusClass(status: SubscriptionStatus): string {
  switch (status) {
    case 'active':
      return 'bg-emerald-50 text-emerald-700';
    case 'trial':
      return 'bg-sky-50 text-sky-700';
    case 'paused':
      return 'bg-amber-50 text-amber-700';
    case 'cancelled':
      return 'bg-slate-100 text-slate-500';
  }
}

export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function daysUntil(date: Date | string): number {
  const d = typeof date === 'string' ? new Date(date) : date;
  return Math.ceil((d.getTime() - Date.now()) / 86_400_000);
}

export function relativeDue(date: Date | string): string {
  const n = daysUntil(date);
  if (n < 0) return `逾期 ${-n} 天`;
  if (n === 0) return '今天';
  if (n === 1) return '明天';
  return `${n} 天后`;
}

export function yearlyByCurrencyText(map: Record<string, number>): string {
  const parts = Object.entries(map).map(([currency, value]) => money(value, currency));
  return parts.length > 0 ? parts.join(' · ') : '—';
}

/** date-only 字符串(YYYY-MM-DD)安全解析为本地时区 Date */
export function parseDateOnly(value: string): Date {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}
