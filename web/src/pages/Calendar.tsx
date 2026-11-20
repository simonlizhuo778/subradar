import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { formatDate, money } from '@/lib/format';
import type { CalendarDayItem, CalendarResponse } from '@/lib/types';

const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日'];

export function Calendar() {
  const today = useMemo(() => new Date(), []);
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [data, setData] = useState<CalendarResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    const monthStr = `${year}-${String(month).padStart(2, '0')}`;
    let cancelled = false;
    api<CalendarResponse>(`/calendar?month=${monthStr}`)
      .then((res) => {
        if (!cancelled) {
          setData(res);
          setError(null);
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : '加载失败');
      });
    return () => {
      cancelled = true;
    };
  }, [year, month]);

  function shiftMonth(delta: number) {
    let m = month + delta;
    let y = year;
    if (m < 1) {
      m = 12;
      y -= 1;
    } else if (m > 12) {
      m = 1;
      y += 1;
    }
    setMonth(m);
    setYear(y);
    setSelected(null);
  }

  const leading = (new Date(year, month - 1, 1).getDay() + 6) % 7; // 周一开头
  const daysInMonth = new Date(year, month, 0).getDate();
  const todayKey = formatDate(today);
  const isCurrentMonth = year === today.getFullYear() && month === today.getMonth() + 1;

  const cells: Array<{ day: number; key: string } | null> = [
    ...Array.from({ length: leading }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => ({
      day: i + 1,
      key: `${year}-${String(month).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`,
    })),
  ];
  // 补齐最后一行
  while (cells.length % 7 !== 0) cells.push(null);

  const selectedItems: CalendarDayItem[] = selected ? data?.days[selected] ?? [] : [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900">扣款日历</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => shiftMonth(-1)}
            className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-600 transition hover:bg-slate-100"
          >
            ‹
          </button>
          <span className="min-w-28 text-center font-medium text-slate-900">
            {year} 年 {month} 月
          </span>
          <button
            onClick={() => shiftMonth(1)}
            className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-600 transition hover:bg-slate-100"
          >
            ›
          </button>
          {!isCurrentMonth && (
            <button
              onClick={() => {
                setYear(today.getFullYear());
                setMonth(today.getMonth() + 1);
                setSelected(null);
              }}
              className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-600 transition hover:bg-slate-100"
            >
              今天
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600">{error}</div>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50/60 text-center text-xs font-medium text-slate-400">
          {WEEKDAYS.map((w) => (
            <div key={w} className="py-2">
              {w}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((cell, index) => {
            if (!cell) {
              return <div key={`blank-${index}`} className="min-h-20 border-b border-r border-slate-50 bg-slate-50/30" />;
            }
            const items = data?.days[cell.key] ?? [];
            const isToday = cell.key === todayKey;
            const isSelected = cell.key === selected;
            return (
              <button
                key={cell.key}
                onClick={() => setSelected(isSelected ? null : cell.key)}
                className={`min-h-20 border-b border-r border-slate-50 p-1.5 text-left align-top transition last:border-r-0 hover:bg-slate-50 ${
                  isSelected ? 'bg-slate-100' : ''
                }`}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                      isToday ? 'bg-slate-900 font-semibold text-white' : 'text-slate-500'
                    }`}
                  >
                    {cell.day}
                  </span>
                  {items.length > 0 && (
                    <span className="rounded-full bg-slate-100 px-1.5 text-[10px] text-slate-500">
                      {items.length}
                    </span>
                  )}
                </div>
                <div className="mt-1 space-y-1">
                  {items.slice(0, 2).map((item, i) => (
                    <div
                      key={`${item.subscriptionId}-${i}`}
                      className="flex items-center gap-1 truncate text-[11px] text-slate-600"
                      title={`${item.name} ${money(item.amount, item.currency)}`}
                    >
                      <span
                        className="h-1.5 w-1.5 shrink-0 rounded-full"
                        style={{ backgroundColor: item.category?.color ?? '#cbd5e1' }}
                      />
                      <span className="truncate">{item.name}</span>
                    </div>
                  ))}
                  {items.length > 2 && (
                    <div className="text-[10px] text-slate-400">+{items.length - 2} 更多</div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="font-semibold text-slate-900">
          {selected ? `${selected} 的扣款` : '点击日期查看当天详情'}
        </h2>
        {selected && selectedItems.length === 0 && (
          <p className="mt-2 text-sm text-slate-400">当天没有扣款。</p>
        )}
        <ul className="mt-2 divide-y divide-slate-100">
          {selectedItems.map((item, index) => (
            <li
              key={`${item.subscriptionId}-${index}`}
              className="flex items-center justify-between py-2.5"
            >
              <div className="flex items-center gap-2">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: item.category?.color ?? '#cbd5e1' }}
                />
                <span className="text-sm text-slate-700">{item.name}</span>
                <span className="text-xs text-slate-400">{item.category?.name ?? '未分类'}</span>
                {item.autoRenew && (
                  <span className="rounded bg-rose-50 px-1.5 py-0.5 text-[10px] text-rose-500">
                    自动续费
                  </span>
                )}
              </div>
              <span className="text-sm font-medium text-slate-900">
                {money(item.amount, item.currency)}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
