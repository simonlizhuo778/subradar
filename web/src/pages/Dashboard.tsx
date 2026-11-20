import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { money, relativeDue, yearlyByCurrencyText } from '@/lib/format';
import type { CategoryStatRow, StatsSummary, UpcomingItem } from '@/lib/types';

function UpcomingList({ items }: { items: UpcomingItem[] }) {
  if (items.length === 0) {
    return <p className="py-4 text-sm text-slate-400">近 30 天没有待扣款,舒服。</p>;
  }
  return (
    <ul className="divide-y divide-slate-100">
      {items.map((item) => (
        <li key={item.subscriptionId} className="flex items-center justify-between py-2.5">
          <div className="flex min-w-0 items-center gap-2">
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: item.categoryColor ?? '#cbd5e1' }}
            />
            <span className="truncate text-sm text-slate-700">{item.name}</span>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <span className="text-sm font-medium text-slate-900">
              {money(item.amount, item.currency)}
            </span>
            <span
              className={`rounded-full px-2 py-0.5 text-xs ${
                item.daysUntil <= 7 ? 'bg-rose-50 text-rose-500' : 'bg-slate-100 text-slate-500'
              }`}
            >
              {relativeDue(item.nextPaymentDate)}
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function Dashboard() {
  const [summary, setSummary] = useState<StatsSummary | null>(null);
  const [categories, setCategories] = useState<CategoryStatRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([api<StatsSummary>('/stats/summary'), api<CategoryStatRow[]>('/stats/category')])
      .then(([s, c]) => {
        if (!cancelled) {
          setSummary(s);
          setCategories(c);
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : '加载失败');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return <div className="rounded-lg bg-rose-50 p-4 text-sm text-rose-600">{error}</div>;
  }
  if (!summary || !categories) {
    return <div className="text-sm text-slate-400">加载中…</div>;
  }

  const cards = [
    {
      label: '生效订阅',
      value: String(summary.activeCount),
      hint: summary.pausedCount > 0 ? `另有 ${summary.pausedCount} 个已暂停` : '全部生效中',
    },
    {
      label: '年度订阅支出',
      value: yearlyByCurrencyText(summary.yearlyByCurrency),
      hint: '按当前周期折算的年成本',
    },
    {
      label: '本月内待扣款',
      value: String(summary.monthRemaining),
      hint: '月底前将从账户划走',
    },
    {
      label: '近 7 天待扣款',
      value: String(summary.upcoming7Count),
      hint: '重点关注,别被刺客偷袭',
    },
  ];

  const maxYearly = Math.max(
    0,
    ...categories.map((c) => Math.max(0, ...Object.values(c.yearlyByCurrency))),
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {cards.map((card) => (
          <div key={card.label} className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="text-xl font-bold text-slate-900">{card.value}</div>
            <div className="mt-1 text-sm text-slate-600">{card.label}</div>
            <div className="mt-2 text-xs text-slate-400">{card.hint}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="font-semibold text-slate-900">近 30 天待扣款</h2>
          <UpcomingList items={summary.upcoming} />
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="font-semibold text-slate-900">分类年成本</h2>
          {categories.length === 0 ? (
            <p className="py-4 text-sm text-slate-400">还没有生效的订阅。</p>
          ) : (
            <ul className="mt-2 space-y-3">
              {categories.map((row) => {
                const primary = Object.entries(row.yearlyByCurrency)[0];
                const width =
                  primary && maxYearly > 0 ? Math.max(2, (primary[1] / maxYearly) * 100) : 0;
                return (
                  <li key={row.category?.id ?? 'none'}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="text-slate-700">
                        {row.category?.name ?? '未分类'}
                        <span className="ml-2 text-xs text-slate-400">{row.count} 个</span>
                      </span>
                      <span className="font-medium text-slate-900">
                        {yearlyByCurrencyText(row.yearlyByCurrency)}
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${width}%`, backgroundColor: row.category?.color ?? '#94a3b8' }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      <p className="text-center text-xs text-slate-400">
        W3 预告:AI 快速录入 —— 截图 / 语音 / 账单文本一键生成订阅(自带 API Key)
      </p>
    </div>
  );
}
