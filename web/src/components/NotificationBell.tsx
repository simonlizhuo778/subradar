import { useEffect, useRef, useState } from 'react';
import { Bell, CalendarClock } from 'lucide-react';
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
  const rootRef = useRef<HTMLDivElement>(null);

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

  // 点外部 / ESC 关闭下拉
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  async function requestPermission() {
    if (typeof Notification === 'undefined') return;
    const result = await Notification.requestPermission();
    setPermission(result);
  }

  const count = items?.length ?? 0;

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors duration-150 hover:bg-slate-900/5 hover:text-slate-800"
        title="到期提醒"
        aria-label={`到期提醒${count > 0 ? `,${count} 条` : ''}`}
      >
        <Bell className="h-4.5 w-4.5" aria-hidden />
        {count > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-medium text-white ring-2 ring-canvas">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-10 z-40 w-80 max-w-[calc(100vw-2rem)] animate-scale-in rounded-2xl border border-slate-900/8 bg-white p-3 shadow-pop">
          <div className="flex items-center justify-between px-1 pb-2">
            <span className="text-sm font-semibold text-slate-900">到期提醒</span>
            {permission === 'default' && (
              <button
                type="button"
                onClick={() => void requestPermission()}
                className="text-xs font-medium text-accent-600 transition-colors duration-150 hover:text-accent-700"
              >
                开启浏览器通知
              </button>
            )}
          </div>
          {items === null && <p className="px-1 py-3 text-sm text-slate-400">加载中…</p>}
          {items?.length === 0 && (
            <div className="flex flex-col items-center px-1 py-6 text-center">
              <CalendarClock className="h-6 w-6 text-slate-300" aria-hidden />
              <p className="mt-2 text-sm text-slate-400">近 30 天没有提醒,岁月静好。</p>
            </div>
          )}
          <ul className="max-h-72 divide-y divide-slate-900/5 overflow-y-auto">
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