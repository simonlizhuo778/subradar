import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { X } from 'lucide-react';
import { api } from '@/lib/api';
import { formatDate, parseDateOnly } from '@/lib/format';
import { Alert, Button, Checkbox, Field, IconButton, Input, Select, Textarea } from '@/components/ui';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
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

export function SubscriptionForm({ open, initial, categories, onClose, onSaved }: Props) {
  const toast = useToast();
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
      toast.success(initial ? `已保存「${name.trim()}」的修改` : `已创建「${name.trim()}」`);
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-4 p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold tracking-tight text-slate-900">
            {initial ? '编辑订阅' : '新建订阅'}
          </h2>
          <IconButton onClick={onClose} aria-label="关闭">
            <X className="h-4 w-4" aria-hidden />
          </IconButton>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="名称 *" htmlFor="sub-name" className="sm:col-span-2">
            <Input
              id="sub-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="如:腾讯视频 VIP"
              maxLength={60}
            />
          </Field>

          <Field label="分类" htmlFor="sub-category">
            <Select
              id="sub-category"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
            >
              <option value="">未分类</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="支付方式" htmlFor="sub-payment">
            <Select
              id="sub-payment"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
            >
              {PAYMENT_METHODS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </Select>
          </Field>

          <div className="grid grid-cols-[1fr_90px] gap-3">
            <Field label="单次金额 *" htmlFor="sub-amount">
              <Input
                id="sub-amount"
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="30"
              />
            </Field>
            <Field label="币种" htmlFor="sub-currency">
              <Select
                id="sub-currency"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
              >
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <Field label="周期" htmlFor="sub-cycle">
            <Select id="sub-cycle" value={cycle} onChange={(e) => setCycle(e.target.value as Cycle)}>
              {CYCLE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </Field>

          {cycle === 'custom' && (
            <Field label="周期天数(1-365)" htmlFor="sub-custom-days">
              <Input
                id="sub-custom-days"
                type="number"
                min="1"
                max="365"
                value={customDays}
                onChange={(e) => setCustomDays(e.target.value)}
              />
            </Field>
          )}

          <Field label="首次扣款日 *" htmlFor="sub-first-date">
            <Input
              id="sub-first-date"
              type="date"
              value={firstPaymentDate}
              onChange={(e) => setFirstPaymentDate(e.target.value)}
            />
          </Field>

          <Field label="状态" htmlFor="sub-status">
            <Select
              id="sub-status"
              value={status}
              onChange={(e) => setStatus(e.target.value as SubscriptionStatus)}
            >
              <option value="active">生效</option>
              <option value="trial">试用</option>
              {initial && <option value="paused">暂停</option>}
              {initial && <option value="cancelled">已取消</option>}
            </Select>
          </Field>

          <Field label="备注" htmlFor="sub-notes" className="sm:col-span-2">
            <Textarea
              id="sub-notes"
              rows={2}
              maxLength={200}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="如:年付优惠到 2027-01"
            />
          </Field>

          <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600 sm:col-span-2">
            <Checkbox
              checked={autoRenew}
              onChange={(e) => setAutoRenew(e.target.checked)}
            />
            开通了自动续费(到期前重点提醒)
          </label>
        </div>

        {error && <Alert tone="error">{error}</Alert>}

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="secondary" onClick={onClose}>
            取消
          </Button>
          <Button type="submit" loading={submitting}>
            {submitting ? '保存中…' : '保存'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}