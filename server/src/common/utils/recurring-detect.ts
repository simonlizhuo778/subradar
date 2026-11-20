/**
 * 周期性扣款识别算法 —— 「从真实账单里发现你忘了的订阅」的核心。
 *
 * 思路(与《需求文档》4.6 节一致):
 * 1. 按商户名归一化分组;
 * 2. 组内按金额 ±5% 聚类(同一商户涨价会拆成两条序列,宁可漏报不误报);
 * 3. 每条序列(n ≥ 3 笔)做间隔规律性检验:间隔中位数 p,
 *    所有间隔与 p 的偏差 ≤ max(2 天, p×15%);
 * 4. 周期映射:p∈[26,35]→月付(容忍 28~31 天漂移)、[80,100]→季付、
 *    [350,380]→年付、[6.5,7.5]→周付(降权)、其余→自定义天数(降权);
 *    p < 6 天的高频消费(外卖/打车/咖啡)直接忽略;
 * 5. 置信度随笔数提升、随周期类型非常规而降权 —— 结果进待确认队列,人做最终裁决。
 *
 * 外卖/打车为什么天然不误报:金额不稳 → 被 ±5% 聚类拆碎(单簇不足 3 笔);
 * 间隔不稳 → 过不了规律性检验;p < 6 的直接忽略。
 */

export interface DetectTransaction {
  occurredAt: Date;
  merchant: string;
  amount: number;
}

export type DetectedCycle = 'monthly' | 'quarterly' | 'yearly' | 'weekly' | 'custom';

export interface DetectedSeries {
  /** 归一化后的商户 key */
  merchant: string;
  /** 建议展示名(去掉公司后缀) */
  displayName: string;
  /** 代表金额(中位数) */
  amount: number;
  cycle: DetectedCycle;
  /** cycle=custom 时的天数 */
  cycleDays: number | null;
  /** 首次扣款日 YYYY-MM-DD */
  firstPaymentDate: string;
  /** 命中的扣款日期(升序,YYYY-MM-DD) */
  dates: string[];
  count: number;
  confidence: number;
  evidence: string;
}

const DAY_MS = 86_400_000;

export function detectRecurring(transactions: DetectTransaction[]): DetectedSeries[] {
  const groups = new Map<string, DetectTransaction[]>();
  for (const tx of transactions) {
    const key = normalizeMerchant(tx.merchant);
    if (!key) continue;
    const group = groups.get(key);
    if (group) {
      group.push(tx);
    } else {
      groups.set(key, [tx]);
    }
  }

  const results: DetectedSeries[] = [];
  for (const [merchant, txs] of groups) {
    for (const series of clusterByAmount(txs)) {
      const detected = detectSeries(merchant, series);
      if (detected) {
        results.push(detected);
      }
    }
  }
  // 命中多的排前面(更可能是真订阅)
  results.sort((a, b) => b.count - a.count);
  return results;
}

/** 商户归一化:去空白、去 ● 之类装饰符、统一全角括号(\uFF08/\uFF09) */
export function normalizeMerchant(merchant: string): string {
  return merchant
    .replace(/[●·\s]/g, '')
    .replace(/\uFF08/g, '(')
    .replace(/\uFF09/g, ')')
    .toLowerCase();
}

/** 展示名美化:去掉括注与公司后缀,给确认卡片一个干净的默认名 */
export function beautifyMerchant(merchant: string): string {
  let name = merchant
    .replace(/[●·]/g, '')
    .replace(/\uFF08[^\uFF09]*\uFF09/g, '')
    .replace(/\([^)]*\)/g, '')
    .replace(/(股份)?有限(责任)?公司$/, '')
    .trim();
  if (!name) name = merchant.trim();
  return name.slice(0, 40);
}

/** 组内金额聚类:与当前簇代表金额相差超过 ratio 视为新簇 */
function clusterByAmount(txs: DetectTransaction[], ratio = 0.05): DetectTransaction[][] {
  const sorted = [...txs].sort((a, b) => a.amount - b.amount);
  const clusters: DetectTransaction[][] = [];
  let reference = 0;
  for (const tx of sorted) {
    const last = clusters[clusters.length - 1];
    if (!last || Math.abs(tx.amount - reference) > reference * ratio) {
      clusters.push([tx]);
      reference = tx.amount;
    } else {
      last.push(tx);
    }
  }
  return clusters;
}

function detectSeries(merchant: string, txs: DetectTransaction[]): DetectedSeries | null {
  const sorted = [...txs].sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());
  const n = sorted.length;
  if (n < 3) return null;

  const times = sorted.map((tx) => tx.occurredAt.getTime());
  const intervals: number[] = [];
  for (let i = 1; i < times.length; i++) {
    intervals.push((times[i] - times[i - 1]) / DAY_MS);
  }

  const p = median(intervals);
  if (p < 6) return null; // 高频非订阅(外卖/打车/咖啡)

  const tolerance = Math.max(2, p * 0.15);
  const regular = intervals.every((interval) => Math.abs(interval - p) <= tolerance);
  if (!regular) return null;

  let cycle: DetectedCycle;
  let cycleDays: number | null = null;
  let penalty = 0;
  if (p >= 26 && p <= 35) {
    cycle = 'monthly';
  } else if (p >= 80 && p <= 100) {
    cycle = 'quarterly';
  } else if (p >= 350 && p <= 380) {
    cycle = 'yearly';
  } else if (p >= 6.5 && p <= 7.5) {
    cycle = 'weekly';
    penalty = 0.1; // 周付订阅少见,降权
  } else {
    cycle = 'custom';
    cycleDays = Math.round(p);
    penalty = 0.15;
  }

  const confidence = clamp(0.45 + (n - 3) * 0.1 - penalty, 0.3, 0.95);
  const dates = sorted.map((tx) => dateKey(tx.occurredAt));
  const amount = median(sorted.map((tx) => tx.amount));

  return {
    merchant,
    displayName: beautifyMerchant(merchant),
    amount: Math.round(amount * 100) / 100,
    cycle,
    cycleDays,
    firstPaymentDate: dates[0],
    dates,
    count: n,
    confidence,
    evidence: `${beautifyMerchant(merchant)} 在 ${dates[0]} ~ ${dates[dates.length - 1]} 间规律扣款 ${n} 次,平均间隔约 ${Math.round(p)} 天`,
  };
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function dateKey(date: Date): string {
  const pad = (num: number) => String(num).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
