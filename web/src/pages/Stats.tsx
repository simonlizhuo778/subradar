import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { EChartsCoreOption } from 'echarts/core';
import { EChart } from '@/components/EChart';
import { api } from '@/lib/api';
import { cycleLabel, money, relativeDue } from '@/lib/format';
import type {
  AiSettingsInfo,
  CategoryStatRow,
  MonthlyPoint,
  SuggestionsResult,
  TopSubscriptionRow,
} from '@/lib/types';

const CHART_COLORS = [
  '#0f172a',
  '#e11d48',
  '#0ea5e9',
  '#10b981',
  '#f59e0b',
  '#8b5cf6',
  '#64748b',
  '#f43f5e',
  '#22c55e',
  '#6366f1',
];

export function Stats() {
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
      },
      yAxis: {
        type: 'value',
        axisLabel: { color: '#94a3b8', fontSize: 10 },
        splitLine: { lineStyle: { color: '#f1f5f9' } },
      },
      series: [
        {
          type: 'bar',
          data: points.map((p) => ({
            value: p.byCurrency[currency] ?? 0,
            itemStyle: { color: p.month === nowMonth ? '#e11d48' : '#0f172a' },
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
        formatter: (params: unknown) => {
          const p = params as { name: string; value: number; percent: number };
          return `${p.name}<br/>${money(p.value, currency)}/年 · ${p.percent}%`;
        },
      },
      legend: { bottom: 0, textStyle: { color: '#475569', fontSize: 11 } },
      series: [
        {
          type: 'pie',
          radius: ['42%', '68%'],
          center: ['50%', '44%'],
          itemStyle: { borderColor: '#fff', borderWidth: 2 },
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
    return <div className="rounded-lg bg-rose-50 p-4 text-sm text-rose-600">{error}</div>;
  }
  if (!monthly || !byCategory || !top) {
    return <div className="text-sm text-slate-400">加载中…</div>;
  }

  const maxYearly = Math.max(0, ...top.map((t) => t.yearlyCost));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">统计图表</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            月度扣款(过去 6 个月 + 未来 6 个月,红色为当月)
          </p>
        </div>
        {currencies.length > 1 && (
          <div className="flex rounded-lg border border-slate-200 bg-white p-0.5">
            {currencies.map((c) => (
              <button
                key={c}
                onClick={() => setCurrency(c)}
                className={`rounded-md px-3 py-1 text-sm transition ${
                  currency === c ? 'bg-slate-900 font-medium text-white' : 'text-slate-600'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="font-semibold text-slate-900">月度扣款</h2>
          <p className="text-xs text-slate-400">按当前订阅展开:左侧为回顾,右侧为预测</p>
          <EChart option={monthlyOption} height={280} />
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="font-semibold text-slate-900">分类年成本占比</h2>
          <p className="text-xs text-slate-400">{currency} 口径,含试用订阅</p>
          <EChart option={categoryOption} height={280} />
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="font-semibold text-slate-900">年成本 Top {top.length}</h2>
        <ul className="mt-4 space-y-3">
          {top.map((row) => (
            <li key={row.id}>
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: row.categoryColor ?? '#cbd5e1' }}
                  />
                  <span className="text-slate-700">{row.name}</span>
                  <span className="text-xs text-slate-400">
                    {money(row.amount, row.currency)} / {cycleLabel(row.cycle, row.customDays)}
                  </span>
                </span>
                <span className="flex items-center gap-3">
                  <span className="text-xs text-slate-400">
                    下次 {relativeDue(row.nextPaymentDate)}
                  </span>
                  <span className="font-medium text-slate-900">
                    {money(row.yearlyCost, row.currency)}
                    <span className="ml-1 text-xs text-slate-400">/年</span>
                  </span>
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${maxYearly > 0 ? Math.max(2, (row.yearlyCost / maxYearly) * 100) : 0}%`,
                    backgroundColor: row.categoryColor ?? '#94a3b8',
                  }}
                />
              </div>
            </li>
          ))}
          {top.length === 0 && (
            <li className="py-6 text-center text-sm text-slate-400">还没有生效的订阅</li>
          )}
        </ul>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-semibold text-slate-900">AI 省钱建议</h2>
            <p className="text-xs text-slate-400">
              基于你的生效订阅生成可执行的合并/降级/取消建议(消耗模型额度)
            </p>
          </div>
          <button
            onClick={() => void generateSuggestions()}
            disabled={generating || aiInfo?.configured === false}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:opacity-50"
          >
            {generating ? '生成中…' : suggestions ? '重新生成' : '生成建议'}
          </button>
        </div>

        {aiInfo && !aiInfo.configured && (
          <p className="mt-3 text-sm text-slate-500">
            还没有配置 AI,先到
            <Link to="/settings" className="mx-1 font-medium underline">
              设置 → AI 接入
            </Link>
            填写 API Key。
          </p>
        )}
        {suggestError && (
          <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
            {suggestError}
          </p>
        )}

        {suggestions && (
          <ul className="mt-4 space-y-3">
            {suggestions.suggestions.map((s, index) => (
              <li key={index} className="rounded-lg border border-slate-100 bg-slate-50/60 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      s.priority === 'high'
                        ? 'bg-rose-100 text-rose-600'
                        : s.priority === 'medium'
                          ? 'bg-amber-100 text-amber-600'
                          : 'bg-slate-200 text-slate-500'
                    }`}
                  >
                    {s.priority === 'high' ? '高优先' : s.priority === 'medium' ? '中优先' : '低优先'}
                  </span>
                  <span className="font-medium text-slate-900">{s.title}</span>
                  {s.potentialYearlySaving !== null && (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                      约省 ¥{s.potentialYearlySaving}/年
                    </span>
                  )}
                </div>
                <p className="mt-1.5 text-sm text-slate-600">{s.detail}</p>
                {s.related.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {s.related.map((name) => (
                      <span key={name} className="rounded bg-white px-1.5 py-0.5 text-xs text-slate-400">
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
      </div>
    </div>
  );
}
