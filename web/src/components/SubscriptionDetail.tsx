import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { api } from '@/lib/api';
import { cycleLabel, formatDate, money, relativeDue, STATUS_LABELS, statusClass } from '@/lib/format';
import { parseDateOnly } from '@/lib/format';
import type { SubscriptionDetail } from '@/lib/types';

interface Props {
  subscriptionId: number;
  onClose: () => void;
}

const inputClass =
  'rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-slate-900';

export function SubscriptionDetail({ subscriptionId, onClose }: Props) {
  const [detail, setDetail] = useState<SubscriptionDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [paidAt, setPaidAt] = useState(formatDate(new Date()));
  const [amount, setAmount] = useState('');
  const [adding, setAdding] = useState(false);

  async function load() {
    try {
      const data = await api<SubscriptionDetail>(`/subscriptions/${subscriptionId}`);
      setDetail(data);
      setAmount(String(data.amount));
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败');
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subscriptionId]);

  async function addPayment(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!paidAt || Number.isNaN(Number(amount))) {
      setError('请填写日期与金额');
      return;
    }
    setAdding(true);
    try {
      await api(`/subscriptions/${subscriptionId}/payments`, {
        method: 'POST',
        body: {
          paidAt: parseDateOnly(paidAt).toISOString(),
          amount: amount === '' ? undefined : Number(amount),
        },
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : '补记失败');
    } finally {
      setAdding(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 sm:items-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {!detail && !error && <p className="text-sm text-slate-400">加载中…</p>}
        {error && <p className="text-sm text-rose-600">{error}</p>}
        {detail && (
          <>
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900">{detail.name}</h2>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-sm">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${statusClass(detail.status)}`}
                  >
                    {STATUS_LABELS[detail.status]}
                  </span>
                  <span className="font-medium text-slate-900">
                    {money(detail.amount, detail.currency)}
                  </span>
                  <span className="text-slate-400">
                    / {cycleLabel(detail.cycle, detail.customDays)}
                  </span>
                  <span className="text-slate-400">{detail.category?.name ?? '未分类'}</span>
                </div>
              </div>
              <button onClick={onClose} className="text-slate-400 transition hover:text-slate-600">
                ✕
              </button>
            </div>

            {detail.status === 'active' || detail.status === 'trial' ? (
              <div className="mt-3 rounded-lg bg-slate-50 p-3 text-sm">
                下次扣款:{formatDate(detail.nextPaymentDate)}
                <span className="ml-2 font-medium text-rose-500">
                  {relativeDue(detail.nextPaymentDate)}
                </span>
              </div>
            ) : null}

            <div className="mt-4">
              <h3 className="text-sm font-semibold text-slate-900">
                扣款历史({detail.payments.length} 笔)
              </h3>
              <ul className="mt-2 max-h-56 divide-y divide-slate-100 overflow-y-auto">
                {detail.payments.map((payment) => (
                  <li key={payment.id} className="flex items-center justify-between py-2 text-sm">
                    <span className="text-slate-600">{formatDate(payment.paidAt)}</span>
                    <span className="flex items-center gap-2">
                      {payment.source !== 'manual' && (
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-400">
                          {payment.source === 'auto'
                            ? '自动'
                            : payment.source === 'candidate'
                              ? 'AI/账单'
                              : '导入'}
                        </span>
                      )}
                      <span className="font-medium text-slate-900">
                        {money(payment.amount, payment.currency)}
                      </span>
                    </span>
                  </li>
                ))}
                {detail.payments.length === 0 && (
                  <li className="py-3 text-sm text-slate-400">还没有扣款记录</li>
                )}
              </ul>
            </div>

            <form onSubmit={addPayment} className="mt-4 space-y-2 border-t border-slate-100 pt-4">
              <div className="flex items-end gap-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">补记日期</label>
                  <input
                    type="date"
                    className={inputClass}
                    value={paidAt}
                    onChange={(e) => setPaidAt(e.target.value)}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">金额</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className={`${inputClass} w-24`}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </div>
                <button
                  type="submit"
                  disabled={adding}
                  className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:opacity-50"
                >
                  {adding ? '保存中…' : '补记一笔'}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
