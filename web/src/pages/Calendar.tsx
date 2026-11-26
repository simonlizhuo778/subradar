import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { api } from '@/lib/api';
import { formatDate, money } from '@/lib/format';
import { Alert, Badge, Button, Card, IconButton, PageHeader, Skeleton, cx } from '@/components/ui';
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
    <div className="animate-fade-up space-y-4">
      <PageHeader
        title="扣款日历"
        actions={
          <div className="flex items-center gap-1.5">
            <IconButton onClick={() => shiftMonth(-1)} aria-label="上个月" className="border border-slate-900/8 bg-white">
              <ChevronLeft className="h-4 w-4" aria-hidden />
            </IconButton>
            <span className="min-w-28 text-center text-sm font-medium text-slate-900">
              {year} 年 {month} 月
            </span>
            <IconButton onClick={() => shiftMonth(1)} aria-label="下个月" className="border border-slate-900/8 bg-white">
              <ChevronRight className="h-4 w-4" aria-hidden />
            </IconButton>
            {!isCurrentMonth && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setYear(today.getFullYear());
                  setMonth(today.getMonth() + 1);
                  setSelected(null);
                }}
              >
                今天
              </Button>
            )}
          </div>
        }
      />

      {error && <Alert tone="error">{error}</Alert>}

      <Card className="overflow-hidden">
        <div className="grid grid-cols-7 border-b border-slate-900/6 bg-slate-50/80 text-center text-xs font-medium text-slate-400">
          {WEEKDAYS.map((w) => (
            <div key={w} className="py-2.5">
              {w}
            </div>
          ))}
        </div>
        {data === null && !error ? (
          <div className="grid grid-cols-7 gap-px p-3">
            {Array.from({ length: 35 }).map((_, i) => (
              <Skeleton key={i} className="m-1 h-16 rounded-lg" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-7">
            {cells.map((cell, index) => {
              if (!cell) {
                return (
                  <div
                    key={`blank-${index}`}
                    className="min-h-16 border-b border-r border-slate-900/4 bg-slate-50/40 sm:min-h-24"
                  />
                );
              }
              const items = data?.days[cell.key] ?? [];
              const isToday = cell.key === todayKey;
              const isSelected = cell.key === selected;
              return (
                <button
                  key={cell.key}
                  type="button"
                  onClick={() => setSelected(isSelected ? null : cell.key)}
                  className={cx(
                    'min-h-16 border-b border-r border-slate-900/4 p-1.5 text-left align-top transition-colors duration-150 last:border-r-0 sm:min-h-24 sm:p-2',
                    isSelected ? 'bg-accent-50/70' : 'hover:bg-slate-50',
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={cx(
                        'inline-flex h-6 w-6 items-center justify-center rounded-full text-xs',
                        isToday ? 'bg-accent-600 font-semibold text-white' : 'text-slate-500',
                      )}
                    >
                      {cell.day}
                    </span>
                    {items.length > 0 && (
                      <span className="rounded-full bg-slate-900/5 px-1.5 text-[10px] text-slate-500">
                        {items.length}
                      </span>
                    )}
                  </div>
                  {/* 小屏:分类色点;大屏:名称列表 */}
                  {items.length > 0 && (
                    <div className="mt-1.5 flex gap-1 sm:hidden">
                      {items.slice(0, 4).map((item, i) => (
                        <span
                          key={`${item.subscriptionId}-${i}`}
                          className="h-1.5 w-1.5 rounded-full"
                          style={{ backgroundColor: item.category?.color ?? '#cbd5e1' }}
                        />
                      ))}
                    </div>
                  )}
                  <div className="mt-1 hidden space-y-1 sm:block">
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
        )}
      </Card>

      <Card className="p-5">
        <h2 className="flex items-center gap-2 text-[15px] font-semibold text-slate-900">
          <CalendarDays className="h-4 w-4 text-slate-400" aria-hidden />
          {selected ? `${selected} 的扣款` : '点击日期查看当天详情'}
        </h2>
        {selected && selectedItems.length === 0 && (
          <p className="mt-3 text-sm text-slate-400">当天没有扣款。</p>
        )}
        {!selected && (
          <p className="mt-3 text-sm text-slate-400">在上方日历中选择一天,查看当天的扣款明细。</p>
        )}
        <ul className="mt-2 divide-y divide-slate-900/5">
          {selectedItems.map((item, index) => (
            <li
              key={`${item.subscriptionId}-${index}`}
              className="-mx-2 flex items-center justify-between rounded-lg px-2 py-2.5 transition-colors duration-150 hover:bg-slate-50"
            >
              <div className="flex min-w-0 items-center gap-2">
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: item.category?.color ?? '#cbd5e1' }}
                />
                <span className="truncate text-sm text-slate-700">{item.name}</span>
                <span className="hidden text-xs text-slate-400 sm:inline">
                  {item.category?.name ?? '未分类'}
                </span>
                {item.autoRenew && (
                  <Badge tone="danger" className="px-1.5 text-[10px]">
                    自动续费
                  </Badge>
                )}
              </div>
              <span className="shrink-0 text-sm font-medium text-slate-900">
                {money(item.amount, item.currency)}
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}