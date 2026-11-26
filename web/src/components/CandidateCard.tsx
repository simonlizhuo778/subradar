import { useState } from 'react';
import type { FormEvent } from 'react';
import { Check, ChevronDown, X } from 'lucide-react';
import { api } from '@/lib/api';
import { formatDate, parseDateOnly } from '@/lib/format';
import {
  Alert,
  Badge,
  Button,
  Card,
  Checkbox,
  Field,
  Input,
  Select,
  cx,
} from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
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
  const toast = useToast();
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
      toast.success(`「${form.name.trim()}」已入库,扣款历史已回填`);
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
      toast.info('已忽略该候选订阅');
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作失败');
    } finally {
      setBusy(false);
    }
  }

  const today = formatDate(new Date());

  return (
    <Card className="overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full flex-wrap items-center gap-3 px-4 py-3.5 text-left transition-colors duration-150 hover:bg-slate-50"
      >
        <Badge tone="neutral">{sourceLabel(candidate.source)}</Badge>
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
              className={cx('h-full rounded-full transition-all duration-300', confidenceClass(candidate.confidence))}
              style={{ width: `${Math.max(6, candidate.confidence * 100)}%` }}
            />
          </div>
          <ChevronDown
            className={cx('h-4 w-4 text-slate-400 transition-transform duration-200', open && 'rotate-180')}
            aria-hidden
          />
        </div>
      </button>

      {candidate.extracted.evidence && !open && (
        <p className="px-4 pb-3 text-xs leading-5 text-slate-400">依据:{candidate.extracted.evidence}</p>
      )}

      {open && (
        <form onSubmit={confirm} className="animate-fade-in space-y-3 border-t border-slate-900/6 p-4">
          {candidate.extracted.evidence && (
            <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-500">
              模型依据:{candidate.extracted.evidence}
              {candidate.extracted.merchant && ` · 商户:${candidate.extracted.merchant}`}
            </p>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="名称 *" className="sm:col-span-2">
              <Input
                value={form.name}
                maxLength={60}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </Field>
            <Field label="分类">
              <Select
                value={form.categoryId}
                onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
              >
                <option value="">未分类</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="支付方式">
              <Select
                value={form.paymentMethod}
                onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}
              >
                {PAYMENT_METHODS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="grid grid-cols-[1fr_90px] gap-3">
              <Field label="金额 *">
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                />
              </Field>
              <Field label="币种">
                <Select
                  value={form.currency}
                  onChange={(e) => setForm({ ...form, currency: e.target.value })}
                >
                  {CURRENCIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <Field label="周期">
              <Select
                value={form.cycle}
                onChange={(e) => setForm({ ...form, cycle: e.target.value as Cycle })}
              >
                {CYCLE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </Field>
            {form.cycle === 'custom' && (
              <Field label="周期天数">
                <Input
                  type="number"
                  min="1"
                  max="365"
                  value={form.customDays}
                  onChange={(e) => setForm({ ...form, customDays: e.target.value })}
                />
              </Field>
            )}
            <Field label="首次扣款日 *">
              <div className="flex gap-2">
                <Input
                  type="date"
                  value={form.firstPaymentDate}
                  onChange={(e) => setForm({ ...form, firstPaymentDate: e.target.value })}
                />
                <Button
                  variant="secondary"
                  className="shrink-0"
                  onClick={() => setForm({ ...form, firstPaymentDate: today })}
                >
                  今天
                </Button>
              </div>
            </Field>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600 sm:col-span-2">
              <Checkbox
                checked={form.autoRenew}
                onChange={(e) => setForm({ ...form, autoRenew: e.target.checked })}
              />
              开通了自动续费
            </label>
          </div>

          {error && <Alert tone="error">{error}</Alert>}

          <div className="flex justify-end gap-2">
            <Button variant="ghost" disabled={busy} onClick={() => void dismiss()}>
              <X className="h-4 w-4" aria-hidden />
              忽略
            </Button>
            <Button type="submit" loading={busy}>
              {!busy && <Check className="h-4 w-4" aria-hidden />}
              {busy ? '处理中…' : '确认入库'}
            </Button>
          </div>
        </form>
      )}
    </Card>
  );
}