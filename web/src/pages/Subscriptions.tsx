import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { SubscriptionForm } from '@/components/SubscriptionForm';
import {
  STATUS_LABELS,
  cycleLabel,
  formatDate,
  money,
  relativeDue,
  statusClass,
} from '@/lib/format';
import type { Category, Subscription, SubscriptionStatus } from '@/lib/types';

const TABS: Array<{ key: 'all' | SubscriptionStatus; label: string }> = [
  { key: 'all', label: '全部' },
  { key: 'active', label: '生效' },
  { key: 'paused', label: '暂停' },
  { key: 'cancelled', label: '已取消' },
];

export function Subscriptions() {
  const [items, setItems] = useState<Subscription[] | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [tab, setTab] = useState<'all' | SubscriptionStatus>('all');
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Subscription | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQ(q.trim()), 300);
    return () => clearTimeout(timer);
  }, [q]);

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (tab !== 'all') params.set('status', tab);
      if (debouncedQ) params.set('q', debouncedQ);
      const qs = params.toString();
      setItems(await api<Subscription[]>(`/subscriptions${qs ? `?${qs}` : ''}`));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败');
    }
  }, [tab, debouncedQ]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    api<Category[]>('/categories')
      .then(setCategories)
      .catch(() => undefined);
  }, []);

  async function patchStatus(sub: Subscription, status: SubscriptionStatus) {
    setBusyId(sub.id);
    try {
      await api(`/subscriptions/${sub.id}`, { method: 'PATCH', body: { status } });
      await load();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : '操作失败');
    } finally {
      setBusyId(null);
    }
  }

  async function remove(sub: Subscription) {
    if (!window.confirm(`确定删除「${sub.name}」吗?扣款历史会一并删除。`)) return;
    setBusyId(sub.id);
    try {
      await api(`/subscriptions/${sub.id}`, { method: 'DELETE' });
      await load();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : '删除失败');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">订阅管理</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            {items ? `${items.length} 条记录` : '…'}
          </p>
        </div>
        <button
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
        >
          + 新建订阅
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex rounded-lg border border-slate-200 bg-white p-0.5">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`rounded-md px-3 py-1.5 text-sm transition ${
                tab === t.key ? 'bg-slate-900 font-medium text-white' : 'text-slate-600'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <input
          className="w-56 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-slate-900"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="搜索名称…"
        />
      </div>

      {error && (
        <div className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600">{error}</div>
      )}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-xs text-slate-400">
              <th className="px-4 py-3 font-medium">订阅</th>
              <th className="px-4 py-3 font-medium">周期 / 金额</th>
              <th className="px-4 py-3 font-medium">下次扣款</th>
              <th className="px-4 py-3 font-medium">状态</th>
              <th className="px-4 py-3 text-right font-medium">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items?.map((sub) => (
              <tr key={sub.id} className="transition hover:bg-slate-50/60">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: sub.category?.color ?? '#cbd5e1' }}
                    />
                    <span className="font-medium text-slate-900">{sub.name}</span>
                    {sub.autoRenew && (
                      <span className="rounded bg-rose-50 px-1.5 py-0.5 text-[10px] text-rose-500">
                        自动续费
                      </span>
                    )}
                    <span className="text-xs text-slate-400">{sub.category?.name ?? '未分类'}</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className="font-medium text-slate-900">
                    {money(sub.amount, sub.currency)}
                  </span>
                  <span className="text-slate-400"> / {cycleLabel(sub.cycle, sub.customDays)}</span>
                </td>
                <td className="px-4 py-3">
                  {sub.status === 'active' || sub.status === 'trial' ? (
                    <div>
                      <div className="text-slate-700">{formatDate(sub.nextPaymentDate)}</div>
                      <div className="text-xs text-slate-400">
                        {relativeDue(sub.nextPaymentDate)}
                      </div>
                    </div>
                  ) : (
                    <span className="text-slate-300">—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs ${statusClass(sub.status)}`}>
                    {STATUS_LABELS[sub.status]}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1">
                    <button
                      disabled={busyId === sub.id}
                      onClick={() => {
                        setEditing(sub);
                        setFormOpen(true);
                      }}
                      className="rounded-md border border-slate-200 px-2.5 py-1 text-xs text-slate-600 transition hover:bg-slate-100 disabled:opacity-40"
                    >
                      编辑
                    </button>
                    {sub.status === 'active' || sub.status === 'trial' ? (
                      <button
                        disabled={busyId === sub.id}
                        onClick={() => void patchStatus(sub, 'paused')}
                        className="rounded-md border border-slate-200 px-2.5 py-1 text-xs text-amber-600 transition hover:bg-amber-50 disabled:opacity-40"
                      >
                        暂停
                      </button>
                    ) : sub.status === 'paused' ? (
                      <button
                        disabled={busyId === sub.id}
                        onClick={() => void patchStatus(sub, 'active')}
                        className="rounded-md border border-slate-200 px-2.5 py-1 text-xs text-emerald-600 transition hover:bg-emerald-50 disabled:opacity-40"
                      >
                        恢复
                      </button>
                    ) : null}
                    <button
                      disabled={busyId === sub.id}
                      onClick={() => void remove(sub)}
                      className="rounded-md border border-slate-200 px-2.5 py-1 text-xs text-rose-500 transition hover:bg-rose-50 disabled:opacity-40"
                    >
                      删除
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {items?.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-sm text-slate-400">
                  {q || tab !== 'all' ? '没有符合条件的订阅' : '还没有订阅,点右上角新建一个'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <SubscriptionForm
        open={formOpen}
        initial={editing}
        categories={categories}
        onClose={() => setFormOpen(false)}
        onSaved={() => void load()}
      />
    </div>
  );
}
