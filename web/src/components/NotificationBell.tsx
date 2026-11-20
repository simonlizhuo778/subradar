import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { formatDate, money, relativeDue } from '@/lib/format';
import type { ReminderItem } from '@/lib/types';

const SEEN_KEY = 'subradar_seen_reminders';

export function NotificationBell() {
  const [items, setItems] = useState<ReminderItem[] | null>(null);
  const [open, setOpen] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'denied',
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const data = await api<ReminderItem[]>('/reminders');
        if (cancelled) return;
        setItems(data);
        // 浏览器通知:只对「没见过」的提醒弹系统通知,已读记录存 localStorage
        if (
          typeof Notification !== 'undefined' &&
          Notification.permission === 'granted' &&
          data.length > 0
        ) {
          const seen = new Set(JSON.parse(localStorage.getItem(SEEN_KEY) ?? '[]') as number[]);
          for (const item of data) {
            if (!seen.has(item.id)) {
              new Notification('订阅雷达 · 到期提醒', {
                body: `${item.subscription.name} 将于 ${formatDate(item.subscription.nextPaymentDate)} 扣款 ${money(item.subscription.amount, item.subscription.currency)}`,
              });
              seen.add(item.id);
            }
          }
          localStorage.setItem(SEEN_KEY, JSON.stringify(Array.from(seen).slice(-200)));
        }
      } catch {
        // 未登录或接口异常时静默
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function requestPermission() {
    if (typeof Notification === 'undefined') return;
    const result = await Notification.requestPermission();
    setPermission(result);
  }

  const count = items?.length ?? 0;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative rounded-md px-2 py-1.5 text-lg leading-none transition hover:bg-slate-100"
        title="到期提醒"
      >
        🔔
        {count > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-medium text-white">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-10 z-40 w-80 rounded-xl border border-slate-200 bg-white p-3 shadow-xl">
          <div className="flex items-center justify-between px-1 pb-2">
            <span className="text-sm font-semibold text-slate-900">到期提醒</span>
            {permission === 'default' && (
              <button
                onClick={() => void requestPermission()}
                className="text-xs text-slate-500 underline hover:text-slate-800"
              >
                开启浏览器通知
              </button>
            )}
          </div>
          {items === null && <p className="px-1 py-2 text-sm text-slate-400">加载中…</p>}
          {items?.length === 0 && (
            <p className="px-1 py-3 text-sm text-slate-400">近 30 天没有提醒,岁月静好。</p>
          )}
          <ul className="max-h-72 divide-y divide-slate-100 overflow-y-auto">
            {items?.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-2 px-1 py-2.5">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: item.subscription.categoryColor ?? '#cbd5e1' }}
                    />
                    <span className="truncate text-sm font-medium text-slate-800">
                      {item.subscription.name}
                    </span>
                  </div>
                  <div className="mt-0.5 text-xs text-slate-400">
                    {formatDate(item.subscription.nextPaymentDate)} 扣款 ·{' '}
                    {relativeDue(item.subscription.nextPaymentDate)}
                  </div>
                </div>
                <span className="shrink-0 text-sm font-medium text-slate-900">
                  {money(item.subscription.amount, item.subscription.currency)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
