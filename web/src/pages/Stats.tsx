import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, TrendingUp } from 'lucide-react';
import type { EChartsCoreOption } from 'echarts/core';
import { EChart } from '@/components/EChart';
import { api } from '@/lib/api';
import { cycleLabel, money, relativeDue } from '@/lib/format';
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  PageHeader,
  Segmented,
  Skeleton,
} from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import type {
  AiSettingsInfo,
  CategoryStatRow,
  MonthlyPoint,
  SuggestionsResult,
  TopSubscriptionRow,
} from '@/lib/types';

/** 8 个可区分色相:蓝 / 青 / 琥珀 / 玫红 / 紫 / 天蓝 / 黄绿 / 灰蓝 */
const CHART_COLORS = [
  '#0071E3',
  '#14B8A6',
  '#F59E0B',
  '#F43F5E',
  '#8B5CF6',
  '#0EA5E9',
  '#84CC16',
  '#64748B',
];

const TOOLTIP_STYLE = {
  backgroundColor: '#ffffff',
  borderColor: 'rgba(15, 23, 42, 0.08)',
  borderWidth: 1,
  padding: [8, 12] as [number, number],
  textStyle: { color: '#334155', fontSize: 12 },
  extraCssText: 'box-shadow: 0 8px 24px -8px rgb(15 23 42 / 0.18); border-radius: 12px;',
};

function StatsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <Card key={i} className="p-5">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="mt-4 h-64 w-full rounded-xl" />
          </Card>
        ))}
      </div>
      <Card className="p-5">
        <Skeleton className="h-5 w-40" />
        <div className="mt-4 space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </div>
      </Card>
    </div>
  );
}

export function Stats() {
  const toast = useToast();
  const [monthly, setMonthly] = useState<MonthlyPoint[] | null>(null);
  const [byCategory, setByCategory] = useState<CategoryStatRow[] | null>(null);
  const [top, setTop] = useState<TopSubscriptionRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aiInfo, setAiInfo] = useState<AiSettingsInfo | null>(null);
  const [suggestions, setSuggestions] = useState<SuggestionsResult | null>(null);
  const [generating, setGenerating] = useState(false);
  const [suggestError, setSuggestError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      api<MonthlyPoint[]>('/stats/monthly?months=12'),
      api<CategoryStatRow[]>('/stats/category'),
      api<TopSubscriptionRow[]>('/stats/top?limit=8'),
    ])
      .then(([m, c, t]) => {
        if (!cancelled) {
          setMonthly(m);
          setByCategory(c);
          setTop(t);
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : '加载失败');
      });
    void api<AiSettingsInfo>('/settings/ai')
      .then((info) => {
        if (!cancelled) setAiInfo(info);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  async function generateSuggestions() {
    setSuggestError(null);
    setGenerating(true);
    try {
      setSuggestions(await api<SuggestionsResult>('/ai/suggestions', { method: 'POST' }));
      toast.success('省钱建议已生成');
    } catch (e) {
      setSuggestError(e instanceof Error ? e.message : '生成失败');
    } finally {
      setGenerating(false);
    }
  }

  const currencies = useMemo(() => {
    const set = new Set<string>();
    monthly?.forEach((p) => Object.keys(p.byCurrency).forEach((c) => set.add(c)));
    if (set.size === 0) set.add('CNY');
    return Array.from(set);
  }, [monthly]);

  const [currency, setCurrency] = useState('CNY');
  useEffect(() => {
    if (currencies.length > 0 && !currencies.includes(currency)) {
      setCurrency(currencies[0]);
    }
  }, [currencies, currency]);

  const nowMonth = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }, []);

  const monthlyOption = useMemo<EChartsCoreOption>(() => {
    const points = monthly ?? [];
    return {
      grid: { left: 48, right: 16, top: 32, bottom: 28 },
      tooltip: {
        trigger: 'axis',
        ...TOOLTIP_STYLE,
        formatter: (params: unknown) => {
          const list = params as Array<{ dataIndex: number; value: number }>;
          const point = points[list[0]?.dataIndex];
          if (!point) return '';
          return `${point.month}<br/>${point.count} 笔扣款 · ${money(
            point.byCurrency[currency] ?? 0,
            currency,
          )}`;
        },
      },
      xAxis: {
        type: 'category',
        data: points.map((p) => p.month.slice(2)),
        axisLabel: { color: '#94a3b8', fontSize: 10 },
        axisLine: { lineStyle: { color: '#e2e8f0' } },
        axisTick: { show: false },
      },
      yAxis: {
        type: 'value',
        axisLabel: { color: '#94a3b8', fontSize: 10 },
        splitLine: { lineStyle: { color: '#eef0f3' } },
      },
      series: [
        {
          type: 'bar',
          data: points.map((p) => ({
            value: p.byCurrency[currency] ?? 0,
            itemStyle: {
              color: p.month === nowMonth ? '#0071E3' : '#94a3b8',
              borderRadius: [4, 4, 0, 0],
            },
          })),
          barMaxWidth: 28,
        },
      ],
    };
  }, [monthly, currency, nowMonth]);

  const categoryOption = useMemo<EChartsCoreOption>(() => {
    const rows = (byCategory ?? []).filter((row) => row.yearlyByCurrency[currency] > 0);
    return {
      tooltip: {
        trigger: 'item',
        ...TOOLTIP_STYLE,
        formatter: (params: unknown) => {
          const p = params as { name: string; value: number; percent: number };
          return `${p.name}<br/>${money(p.value, currency)}/年 · ${p.percent}%`;
        },
      },
      legend: { bottom: 0, textStyle: { color: '#64748b', fontSize: 11 }, itemWidth: 10, itemHeight: 10 },
      series: [
        {
          type: 'pie',
          radius: ['42%', '68%'],
          center: ['50%', '44%'],
          itemStyle: { borderColor: '#fff', borderWidth: 2, borderRadius: 4 },
          label: { show: false },
          data: rows.map((row, index) => ({
            name: row.category?.name ?? '未分类',
            value: row.yearlyByCurrency[currency],
            itemStyle: {
              color: row.category?.color ?? CHART_COLORS[index % CHART_COLORS.length],
            },
          })),
        },
      ],
    };
  }, [byCategory, currency]);

  if (error) {
    return <Alert tone="error">{error}</Alert>;
  }
  if (!monthly || !byCategory || !top) {
    return <StatsSkeleton />;
  }

  const maxYearly = Math.max(0, ...top.map((t) => t.yearlyCost));

  return (
    <div className="animate-fade-up space-y-6">
      <PageHeader
        title="统计图表"
        description="月度扣款(过去 6 个月 + 未来 6 个月,蓝色为当月)"
        actions={
          currencies.length > 1 ? (
            <Segmented
              options={currencies.map((c) => ({ value: c, label: c }))}
              value={currency}
              onChange={setCurrency}
            />
          ) : undefined
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="text-[15px] font-semibold text-slate-900">月度扣款</h2>
          <p className="mt-0.5 text-xs text-slate-400">按当前订阅展开:左侧为回顾,右侧为预测</p>
          <EChart option={monthlyOption} height={280} />
        </Card>

        <Card className="p-5">
          <h2 className="text-[15px] font-semibold text-slate-900">分类年成本占比</h2>
          <p className="mt-0.5 text-xs text-slate-400">{currency} 口径,含试用订阅</p>
          <EChart option={categoryOption} height={280} />
        </Card>
      </div>

      <Card className="p-5">
        <h2 className="flex items-center gap-2 text-[15px] font-semibold text-slate-900">
          <TrendingUp className="h-4 w-4 text-slate-400" aria-hidden />
          年成本 Top {top.length}
        </h2>
        <ul className="mt-4 space-y-3.5">
          {top.map((row, index) => (
            <li key={row.id}>
              <div className="mb-1.5 flex items-center justify-between gap-2 text-sm">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-slate-100 text-[11px] font-medium text-slate-500">
                    {index + 1}
                  </span>
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: row.categoryColor ?? '#cbd5e1' }}
                  />
                  <span className="truncate text-slate-700">{row.name}</span>
                  <span className="hidden shrink-0 text-xs text-slate-400 sm:inline">
                    {money(row.amount, row.currency)} / {cycleLabel(row.cycle, row.customDays)}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-3">
                  <span className="hidden text-xs text-slate-400 sm:inline">
                    下次 {relativeDue(row.nextPaymentDate)}
                  </span>
                  <span className="font-medium text-slate-900">
                    {money(row.yearlyCost, row.currency)}
                    <span className="ml-1 text-xs font-normal text-slate-400">/年</span>
                  </span>
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${maxYearly > 0 ? Math.max(2, (row.yearlyCost / maxYearly) * 100) : 0}%`,
                    backgroundColor: row.categoryColor ?? '#94a3b8',
                  }}
                />
              </div>
            </li>
          ))}
          {top.length === 0 && (
            <li>
              <EmptyState icon={TrendingUp} title="还没有生效的订阅" className="py-6" />
            </li>
          )}
        </ul>
      </Card>

      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 text-[15px] font-semibold text-slate-900">
              <Sparkles className="h-4 w-4 text-accent-500" aria-hidden />
              AI 省钱建议
            </h2>
            <p className="mt-0.5 text-xs leading-5 text-slate-400">
              基于你的生效订阅生成可执行的合并/降级/取消建议(消耗模型额度)
            </p>
          </div>
          <Button
            onClick={() => void generateSuggestions()}
            disabled={generating || aiInfo?.configured === false}
            loading={generating}
          >
            {!generating && <Sparkles className="h-4 w-4" aria-hidden />}
            {generating ? '生成中…' : suggestions ? '重新生成' : '生成建议'}
          </Button>
        </div>

        {aiInfo && !aiInfo.configured && (
          <Alert tone="info" className="mt-3">
            还没有配置 AI,先到
            <Link to="/settings" className="mx-1 font-medium underline underline-offset-2">
              设置 → AI 接入
            </Link>
            填写 API Key。
          </Alert>
        )}
        {suggestError && <Alert tone="warning" className="mt-3">{suggestError}</Alert>}

        {suggestions && (
          <ul className="mt-4 space-y-3">
            {suggestions.suggestions.map((s, index) => (
              <li key={index} className="rounded-xl border border-slate-900/6 bg-slate-50/60 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={s.priority === 'high' ? 'danger' : s.priority === 'medium' ? 'warning' : 'neutral'} dot>
                    {s.priority === 'high' ? '高优先' : s.priority === 'medium' ? '中优先' : '低优先'}
                  </Badge>
                  <span className="font-medium text-slate-900">{s.title}</span>
                  {s.potentialYearlySaving !== null && (
                    <Badge tone="success">约省 ¥{s.potentialYearlySaving}/年</Badge>
                  )}
                </div>
                <p className="mt-1.5 text-sm leading-6 text-slate-600">{s.detail}</p>
                {s.related.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {s.related.map((name) => (
                      <span
                        key={name}
                        className="rounded-md border border-slate-900/6 bg-white px-1.5 py-0.5 text-xs text-slate-500"
                      >
                        {name}
                      </span>
                    ))}
                  </div>
                )}
              </li>
            ))}
            {suggestions.suggestions.length === 0 && (
              <li className="py-3 text-sm text-slate-400">模型没有给出建议,再试一次?</li>
            )}
          </ul>
        )}
      </Card>
    </div>
  );
}