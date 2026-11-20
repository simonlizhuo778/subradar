import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { api } from '@/lib/api';
import { formatDate, parseDateOnly } from '@/lib/format';
import type { Category, Cycle, Subscription, SubscriptionStatus } from '@/lib/types';

interface Props {
  open: boolean;
  /** null = 新建 */
  initial: Subscription | null;
  categories: Category[];
  onClose: () => void;
  onSaved: () => void;
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
  { value: 'card', label: '银行卡 / 卡组织' },
  { value: 'other', label: '其他' },
];

const inputClass =
  'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-slate-900';
const labelClass = 'mb-1 block text-xs font-medium text-slate-600';

export function SubscriptionForm({ open, initial, categories, onClose, onSaved }: Props) {
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('CNY');
  const [cycle, setCycle] = useState<Cycle>('monthly');
  const [customDays, setCustomDays] = useState('90');
  const [firstPaymentDate, setFirstPaymentDate] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [autoRenew, setAutoRenew] = useState(true);
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<SubscriptionStatus>('active');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // 打开时按 initial 重置表单
  useEffect(() => {
    if (!open) return;
    if (initial) {
      setName(initial.name);
      setCategoryId(initial.categoryId ? String(initial.categoryId) : '');
      setAmount(String(initial.amount));
      setCurrency(initial.currency);
      setCycle(initial.cycle);
      setCustomDays(String(initial.customDays ?? 90));
      setFirstPaymentDate(formatDate(initial.firstPaymentDate));
      setPaymentMethod(initial.paymentMethod ?? '');
      setAutoRenew(initial.autoRenew);
      setNotes(initial.notes ?? '');
      setStatus(initial.status);
    } else {
      setName('');
      setCategoryId('');
      setAmount('');
      setCurrency('CNY');
      setCycle('monthly');
      setCustomDays('90');
      setFirstPaymentDate('');
      setPaymentMethod('');
      setAutoRenew(true);
      setNotes('');
      setStatus('active');
    }
    setError(null);
  }, [open, initial]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('请填写订阅名称');
      return;
    }
    if (amount === '' || Number.isNaN(Number(amount)) || Number(amount) < 0) {
      setError('请填写正确的金额');
      return;
    }
    if (cycle === 'custom' && (!customDays || Number(customDays) < 1 || Number(customDays) > 365)) {
      setError('自定义周期天数应为 1-365');
      return;
    }
    if (!firstPaymentDate) {
      setError('请选择首次扣款日');
      return;
    }

    const body: Record<string, unknown> = {
      name: name.trim(),
      categoryId: categoryId ? Number(categoryId) : undefined,
      amount: Number(amount),
      currency,
      cycle,
      customDays: cycle === 'custom' ? Number(customDays) : undefined,
      firstPaymentDate: parseDateOnly(firstPaymentDate).toISOString(),
      paymentMethod: paymentMethod || undefined,
      autoRenew,
      notes: notes.trim() || undefined,
    };

    setSubmitting(true);
    try {
      if (initial) {
        await api(`/subscriptions/${initial.id}`, { method: 'PATCH', body: { ...body, status } });
      } else {
        await api('/subscriptions', { method: 'POST', body: { ...body, status } });
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败');
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 sm:items-center">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-lg space-y-4 rounded-xl bg-white p-6 shadow-xl"
      >
        <h2 className="text-lg font-bold text-slate-900">
          {initial ? '编辑订阅' : '新建订阅'}
        </h2>

        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className={labelClass} htmlFor="sub-name">
              名称 *
            </label>
            <input
              id="sub-name"
              className={inputClass}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="如:腾讯视频 VIP"
              maxLength={60}
            />
          </div>

          <div>
            <label className={labelClass} htmlFor="sub-category">
              分类
            </label>
            <select
              id="sub-category"
              className={inputClass}
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
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
            <label className={labelClass} htmlFor="sub-payment">
              支付方式
            </label>
            <select
              id="sub-payment"
              className={inputClass}
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
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
              <label className={labelClass} htmlFor="sub-amount">
                单次金额 *
              </label>
              <input
                id="sub-amount"
                className={inputClass}
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="30"
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="sub-currency">
                币种
              </label>
              <select
                id="sub-currency"
                className={inputClass}
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
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
            <label className={labelClass} htmlFor="sub-cycle">
              周期
            </label>
            <select
              id="sub-cycle"
              className={inputClass}
              value={cycle}
              onChange={(e) => setCycle(e.target.value as Cycle)}
            >
              {CYCLE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          {cycle === 'custom' && (
            <div>
              <label className={labelClass} htmlFor="sub-custom-days">
                周期天数(1-365)
              </label>
              <input
                id="sub-custom-days"
                className={inputClass}
                type="number"
                min="1"
                max="365"
                value={customDays}
                onChange={(e) => setCustomDays(e.target.value)}
              />
            </div>
          )}

          <div>
            <label className={labelClass} htmlFor="sub-first-date">
              首次扣款日 *
            </label>
            <input
              id="sub-first-date"
              className={inputClass}
              type="date"
              value={firstPaymentDate}
              onChange={(e) => setFirstPaymentDate(e.target.value)}
            />
          </div>

          <div>
            <label className={labelClass} htmlFor="sub-status">
              状态
            </label>
            <select
              id="sub-status"
              className={inputClass}
              value={status}
              onChange={(e) => setStatus(e.target.value as SubscriptionStatus)}
            >
              <option value="active">生效</option>
              <option value="trial">试用</option>
              {initial && <option value="paused">暂停</option>}
              {initial && <option value="cancelled">已取消</option>}
            </select>
          </div>

          <div className="col-span-2">
            <label className={labelClass} htmlFor="sub-notes">
              备注
            </label>
            <textarea
              id="sub-notes"
              className={inputClass}
              rows={2}
              maxLength={200}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="如:年付优惠到 2027-01"
            />
          </div>

          <label className="col-span-2 flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={autoRenew}
              onChange={(e) => setAutoRenew(e.target.checked)}
              className="h-4 w-4 accent-slate-900"
            />
            开通了自动续费(到期前重点提醒)
          </label>
        </div>

        {error && (
          <div className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600">{error}</div>
        )}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 transition hover:bg-slate-100"
          >
            取消
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:opacity-50"
          >
            {submitting ? '保存中…' : '保存'}
          </button>
        </div>
      </form>
    </div>
  );
}
