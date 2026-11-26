import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2, ChevronDown, FileSpreadsheet, Upload } from 'lucide-react';
import { api, getToken } from '@/lib/api';
import { formatDate, money } from '@/lib/format';
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  PageHeader,
  Segmented,
  Skeleton,
  cx,
} from '@/components/ui';
import type {
  BillImportDetail,
  BillImportRecord,
  BillImportResult,
  BillTransactionRow,
} from '@/lib/types';

const SOURCES = [
  { value: 'alipay', label: '支付宝账单' },
  { value: 'wechat', label: '微信账单' },
];

const SOURCE_LABEL: Record<string, string> = {
  alipay: '支付宝',
  wechat: '微信',
  other: '其他',
};

export function Bills() {
  const [source, setSource] = useState('alipay');
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<BillImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<BillImportRecord[] | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [detail, setDetail] = useState<BillImportDetail | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function loadHistory() {
    try {
      setHistory(await api<BillImportRecord[]>('/import/bills'));
    } catch {
      setHistory([]);
    }
  }

  useEffect(() => {
    void loadHistory();
  }, []);

  async function upload(file: File) {
    setError(null);
    setResult(null);
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const token = getToken();
      const res = await fetch(`/api/import/bills?source=${source}`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: form,
      });
      const data = (await res.json().catch(() => null)) as BillImportResult | { message?: string } | null;
      if (!res.ok) {
        throw new Error(
          (data as { message?: string } | null)?.message ?? `导入失败(HTTP ${res.status})`,
        );
      }
      setResult(data as BillImportResult);
      await loadHistory();
    } catch (e) {
      setError(e instanceof Error ? e.message : '导入失败');
    } finally {
      setUploading(false);
      if (fileRef.current) {
        fileRef.current.value = '';
      }
    }
  }

  async function toggleExpand(id: number) {
    if (expanded === id) {
      setExpanded(null);
      setDetail(null);
      return;
    }
    setExpanded(id);
    setDetail(null);
    try {
      setDetail(await api<BillImportDetail>(`/import/bills/${id}`));
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载明细失败');
    }
  }

  return (
    <div className="animate-fade-up space-y-6">
      <PageHeader
        title="账单导入"
        description="导出支付宝/微信账单 CSV,自动识别周期性扣款 —— 把你自己都忘了的订阅找出来。"
      />

      <Card className="p-5">
        <Segmented fluid className="mb-4" options={SOURCES} value={source} onChange={setSource} />

        <div className="flex flex-wrap items-center gap-3">
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            disabled={uploading}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void upload(file);
            }}
            className="hidden"
          />
          <Button
            variant="secondary"
            loading={uploading}
            onClick={() => fileRef.current?.click()}
          >
            {!uploading && <Upload className="h-4 w-4 text-slate-400" aria-hidden />}
            {uploading ? '解析与识别中…' : '选择账单 CSV 文件'}
          </Button>
          <span className="text-xs text-slate-400">
            当前来源:{SOURCE_LABEL[source] ?? source}
          </span>
        </div>

        <p className="mt-3 text-xs leading-5 text-slate-400">
          导出方法:支付宝网页版「账单」→ 导出 CSV(默认 GBK,自动识别);
          微信「我 → 服务 → 钱包 → 账单 → 常见问题 → 下载账单(用于个人对账)」。
          识别结果进入待确认队列,不会直接入库。
        </p>

        {error && <Alert tone="error" className="mt-3">{error}</Alert>}

        {result && (
          <div className="mt-4 space-y-3 rounded-xl border border-emerald-100 bg-emerald-50/60 p-4">
            <p className="flex items-start gap-2 text-sm font-medium text-emerald-800">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
              {result.message}
            </p>
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              {[
                { label: '数据行', value: result.import.totalRows },
                { label: '有效支出', value: result.import.validRows },
                { label: '解析失败', value: result.failed.count },
                { label: '疑似订阅', value: result.candidates.length },
              ].map((stat) => (
                <div key={stat.label}>
                  <div className="text-lg font-semibold text-emerald-800">{stat.value}</div>
                  <div className="text-xs text-emerald-600/80">{stat.label}</div>
                </div>
              ))}
            </div>
            {result.failed.samples.length > 0 && (
              <details className="text-xs text-emerald-700">
                <summary className="cursor-pointer">失败行明细(前 5 条)</summary>
                <ul className="mt-1 space-y-0.5">
                  {result.failed.samples.map((f) => (
                    <li key={f.line}>
                      第 {f.line} 行:{f.reason}
                    </li>
                  ))}
                </ul>
              </details>
            )}
            <Link to="/ai" className="inline-block">
              <Button size="sm">
                去待确认队列处理({result.candidates.length} 条)
                <ArrowRight className="h-3.5 w-3.5" aria-hidden />
              </Button>
            </Link>
          </div>
        )}
      </Card>

      <div className="space-y-3">
        <h2 className="text-[15px] font-semibold text-slate-900">导入历史</h2>
        {history === null && (
          <div className="space-y-3">
            {Array.from({ length: 2 }).map((_, i) => (
              <Card key={i} className="p-4">
                <Skeleton className="h-5 w-1/2" />
              </Card>
            ))}
          </div>
        )}
        {history?.length === 0 && (
          <Card>
            <EmptyState
              icon={FileSpreadsheet}
              title="还没有导入过账单"
              description="导入一份支付宝或微信账单 CSV,自动发现周期性扣款。"
            />
          </Card>
        )}
        {history?.map((record) => (
          <Card key={record.id} className="overflow-hidden">
            <button
              type="button"
              onClick={() => void toggleExpand(record.id)}
              className="flex w-full flex-wrap items-center gap-3 px-4 py-3.5 text-left transition-colors duration-150 hover:bg-slate-50"
            >
              <Badge tone="neutral">{SOURCE_LABEL[record.source] ?? record.source}</Badge>
              <span className="min-w-0 truncate text-sm font-medium text-slate-800">
                {record.filename}
              </span>
              <span className="text-xs text-slate-400">
                {formatDate(record.createdAt)} · 有效 {record.validRows}/{record.totalRows} 行
              </span>
              <ChevronDown
                className={cx(
                  'ml-auto h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200',
                  expanded === record.id && 'rotate-180',
                )}
                aria-hidden
              />
            </button>
            {expanded === record.id && (
              <div className="animate-fade-in border-t border-slate-900/6 p-4">
                {!detail && (
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-5/6" />
                    <Skeleton className="h-4 w-2/3" />
                  </div>
                )}
                {detail && (
                  <>
                    {detail.candidates.length > 0 && (
                      <p className="mb-2 text-xs text-slate-500">
                        本次识别出 {detail.candidates.length} 个疑似订阅
                      </p>
                    )}
                    <TransactionsTable transactions={detail.transactions} />
                  </>
                )}
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}

function TransactionsTable({ transactions }: { transactions: BillTransactionRow[] }) {
  if (transactions.length === 0) {
    return <p className="py-2 text-sm text-slate-400">无流水记录。</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] text-sm">
        <thead>
          <tr className="border-b border-slate-900/6 text-left text-xs text-slate-400">
            <th className="py-2 pr-4 font-medium">日期</th>
            <th className="py-2 pr-4 font-medium">交易对方</th>
            <th className="py-2 pr-4 font-medium">商品说明</th>
            <th className="py-2 text-right font-medium">金额</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-900/4">
          {transactions.map((t) => (
            <tr key={t.id} className="transition-colors duration-150 hover:bg-slate-50/70">
              <td className="py-2.5 pr-4 text-slate-600">{formatDate(t.occurredAt)}</td>
              <td className="py-2.5 pr-4 text-slate-700">{t.merchant}</td>
              <td className="py-2.5 pr-4 text-slate-400">{t.memo ?? '—'}</td>
              <td className="py-2.5 text-right font-medium text-slate-900">
                {money(t.amount, 'CNY')}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}