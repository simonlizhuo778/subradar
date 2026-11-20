import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, getToken } from '@/lib/api';
import { formatDate, money } from '@/lib/format';
import type {
  BillImportDetail,
  BillImportRecord,
  BillImportResult,
  BillTransactionRow,
} from '@/lib/types';

const SOURCES = [
  { key: 'alipay', label: '支付宝账单' },
  { key: 'wechat', label: '微信账单' },
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
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">账单导入</h1>
        <p className="mt-1 text-sm text-slate-500">
          导出支付宝/微信账单 CSV,自动识别周期性扣款 —— 把你自己都忘了的订阅找出来。
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="mb-4 flex rounded-lg border border-slate-200 p-0.5">
          {SOURCES.map((s) => (
            <button
              key={s.key}
              onClick={() => setSource(s.key)}
              className={`flex-1 rounded-md px-3 py-1.5 text-sm transition ${
                source === s.key ? 'bg-slate-900 font-medium text-white' : 'text-slate-600'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

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
            className="text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-900 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-slate-700"
          />
          {uploading && <span className="text-sm text-slate-400">解析与识别中…</span>}
        </div>

        <p className="mt-3 text-xs leading-5 text-slate-400">
          导出方法:支付宝网页版「账单」→ 导出 CSV(默认 GBK,自动识别);
          微信「我 → 服务 → 钱包 → 账单 → 常见问题 → 下载账单(用于个人对账)」。
          识别结果进入待确认队列,不会直接入库。
        </p>

        {error && (
          <div className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600">{error}</div>
        )}

        {result && (
          <div className="mt-4 space-y-3 rounded-lg border border-emerald-200 bg-emerald-50/60 p-4">
            <p className="text-sm font-medium text-emerald-800">{result.message}</p>
            <div className="flex flex-wrap gap-4 text-sm text-emerald-700">
              <span>数据行 {result.import.totalRows}</span>
              <span>有效支出 {result.import.validRows}</span>
              <span>解析失败 {result.failed.count}</span>
              <span>疑似订阅 {result.candidates.length}</span>
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
            <Link
              to="/ai"
              className="inline-block rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
            >
              去待确认队列处理({result.candidates.length} 条)→
            </Link>
          </div>
        )}
      </div>

      <div className="space-y-3">
        <h2 className="font-semibold text-slate-900">导入历史</h2>
        {history === null && <p className="text-sm text-slate-400">加载中…</p>}
        {history?.length === 0 && (
          <p className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-400">
            还没有导入过账单。
          </p>
        )}
        {history?.map((record) => (
          <div key={record.id} className="rounded-xl border border-slate-200 bg-white">
            <button
              onClick={() => void toggleExpand(record.id)}
              className="flex w-full flex-wrap items-center gap-3 px-4 py-3 text-left transition hover:bg-slate-50"
            >
              <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                {SOURCE_LABEL[record.source] ?? record.source}
              </span>
              <span className="text-sm text-slate-700">{record.filename}</span>
              <span className="text-xs text-slate-400">
                {formatDate(record.createdAt)} · 有效 {record.validRows}/{record.totalRows} 行
              </span>
              <span className="ml-auto text-xs text-slate-300">
                {expanded === record.id ? '收起 ▲' : '明细 ▼'}
              </span>
            </button>
            {expanded === record.id && (
              <div className="border-t border-slate-100 p-4">
                {!detail && <p className="text-sm text-slate-400">加载中…</p>}
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
          </div>
        ))}
      </div>
    </div>
  );
}

function TransactionsTable({ transactions }: { transactions: BillTransactionRow[] }) {
  if (transactions.length === 0) {
    return <p className="text-sm text-slate-400">无流水记录。</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] text-sm">
        <thead>
          <tr className="border-b border-slate-100 text-left text-xs text-slate-400">
            <th className="py-2 pr-4 font-medium">日期</th>
            <th className="py-2 pr-4 font-medium">交易对方</th>
            <th className="py-2 pr-4 font-medium">商品说明</th>
            <th className="py-2 text-right font-medium">金额</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {transactions.map((t) => (
            <tr key={t.id}>
              <td className="py-2 pr-4 text-slate-600">{formatDate(t.occurredAt)}</td>
              <td className="py-2 pr-4 text-slate-700">{t.merchant}</td>
              <td className="py-2 pr-4 text-slate-400">{t.memo ?? '—'}</td>
              <td className="py-2 text-right font-medium text-slate-900">
                {money(t.amount, 'CNY')}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
