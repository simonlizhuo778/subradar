/**
 * 支付宝 / 微信账单 CSV 解析器。
 * 两种格式共用一套列名别名映射:支付宝用「商品说明/金额/交易状态」,
 * 微信用「商品/金额(元)/当前状态」。
 * 跳过导出文件头部的说明行与尾部的结束行;失败行逐条报告,不整体失败。
 */
import { parseCsvLine } from '../common/utils/csv';

export interface ParsedBillRow {
  occurredAt: Date;
  merchant: string;
  amount: number;
  direction: 'out';
  memo: string | null;
}

export interface BillParseResult {
  rows: ParsedBillRow[];
  failedRows: Array<{ line: number; reason: string }>;
  totalRows: number;
}

export class BillFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BillFormatError';
  }
}

/** 列名别名 → 逻辑字段 */
const COLUMN_ALIASES: Record<string, string[]> = {
  time: ['交易时间'],
  merchant: ['交易对方'],
  memo: ['商品说明', '商品'],
  direction: ['收/支'],
  amount: ['金额', '金额(元)'],
  status: ['交易状态', '当前状态'],
};

const STATUS_EXCLUDE = /退款|关闭|失败|等待|提现/;

export function parseBillCsv(text: string): BillParseResult {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/);

  // 1. 找表头行(含「交易时间」且含「金额」相关列)
  let headerIndex = -1;
  let headerCells: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const cells = parseCsvLine(lines[i]);
    if (cells.includes('交易时间') && cells.some((c) => c.startsWith('金额'))) {
      headerIndex = i;
      headerCells = cells;
      break;
    }
  }
  if (headerIndex === -1) {
    throw new BillFormatError(
      '未找到表头行(需要包含「交易时间」与「金额」列):请确认上传的是支付宝/微信导出的账单 CSV',
    );
  }

  const colMap: Record<string, number> = {};
  for (const [field, aliases] of Object.entries(COLUMN_ALIASES)) {
    for (const alias of aliases) {
      const idx = headerCells.indexOf(alias);
      if (idx >= 0) {
        colMap[field] = idx;
        break;
      }
    }
  }
  for (const required of ['time', 'merchant', 'direction', 'amount']) {
    if (colMap[required] === undefined) {
      throw new BillFormatError(`表头缺少必需列(${required}),识别到的表头:${headerCells.join('、')}`);
    }
  }

  // 2. 逐行解析
  const rows: ParsedBillRow[] = [];
  const failedRows: Array<{ line: number; reason: string }> = [];
  let totalRows = 0;

  for (let i = headerIndex + 1; i < lines.length; i++) {
    const raw = lines[i];
    if (!raw.trim()) continue;
    if (/^-{4,}/.test(raw) || raw.includes('结束') || raw.includes('已导出全部')) break;

    totalRows += 1;
    const line = i + 1;
    const cells = parseCsvLine(raw);

    if (cells.length < Math.max(...Object.values(colMap)) + 1) {
      failedRows.push({ line, reason: `列数不足(${cells.length} 列)` });
      continue;
    }

    const timeStr = cells[colMap.time] ?? '';
    const occurredAt = parseBillDate(timeStr);
    if (!occurredAt) {
      failedRows.push({ line, reason: `交易时间无法解析:"${timeStr}"` });
      continue;
    }

    const merchant = cells[colMap.merchant] ?? '';
    if (!merchant) {
      failedRows.push({ line, reason: '交易对方为空' });
      continue;
    }

    const amount = parseBillAmount(cells[colMap.amount] ?? '');
    if (amount === null) {
      failedRows.push({ line, reason: `金额无法解析:"${cells[colMap.amount] ?? ''}"` });
      continue;
    }

    const direction = cells[colMap.direction] ?? '';
    if (direction !== '支出') continue; // 收入 / 不计收支静默跳过
    const status = colMap.status !== undefined ? cells[colMap.status] ?? '' : '';
    if (STATUS_EXCLUDE.test(status)) continue; // 退款/关闭/失败等静默跳过

    const memo = colMap.memo !== undefined ? cells[colMap.memo] || null : null;
    rows.push({ occurredAt, merchant, amount, direction: 'out', memo });
  }

  return { rows, failedRows, totalRows };
}

/** 支持 2026-01-01 00:00:00 与 2026-01-01 两种格式,返回本地时区 Date */
export function parseBillDate(value: string): Date | null {
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?/.exec(value.trim());
  if (!m) return null;
  const date = new Date(
    Number(m[1]),
    Number(m[2]) - 1,
    Number(m[3]),
    Number(m[4] ?? 0),
    Number(m[5] ?? 0),
    Number(m[6] ?? 0),
  );
  return Number.isNaN(date.getTime()) ? null : date;
}

/** 金额解析:去 ¥/￥/逗号/空格 */
export function parseBillAmount(value: string): number | null {
  const cleaned = value.replace(/[¥￥,\s]/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const amount = Number(cleaned);
  return Number.isFinite(amount) && amount >= 0 ? amount : null;
}
