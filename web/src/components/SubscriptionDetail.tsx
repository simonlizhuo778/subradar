import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { CalendarClock, ReceiptText, X } from 'lucide-react';
import { api } from '@/lib/api';
import { cycleLabel, formatDate, money, relativeDue } from '@/lib/format';
import { parseDateOnly } from '@/lib/format';
import {
  Alert,
  Badge,
  Button,
  Field,
  IconButton,
  Input,
  Skeleton,
  StatusBadge,
} from '@/components/ui';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import type { SubscriptionDetail } from '@/lib/types';

interface Props {
  subscriptionId: number;
  onClose: () => void;
}

export function SubscriptionDetail({ subscriptionId, onClose }: Props) {
  const toast = useToast();
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
      toast.success('已补记一笔扣款');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : '补记失败');
    } finally {
      setAdding(false);
    }
  }

  return (
    <Modal open onClose={onClose}>
      <div className="p-6">
        {!detail && !error && (
          <div className="space-y-3">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-56" />
            <Skeleton className="h-12 w-full rounded-xl" />
            <Skeleton className="h-32 w-full rounded-xl" />
          </div>
        )}
        {error && !detail && <Alert tone="error">{error}</Alert>}
        {detail && (
          <>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="truncate text-lg font-semibold tracking-tight text-slate-900">
                  {detail.name}
                </h2>
                <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm">
                  <StatusBadge status={detail.status} />
                  <span className="font-medium text-slate-900">
                    {money(detail.amount, detail.currency)}
                  </span>
                  <span className="text-slate-400">/ {cycleLabel(detail.cycle, detail.customDays)}</span>
                  <span className="text-slate-400">{detail.category?.name ?? '未分类'}</span>
                </div>
              </div>
              <IconButton onClick={onClose} aria-label="关闭">
                <X className="h-4 w-4" aria-hidden />
              </IconButton>
            </div>

            {detail.status === 'active' || detail.status === 'trial' ? (
              <div className="mt-4 flex items-center gap-2.5 rounded-xl border border-accent-100 bg-accent-50/60 px-3.5 py-2.5 text-sm">
                <CalendarClock className="h-4 w-4 shrink-0 text-accent-600" aria-hidden />
                <span className="text-slate-700">下次扣款:{formatDate(detail.nextPaymentDate)}</span>
                <Badge tone="danger" className="ml-auto">
                  {relativeDue(detail.nextPaymentDate)}
                </Badge>
              </div>
            ) : null}

            <div className="mt-5">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <ReceiptText className="h-4 w-4 text-slate-400" aria-hidden />
                扣款历史({detail.payments.length} 笔)
              </h3>
              <ul className="mt-2 max-h-56 divide-y divide-slate-900/5 overflow-y-auto">
                {detail.payments.map((payment) => (
                  <li key={payment.id} className="flex items-center justify-between py-2.5 text-sm">
                    <span className="text-slate-600">{formatDate(payment.paidAt)}</span>
                    <span className="flex items-center gap-2">
                      {payment.source !== 'manual' && (
                        <Badge tone="neutral" className="px-1.5 text-[10px]">
                          {payment.source === 'auto'
                            ? '自动'
                            : payment.source === 'candidate'
                              ? 'AI/账单'
                              : '导入'}
                        </Badge>
                      )}
                      <span className="font-medium text-slate-900">
                        {money(payment.amount, payment.currency)}
                      </span>
                    </span>
                  </li>
                ))}
                {detail.payments.length === 0 && (
                  <li className="py-4 text-center text-sm text-slate-400">还没有扣款记录</li>
                )}
              </ul>
            </div>

            <form onSubmit={addPayment} className="mt-5 border-t border-slate-900/6 pt-4">
              <div className="flex flex-wrap items-end gap-2">
                <Field label="补记日期" htmlFor="pay-date" className="min-w-36 flex-1">
                  <Input
                    id="pay-date"
                    type="date"
                    value={paidAt}
                    onChange={(e) => setPaidAt(e.target.value)}
                  />
                </Field>
                <Field label="金额" htmlFor="pay-amount" className="w-28">
                  <Input
                    id="pay-amount"
                    type="number"
                    min="0"
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </Field>
                <Button type="submit" loading={adding}>
                  {adding ? '保存中…' : '补记一笔'}
                </Button>
              </div>
              {error && <Alert tone="error" className="mt-3">{error}</Alert>}
            </form>
          </>
        )}
      </div>
    </Modal>
  );
}