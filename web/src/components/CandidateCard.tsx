import { useState } from 'react';
import type { FormEvent } from 'react';
import { api } from '@/lib/api';
import { formatDate, parseDateOnly } from '@/lib/format';
import type { CandidateRow, Category, Cycle, ExtractedCandidate } from '@/lib/types';

interface Props {
  candidate: CandidateRow;
  categories: Category[];
  defaultOpen?: boolean;
  onDone: () => void;
  onMessage: (message: string) => void;
}

const CURRENCIES = ['CNY', 'USD', 'EUR', 'HKD', 'JPY'];
const CYCLE_OPTIONS: Array<{ value: Cycle; label: string }> = [
  { value: 'monthly', label: '每月' },
  { value: 'quarterly', label: '每季' },
  { value: 'yearly', label: '每年' },
  { value: 'weekly', label: '每周' },
  { value: 'custom', label: '自定义(按天)' },
];
const PAYMENT_METHODS = [
  { value: '', label: '未指定' },
  { value: 'alipay', label: '支付宝' },
  { value: 'wechat', label: '微信支付' },
  { value: 'apple', label: 'Apple 扣款' },
  { value: 'card', label: '银行卡' },
  { value: 'other', label: '其他' },
];

const inputClass =
  'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-slate-900';
const labelClass = 'mb-1 block text-xs font-medium text-slate-600';

function confidenceClass(confidence: number): string {
  if (confidence >= 0.7) return 'bg-emerald-500';
  if (confidence >= 0.4) return 'bg-amber-400';
  return 'bg-rose-400';
}

function sourceLabel(source: string): string {
  if (source === 'image') return '截图识别';
  if (source === 'text') return '文本识别';
  if (source === 'bill') return '账单导入';
  return source;
}

function initForm(extracted: ExtractedCandidate) {
  return {
    name: extracted.name ?? '',
    categoryId: '',
    amount: extracted.amount !== null ? String(extracted.amount) : '',
    currency: extracted.currency || 'CNY',
    cycle: (extracted.cycle ?? 'monthly') as Cycle,
    customDays: String(extracted.cycle_days ?? 90),
    firstPaymentDate: extracted.first_payment_date ?? '',
    paymentMethod: extracted.payment_method ?? '',
    autoRenew: extracted.auto_renew ?? false,
    notes: '',
  };
}

export function CandidateCard({ candidate, categories, defaultOpen, onDone, onMessage }: Props) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  const [form, setForm] = useState(() => initForm(candidate.extracted));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function confirm(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.name.trim()) return setError('请填写名称');
    if (form.amount === '' || Number.isNaN(Number(form.amount))) return setError('请填写金额');
    if (form.cycle === 'custom' && (Number(form.customDays) < 1 || Number(form.customDays) > 365)) {
      return setError('自定义周期天数应为 1-365');
    }
    if (!form.firstPaymentDate) return setError('请选择首次扣款日(可点「今天」)');

    setBusy(true);
    try {
      await api(`/candidates/${candidate.id}/confirm`, {
        method: 'POST',
        body: {
          name: form.name.trim(),
          categoryId: form.categoryId ? Number(form.categoryId) : undefined,
          amount: Number(form.amount),
          currency: form.currency,
          cycle: form.cycle,
          customDays: form.cycle === 'custom' ? Number(form.customDays) : undefined,
          firstPaymentDate: parseDateOnly(form.firstPaymentDate).toISOString(),
          paymentMethod: form.paymentMethod || undefined,
          autoRenew: form.autoRenew,
          notes: form.notes.trim() || undefined,
        },
      });
      onMessage(`✓ 「${form.name.trim()}」已入库,扣款历史已回填`);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : '确认失败');
    } finally {
      setBusy(false);
    }
  }

  async function dismiss() {
    setBusy(true);
    try {
      await api(`/candidates/${candidate.id}/dismiss`, { method: 'POST' });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作失败');
    } finally {
      setBusy(false);
    }
  }

  const today = formatDate(new Date());

  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full flex-wrap items-center gap-3 px-4 py-3 text-left transition hover:bg-slate-50"
      >
        <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
          {sourceLabel(candidate.source)}
        </span>
        <span className="font-medium text-slate-900">
          {candidate.extracted.name ?? '(未识别出名称)'}
        </span>
        {candidate.extracted.amount !== null && (
          <span className="text-sm text-slate-600">
            {candidate.extracted.amount} {candidate.extracted.currency}
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-slate-400">
            置信度 {Math.round(candidate.confidence * 100)}%
          </span>
          <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-100">
            <div
              className={`h-full ${confidenceClass(candidate.confidence)}`}
              style={{ width: `${Math.max(6, candidate.confidence * 100)}%` }}
            />
          </div>
          <span className="text-xs text-slate-300">{open ? '收起 ▲' : '展开 ▼'}</span>
        </div>
      </button>

      {candidate.extracted.evidence && !open && (
        <p className="px-4 pb-3 text-xs text-slate-400">依据:{candidate.extracted.evidence}</p>
      )}

      {open && (
        <form onSubmit={confirm} className="space-y-3 border-t border-slate-100 p-4">
          {candidate.extracted.evidence && (
            <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
              模型依据:{candidate.extracted.evidence}
              {candidate.extracted.merchant && ` · 商户:${candidate.extracted.merchant}`}
            </p>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className={labelClass}>名称 *</label>
              <input
                className={inputClass}
                value={form.name}
                maxLength={60}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div>
              <label className={labelClass}>分类</label>
              <select
                className={inputClass}
                value={form.categoryId}
                onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
              >
                <option value="">未分类</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>支付方式</label>
              <select
                className={inputClass}
                value={form.paymentMethod}
                onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}
              >
                {PAYMENT_METHODS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-[1fr_90px] gap-3">
              <div>
                <label className={labelClass}>金额 *</label>
                <input
                  className={inputClass}
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                />
              </div>
              <div>
                <label className={labelClass}>币种</label>
                <select
                  className={inputClass}
                  value={form.currency}
                  onChange={(e) => setForm({ ...form, currency: e.target.value })}
                >
                  {CURRENCIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className={labelClass}>周期</label>
              <select
                className={inputClass}
                value={form.cycle}
                onChange={(e) => setForm({ ...form, cycle: e.target.value as Cycle })}
              >
                {CYCLE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            {form.cycle === 'custom' && (
              <div>
                <label className={labelClass}>周期天数</label>
                <input
                  className={inputClass}
                  type="number"
                  min="1"
                  max="365"
                  value={form.customDays}
                  onChange={(e) => setForm({ ...form, customDays: e.target.value })}
                />
              </div>
            )}
            <div>
              <label className={labelClass}>首次扣款日 *</label>
              <div className="flex gap-2">
                <input
                  className={inputClass}
                  type="date"
                  value={form.firstPaymentDate}
                  onChange={(e) => setForm({ ...form, firstPaymentDate: e.target.value })}
                />
                <button
                  type="button"
                  className="shrink-0 rounded-lg border border-slate-200 px-2 text-xs text-slate-500 transition hover:bg-slate-100"
                  onClick={() => setForm({ ...form, firstPaymentDate: today })}
                >
                  今天
                </button>
              </div>
            </div>
            <label className="col-span-2 flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={form.autoRenew}
                onChange={(e) => setForm({ ...form, autoRenew: e.target.checked })}
                className="h-4 w-4 accent-slate-900"
              />
              开通了自动续费
            </label>
          </div>

          {error && (
            <div className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600">{error}</div>
          )}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void dismiss()}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-500 transition hover:bg-slate-100 disabled:opacity-50"
            >
              忽略
            </button>
            <button
              type="submit"
              disabled={busy}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:opacity-50"
            >
              {busy ? '处理中…' : '确认入库'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
