export type Cycle = 'monthly' | 'quarterly' | 'yearly' | 'weekly' | 'custom';
export type SubscriptionStatus = 'active' | 'trial' | 'paused' | 'cancelled';

export interface Category {
  id: number;
  name: string;
  color: string | null;
  icon: string | null;
  sort: number;
}

export interface Subscription {
  id: number;
  name: string;
  logoUrl: string | null;
  categoryId: number | null;
  category: Category | null;
  amount: number;
  currency: string;
  cycle: Cycle;
  customDays: number | null;
  firstPaymentDate: string;
  nextPaymentDate: string;
  paymentMethod: string | null;
  autoRenew: boolean;
  notes: string | null;
  status: SubscriptionStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Payment {
  id: number;
  subscriptionId: number;
  amount: number;
  currency: string;
  paidAt: string;
  source: string;
}

export interface UpcomingItem {
  subscriptionId: number;
  name: string;
  amount: number;
  currency: string;
  nextPaymentDate: string;
  daysUntil: number;
  categoryName: string | null;
  categoryColor: string | null;
}

export interface StatsSummary {
  activeCount: number;
  pausedCount: number;
  yearlyByCurrency: Record<string, number>;
  monthRemaining: number;
  upcoming7Count: number;
  upcoming: UpcomingItem[];
}

export interface CategoryStatRow {
  category: { id: number; name: string; color: string | null } | null;
  count: number;
  yearlyByCurrency: Record<string, number>;
}

export interface CalendarDayItem {
  subscriptionId: number;
  name: string;
  amount: number;
  currency: string;
  autoRenew: boolean;
  category: { name: string; color: string | null } | null;
}

export interface CalendarResponse {
  month: string;
  days: Record<string, CalendarDayItem[]>;
}

/* ---------- W3:AI 快速录入 ---------- */

export interface AiSettingsInfo {
  configured: boolean;
  provider?: string;
  baseUrl?: string | null;
  model?: string | null;
  visionModel?: string | null;
  dailyLimit?: number;
  keyHint?: string;
  updatedAt?: string;
}

export interface TestResult {
  ok: boolean;
  latencyMs?: number;
  model?: string;
  reply?: string;
  error?: string;
}

export interface ModelsResult {
  baseUrl: string;
  count: number;
  models: string[];
  hint: string;
}

/* ---------- 主动推送渠道 ---------- */

export type ChannelType = 'feishu' | 'webhook' | 'email';

export interface NotificationChannelInfo {
  id: number;
  type: ChannelType;
  label: string;
  targetHint: string;
  enabled: boolean;
  lastStatus: 'ok' | 'failed' | null;
  lastError: string | null;
  lastSentAt: string | null;
  createdAt: string;
  hasSmtp: boolean;
  smtpHost: string | null;
  smtpUser: string | null;
}

export interface NotificationLogRow {
  id: number;
  title: string;
  ok: boolean;
  error: string | null;
  channelId: number | null;
  createdAt: string;
}

export interface ExtractedCandidate {
  is_subscription: boolean;
  name: string | null;
  merchant: string | null;
  amount: number | null;
  currency: string;
  cycle: string | null;
  cycle_days: number | null;
  first_payment_date: string | null;
  next_payment_date: string | null;
  payment_method: string | null;
  auto_renew: boolean | null;
  confidence: number;
  evidence: string | null;
}

export interface CandidateRow {
  id: number;
  source: string;
  rawRef: string | null;
  extracted: ExtractedCandidate;
  confidence: number;
  status: 'pending' | 'confirmed' | 'dismissed';
  subscriptionId: number | null;
  createdAt: string;
  decidedAt: string | null;
}

export interface UsageSummary {
  total: number;
  ok: number;
  failed: number;
  promptTokens: number;
  completionTokens: number;
  byDay: Array<{ date: string; calls: number; ok: number; tokens: number }>;
}

export interface MonthlyPoint {
  month: string;
  count: number;
  byCurrency: Record<string, number>;
}

export interface TopSubscriptionRow {
  id: number;
  name: string;
  amount: number;
  currency: string;
  cycle: Cycle;
  customDays: number | null;
  yearlyCost: number;
  nextPaymentDate: string;
  categoryName: string | null;
  categoryColor: string | null;
}

/* ---------- W5:账单导入 / 扣款历史 / 提醒 ---------- */

export interface SubscriptionDetail extends Subscription {
  payments: Payment[];
}

export interface BillImportRecord {
  id: number;
  source: string;
  filename: string;
  totalRows: number;
  validRows: number;
  status: string;
  createdAt: string;
}

export interface BillTransactionRow {
  id: number;
  importId: number;
  occurredAt: string;
  merchant: string;
  amount: number;
  direction: string;
  memo: string | null;
}

export interface BillImportResult {
  import: BillImportRecord;
  failed: { count: number; samples: Array<{ line: number; reason: string }> };
  candidates: CandidateRow[];
  message: string;
}

export interface BillImportDetail {
  import: BillImportRecord;
  transactions: BillTransactionRow[];
  candidates: CandidateRow[];
}

export interface ReminderItem {
  id: number;
  remindDate: string;
  sentAt: string | null;
  subscription: {
    id: number;
    name: string;
    amount: number;
    currency: string;
    nextPaymentDate: string;
    categoryName: string | null;
    categoryColor: string | null;
  };
}

export interface AiSuggestion {
  title: string;
  detail: string;
  priority: 'high' | 'medium' | 'low';
  related: string[];
  potentialYearlySaving: number | null;
}

export interface SuggestionsResult {
  basedOn: number;
  suggestions: AiSuggestion[];
}
