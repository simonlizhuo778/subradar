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
