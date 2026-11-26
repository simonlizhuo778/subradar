import { useCallback, useEffect, useState } from 'react';
import {
  Eye,
  PackageSearch,
  Pause,
  Pencil,
  Play,
  Plus,
  Search,
  SearchX,
  Trash2,
} from 'lucide-react';
import { api } from '@/lib/api';
import { SubscriptionForm } from '@/components/SubscriptionForm';
import { SubscriptionDetail } from '@/components/SubscriptionDetail';
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  IconButton,
  Input,
  PageHeader,
  Segmented,
  Skeleton,
  StatusBadge,
} from '@/components/ui';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';
import { cycleLabel, daysUntil, formatDate, money, relativeDue } from '@/lib/format';
import type { Category, Subscription, SubscriptionStatus } from '@/lib/types';

const TABS: Array<{ value: 'all' | SubscriptionStatus; label: string }> = [
  { value: 'all', label: '全部' },
  { value: 'active', label: '生效' },
  { value: 'paused', label: '暂停' },
  { value: 'cancelled', label: '已取消' },
];

interface RowActionsProps {
  sub: Subscription;
  busy: boolean;
  onDetail: () => void;
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
}

/** 行操作:桌面 hover 显现,触屏常显 */
function RowActions({ sub, busy, onDetail, onEdit, onToggle, onDelete }: RowActionsProps) {
  const toggleable = sub.status === 'active' || sub.status === 'trial' || sub.status === 'paused';
  return (
    <div className="flex justify-end gap-0.5 transition-opacity duration-150 md:opacity-0 md:focus-within:opacity-100 md:group-hover:opacity-100">
      <IconButton title="详情" aria-label={`查看 ${sub.name} 详情`} disabled={busy} onClick={onDetail}>
        <Eye className="h-4 w-4" aria-hidden />
      </IconButton>
      <IconButton title="编辑" aria-label={`编辑 ${sub.name}`} disabled={busy} onClick={onEdit}>
        <Pencil className="h-4 w-4" aria-hidden />
      </IconButton>
      {toggleable && (
        <IconButton
          title={sub.status === 'paused' ? '恢复' : '暂停'}
          aria-label={sub.status === 'paused' ? `恢复 ${sub.name}` : `暂停 ${sub.name}`}
          disabled={busy}
          onClick={onToggle}
          className={
            sub.status === 'paused'
              ? 'text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700'
              : 'text-amber-600 hover:bg-amber-50 hover:text-amber-700'
          }
        >
          {sub.status === 'paused' ? <Play className="h-4 w-4" aria-hidden /> : <Pause className="h-4 w-4" aria-hidden />}
        </IconButton>
      )}
      <IconButton title="删除" aria-label={`删除 ${sub.name}`} tone="danger" disabled={busy} onClick={onDelete}>
        <Trash2 className="h-4 w-4" aria-hidden />
      </IconButton>
    </div>
  );
}

function DueCell({ sub }: { sub: Subscription }) {
  if (sub.status !== 'active' && sub.status !== 'trial') {
    return <span className="text-slate-300">—</span>;
  }
  const urgent = daysUntil(sub.nextPaymentDate) <= 7;
  return (
    <div>
      <div className="text-sm text-slate-700">{formatDate(sub.nextPaymentDate)}</div>
      <div className={`text-xs ${urgent ? 'text-rose-500' : 'text-slate-400'}`}>
        {relativeDue(sub.nextPaymentDate)}
      </div>
    </div>
  );
}

export function Subscriptions() {
  const toast = useToast();
  const [items, setItems] = useState<Subscription[] | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [tab, setTab] = useState<'all' | SubscriptionStatus>('all');
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Subscription | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [detailId, setDetailId] = useState<number | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Subscription | null>(null);

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
      toast.success(status === 'paused' ? `已暂停「${sub.name}」` : `已恢复「${sub.name}」`);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '操作失败');
    } finally {
      setBusyId(null);
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    const sub = pendingDelete;
    setBusyId(sub.id);
    try {
      await api(`/subscriptions/${sub.id}`, { method: 'DELETE' });
      toast.success(`已删除「${sub.name}」`);
      setPendingDelete(null);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '删除失败');
    } finally {
      setBusyId(null);
    }
  }

  const filtered = q !== '' || tab !== 'all';
  const rowActions = (sub: Subscription): RowActionsProps => ({
    sub,
    busy: busyId === sub.id,
    onDetail: () => setDetailId(sub.id),
    onEdit: () => {
      setEditing(sub);
      setFormOpen(true);
    },
    onToggle: () => void patchStatus(sub, sub.status === 'paused' ? 'active' : 'paused'),
    onDelete: () => setPendingDelete(sub),
  });

  return (
    <div className="animate-fade-up space-y-4">
      <PageHeader
        title="订阅管理"
        description={items ? `${items.length} 条记录` : '…'}
        actions={
          <Button
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus className="h-4 w-4" aria-hidden />
            新建订阅
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <Segmented options={TABS} value={tab} onChange={setTab} />
        <div className="relative w-full sm:w-64">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            aria-hidden
          />
          <Input
            className="pl-9"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="搜索名称…"
            aria-label="搜索订阅"
          />
        </div>
      </div>

      {error && <Alert tone="error">{error}</Alert>}

      {items === null ? (
        <Card className="p-4">
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="h-4 w-4 rounded-full" />
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="hidden h-4 w-24 sm:block" />
                <Skeleton className="hidden h-4 w-20 sm:block" />
                <Skeleton className="h-5 w-14 rounded-full" />
              </div>
            ))}
          </div>
        </Card>
      ) : items.length === 0 ? (
        <Card>
          <EmptyState
            icon={filtered ? SearchX : PackageSearch}
            title={filtered ? '没有符合条件的订阅' : '还没有订阅'}
            description={filtered ? '换个关键词或筛选条件试试。' : '新建一个订阅,或从账单导入自动发现。'}
            action={
              filtered ? (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setQ('');
                    setTab('all');
                  }}
                >
                  清除筛选
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={() => {
                    setEditing(null);
                    setFormOpen(true);
                  }}
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden />
                  新建订阅
                </Button>
              )
            }
          />
        </Card>
      ) : (
        <>
          {/* 桌面表格 */}
          <Card className="hidden overflow-hidden md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-900/6 text-left text-xs text-slate-400">
                  <th className="px-5 py-3 font-medium">订阅</th>
                  <th className="px-5 py-3 text-right font-medium">周期 / 金额</th>
                  <th className="px-5 py-3 font-medium">下次扣款</th>
                  <th className="px-5 py-3 font-medium">状态</th>
                  <th className="px-5 py-3 text-right font-medium">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-900/4">
                {items.map((sub) => (
                  <tr key={sub.id} className="group transition-colors duration-150 hover:bg-slate-50/70">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <span
                          className="h-2 w-2 shrink-0 rounded-full"
                          style={{ backgroundColor: sub.category?.color ?? '#cbd5e1' }}
                        />
                        <span className="font-medium text-slate-900">{sub.name}</span>
                        {sub.autoRenew && (
                          <Badge tone="danger" className="px-1.5 text-[10px]">
                            自动续费
                          </Badge>
                        )}
                        <span className="text-xs text-slate-400">{sub.category?.name ?? '未分类'}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <span className="font-medium text-slate-900">{money(sub.amount, sub.currency)}</span>
                      <span className="ml-1 text-xs text-slate-400">/ {cycleLabel(sub.cycle, sub.customDays)}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <DueCell sub={sub} />
                    </td>
                    <td className="px-5 py-3.5">
                      <StatusBadge status={sub.status} />
                    </td>
                    <td className="px-5 py-3.5">
                      <RowActions {...rowActions(sub)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          {/* 移动端卡片 */}
          <div className="space-y-3 md:hidden">
            {items.map((sub) => (
              <Card key={sub.id} className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: sub.category?.color ?? '#cbd5e1' }}
                      />
                      <span className="truncate text-sm font-medium text-slate-900">{sub.name}</span>
                      {sub.autoRenew && (
                        <Badge tone="danger" className="px-1.5 text-[10px]">
                          自动续费
                        </Badge>
                      )}
                    </div>
                    <div className="mt-1 text-xs text-slate-400">
                      {sub.category?.name ?? '未分类'} · {cycleLabel(sub.cycle, sub.customDays)}
                    </div>
                  </div>
                  <StatusBadge status={sub.status} className="shrink-0" />
                </div>
                <div className="mt-3 flex items-end justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-base font-semibold text-slate-900">
                      {money(sub.amount, sub.currency)}
                    </div>
                    <div className="mt-0.5 text-xs text-slate-400">
                      {sub.status === 'active' || sub.status === 'trial'
                        ? `${formatDate(sub.nextPaymentDate)} · ${relativeDue(sub.nextPaymentDate)}`
                        : '无待扣款'}
                    </div>
                  </div>
                  <RowActions {...rowActions(sub)} />
                </div>
              </Card>
            ))}
          </div>
        </>
      )}

      <SubscriptionForm
        open={formOpen}
        initial={editing}
        categories={categories}
        onClose={() => setFormOpen(false)}
        onSaved={() => void load()}
      />

      {detailId !== null && (
        <SubscriptionDetail subscriptionId={detailId} onClose={() => setDetailId(null)} />
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        title={`删除「${pendingDelete?.name ?? ''}」?`}
        description="扣款历史会一并删除,此操作不可撤销。"
        confirmLabel="删除"
        loading={busyId === pendingDelete?.id}
        onConfirm={() => void confirmDelete()}
        onClose={() => setPendingDelete(null)}
      />
    </div>
  );
}