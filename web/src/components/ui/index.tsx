import { forwardRef } from 'react';
import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Inbox,
  Info,
  Loader2,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { STATUS_LABELS, statusClass } from '@/lib/format';
import type { SubscriptionStatus } from '@/lib/types';

/** 轻量 className 合并 */
export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

/* ---------------------------------- Spinner --------------------------------- */

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cx('h-4 w-4 animate-spin', className)} aria-hidden />;
}

/* ---------------------------------- Button ---------------------------------- */

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-accent-600 text-white shadow-btn hover:bg-accent-hover',
  secondary:
    'border border-slate-900/10 bg-white text-slate-700 hover:border-slate-900/20 hover:bg-slate-50',
  ghost: 'text-slate-600 hover:bg-slate-900/5 hover:text-slate-900',
  danger: 'bg-rose-600 text-white hover:bg-rose-500',
};

const BUTTON_SIZES: Record<ButtonSize, string> = {
  sm: 'h-8 rounded-lg px-3 text-xs',
  md: 'h-9 rounded-xl px-4 text-sm',
  lg: 'h-10 rounded-xl px-5 text-sm',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  className,
  children,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={cx(
        'inline-flex items-center justify-center gap-1.5 whitespace-nowrap font-medium transition-all duration-150 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50',
        BUTTON_SIZES[size],
        BUTTON_VARIANTS[variant],
        className,
      )}
      {...rest}
    >
      {loading && <Spinner className={size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4'} />}
      {children}
    </button>
  );
}

/* --------------------------------- IconButton -------------------------------- */

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  tone?: 'default' | 'danger';
}

export function IconButton({ tone = 'default', className, type = 'button', ...rest }: IconButtonProps) {
  return (
    <button
      type={type}
      className={cx(
        'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors duration-150 disabled:pointer-events-none disabled:opacity-40',
        tone === 'danger'
          ? 'text-slate-400 hover:bg-rose-50 hover:text-rose-600'
          : 'text-slate-500 hover:bg-slate-900/5 hover:text-slate-800',
        className,
      )}
      {...rest}
    />
  );
}

/* ----------------------------------- Badge ----------------------------------- */

export type BadgeTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'accent';

const BADGE_TONES: Record<BadgeTone, string> = {
  success: 'bg-emerald-50 text-emerald-700',
  warning: 'bg-amber-50 text-amber-700',
  danger: 'bg-rose-50 text-rose-700',
  info: 'bg-sky-50 text-sky-700',
  neutral: 'bg-slate-100 text-slate-500',
  accent: 'bg-accent-50 text-accent-700',
};

export function Badge({
  tone = 'neutral',
  dot = false,
  className,
  children,
}: {
  tone?: BadgeTone;
  dot?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium',
        BADGE_TONES[tone],
        className,
      )}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current opacity-60" aria-hidden />}
      {children}
    </span>
  );
}

/** 订阅状态胶囊徽章(配色沿用 format.statusClass) */
export function StatusBadge({ status, className }: { status: SubscriptionStatus; className?: string }) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium',
        statusClass(status),
        className,
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-60" aria-hidden />
      {STATUS_LABELS[status]}
    </span>
  );
}

/* ----------------------------------- Card ------------------------------------ */

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cx('rounded-2xl border border-slate-900/8 bg-white shadow-card', className)}>
      {children}
    </div>
  );
}

/* ------------------------------- Form primitives ------------------------------ */

export function Field({
  label,
  htmlFor,
  hint,
  className,
  children,
}: {
  label: ReactNode;
  htmlFor?: string;
  hint?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className="mb-1.5 block text-xs font-medium text-slate-600">
        {label}
      </label>
      {children}
      {hint && <p className="mt-1 text-xs leading-5 text-slate-400">{hint}</p>}
    </div>
  );
}

const FIELD_BASE =
  'w-full rounded-xl border border-slate-900/10 bg-white px-3 text-sm text-slate-900 outline-none transition duration-150 placeholder:text-slate-400 hover:border-slate-900/20 focus:border-accent-500 focus:ring-2 focus:ring-accent-500/20 disabled:opacity-50';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...rest }, ref) {
    return <input ref={ref} className={cx(FIELD_BASE, 'h-10', className)} {...rest} />;
  },
);

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, children, ...rest }, ref) {
    return (
      <div className="relative">
        <select ref={ref} className={cx(FIELD_BASE, 'h-10 appearance-none pr-9', className)} {...rest}>
          {children}
        </select>
        <ChevronDown
          className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
          aria-hidden
        />
      </div>
    );
  },
);

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...rest }, ref) {
    return <textarea ref={ref} className={cx(FIELD_BASE, 'min-h-20 py-2.5 leading-6', className)} {...rest} />;
  },
);

export function Checkbox({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type="checkbox"
      className={cx('h-4 w-4 shrink-0 rounded accent-accent-600', className)}
      {...rest}
    />
  );
}

/* --------------------------------- Segmented --------------------------------- */

interface SegmentedOption<T extends string> {
  value: T;
  label: ReactNode;
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  fluid = false,
  className,
}: {
  options: Array<SegmentedOption<T>>;
  value: T;
  onChange: (value: T) => void;
  fluid?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cx(
        'inline-flex items-center gap-0.5 rounded-xl bg-slate-900/5 p-1',
        fluid && 'flex w-full',
        className,
      )}
      role="tablist"
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option.value)}
            className={cx(
              'rounded-lg px-3 py-1.5 text-sm transition-all duration-150',
              fluid && 'flex-1',
              active
                ? 'bg-white font-medium text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-800',
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/* ---------------------------------- Skeleton --------------------------------- */

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx('skeleton rounded-lg', className)} aria-hidden />;
}

/* --------------------------------- EmptyState -------------------------------- */

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx('flex flex-col items-center justify-center px-6 py-12 text-center', className)}>
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
        <Icon className="h-5 w-5" aria-hidden />
      </div>
      <p className="mt-4 text-sm font-medium text-slate-700">{title}</p>
      {description && <p className="mt-1 max-w-xs text-xs leading-5 text-slate-400">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/* --------------------------------- PageHeader -------------------------------- */

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">{title}</h1>
        {description && <p className="mt-1 text-sm leading-6 text-slate-500">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

/* ----------------------------------- Alert ----------------------------------- */

type AlertTone = 'error' | 'success' | 'warning' | 'info';

const ALERT_TONES: Record<AlertTone, { className: string; icon: LucideIcon }> = {
  error: { className: 'bg-rose-50 text-rose-700', icon: AlertCircle },
  success: { className: 'bg-emerald-50 text-emerald-700', icon: CheckCircle2 },
  warning: { className: 'bg-amber-50 text-amber-700', icon: AlertTriangle },
  info: { className: 'bg-accent-50 text-accent-700', icon: Info },
};

export function Alert({
  tone = 'error',
  className,
  children,
}: {
  tone?: AlertTone;
  className?: string;
  children: ReactNode;
}) {
  const { className: toneClass, icon: Icon } = ALERT_TONES[tone];
  return (
    <div className={cx('flex items-start gap-2 rounded-xl px-3.5 py-2.5 text-sm leading-5', toneClass, className)}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}