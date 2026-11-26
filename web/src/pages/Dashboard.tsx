import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  CalendarCheck,
  CalendarClock,
  CircleDollarSign,
  ListChecks,
  Sparkles,
  Timer,
  Wallet,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { api } from '@/lib/api';
import { money, relativeDue, yearlyByCurrencyText } from '@/lib/format';
import { Alert, Badge, Button, Card, EmptyState, Skeleton, cx } from '@/components/ui';
import type { CategoryStatRow, StatsSummary, UpcomingItem } from '@/lib/types';

function UpcomingList({ items }: { items: UpcomingItem[] }) {
  if (items.length === 0) {
    return (
      <EmptyState
        icon={CalendarCheck}
        title="近 30 天没有待扣款"
        description="舒服。"
        className="py-8"
      />
    );
  }
  return (
    <ul className="mt-2 divide-y divide-slate-900/5">
      {items.map((item) => (
        <li
          key={item.subscriptionId}
          className="-mx-2 flex items-center justify-between rounded-lg px-2 py-2.5 transition-colors duration-150 hover:bg-slate-50"
        >
          <div className="flex min-w-0 items-center gap-2.5">
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
            <Badge tone={item.daysUntil <= 7 ? 'danger' : 'neutral'}>
              {relativeDue(item.nextPaymentDate)}
            </Badge>
          </div>
        </li>
      ))}
    </ul>
  );
}

interface StatCard {
  label: string;
  value: string;
  hint: string;
  icon: LucideIcon;
  iconClass: string;
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="p-5">
            <Skeleton className="h-9 w-9 rounded-xl" />
            <Skeleton className="mt-4 h-7 w-24" />
            <Skeleton className="mt-2 h-4 w-16" />
          </Card>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <Card key={i} className="p-5">
            <Skeleton className="h-5 w-32" />
            <div className="mt-4 space-y-3">
              {Array.from({ length: 4 }).map((_, j) => (
                <Skeleton key={j} className="h-9 w-full" />
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
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
    return <Alert tone="error">{error}</Alert>;
  }
  if (!summary || !categories) {
    return <DashboardSkeleton />;
  }

  const cards: StatCard[] = [
    {
      label: '生效订阅',
      value: String(summary.activeCount),
      hint: summary.pausedCount > 0 ? `另有 ${summary.pausedCount} 个已暂停` : '全部生效中',
      icon: ListChecks,
      iconClass: 'bg-accent-50 text-accent-600',
    },
    {
      label: '年度订阅支出',
      value: yearlyByCurrencyText(summary.yearlyByCurrency),
      hint: '按当前周期折算的年成本',
      icon: CircleDollarSign,
      iconClass: 'bg-emerald-50 text-emerald-600',
    },
    {
      label: '本月内待扣款',
      value: String(summary.monthRemaining),
      hint: '月底前将从账户划走',
      icon: Wallet,
      iconClass: 'bg-amber-50 text-amber-600',
    },
    {
      label: '近 7 天待扣款',
      value: String(summary.upcoming7Count),
      hint: '重点关注,别被刺客偷袭',
      icon: Timer,
      iconClass: 'bg-rose-50 text-rose-600',
    },
  ];

  const maxYearly = Math.max(
    0,
    ...categories.map((c) => Math.max(0, ...Object.values(c.yearlyByCurrency))),
  );

  return (
    <div className="animate-fade-up space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {cards.map((card) => (
          <Card key={card.label} className="p-5 transition-shadow duration-200 hover:shadow-pop">
            <div className="flex items-center gap-2.5">
              <span className={cx('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl', card.iconClass)}>
                <card.icon className="h-4.5 w-4.5" aria-hidden />
              </span>
              <span className="text-[13px] font-medium text-slate-500">{card.label}</span>
            </div>
            <div className="mt-3 truncate text-2xl font-semibold tracking-tight text-slate-900" title={card.value}>
              {card.value}
            </div>
            <div className="mt-1 text-xs text-slate-400">{card.hint}</div>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-[15px] font-semibold text-slate-900">
              <CalendarClock className="h-4 w-4 text-slate-400" aria-hidden />
              近 30 天待扣款
            </h2>
            {summary.upcoming.length > 0 && <Badge tone="neutral">{summary.upcoming.length} 笔</Badge>}
          </div>
          <UpcomingList items={summary.upcoming} />
        </Card>

        <Card className="p-5">
          <h2 className="flex items-center gap-2 text-[15px] font-semibold text-slate-900">
            <CircleDollarSign className="h-4 w-4 text-slate-400" aria-hidden />
            分类年成本
          </h2>
          {categories.length === 0 ? (
            <EmptyState
              icon={ListChecks}
              title="还没有生效的订阅"
              description="新建或从账单导入订阅后,这里会展示分类成本。"
              className="py-8"
            />
          ) : (
            <ul className="mt-4 space-y-3.5">
              {categories.map((row) => {
                const primary = Object.entries(row.yearlyByCurrency)[0];
                const width =
                  primary && maxYearly > 0 ? Math.max(2, (primary[1] / maxYearly) * 100) : 0;
                return (
                  <li key={row.category?.id ?? 'none'}>
                    <div className="mb-1.5 flex items-center justify-between gap-2 text-sm">
                      <span className="min-w-0 truncate text-slate-700">
                        {row.category?.name ?? '未分类'}
                        <span className="ml-2 text-xs text-slate-400">{row.count} 个</span>
                      </span>
                      <span className="shrink-0 font-medium text-slate-900">
                        {yearlyByCurrencyText(row.yearlyByCurrency)}
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{ width: `${width}%`, backgroundColor: row.category?.color ?? '#94a3b8' }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>

      <Card className="flex flex-wrap items-center gap-4 p-5">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-50 text-accent-600">
          <Sparkles className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-slate-900">AI 快速录入</p>
          <p className="mt-0.5 text-xs leading-5 text-slate-500">
            付款截图 / 账单短信一键生成订阅(自带 API Key)
          </p>
        </div>
        <Link to="/ai" className="shrink-0">
          <Button variant="secondary" size="sm">
            去试试
            <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </Button>
        </Link>
      </Card>
    </div>
  );
}