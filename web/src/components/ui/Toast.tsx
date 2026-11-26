import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cx } from './index';

type ToastTone = 'success' | 'error' | 'info';

interface ToastItem {
  id: number;
  tone: ToastTone;
  message: string;
}

export interface ToastApi {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const TONE_ICONS: Record<ToastTone, LucideIcon> = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
};

const TONE_CLASSES: Record<ToastTone, string> = {
  success: 'text-emerald-500',
  error: 'text-rose-500',
  info: 'text-accent-500',
};

/** 全局操作反馈:底部堆叠、4s 自动消失、可手动关闭 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idRef = useRef(0);
  const timersRef = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  const push = useCallback(
    (tone: ToastTone, message: string) => {
      const id = ++idRef.current;
      setToasts((prev) => [...prev.slice(-3), { id, tone, message }]);
      timersRef.current.set(id, setTimeout(() => dismiss(id), 4000));
    },
    [dismiss],
  );

  const api = useMemo<ToastApi>(
    () => ({
      success: (message) => push('success', message),
      error: (message) => push('error', message),
      info: (message) => push('info', message),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[80] flex flex-col items-center gap-2 p-4 sm:items-end">
        {toasts.map((toast) => {
          const Icon = TONE_ICONS[toast.tone];
          return (
            <div
              key={toast.id}
              role="status"
              className="pointer-events-auto flex w-full max-w-sm animate-toast-in items-start gap-2.5 rounded-xl border border-slate-900/8 bg-white px-3.5 py-3 shadow-pop"
            >
              <Icon className={cx('mt-0.5 h-4 w-4 shrink-0', TONE_CLASSES[toast.tone])} aria-hidden />
              <p className="min-w-0 flex-1 text-sm leading-5 text-slate-700">{toast.message}</p>
              <button
                type="button"
                onClick={() => dismiss(toast.id)}
                className="rounded-md p-0.5 text-slate-300 transition-colors duration-150 hover:bg-slate-100 hover:text-slate-500"
                aria-label="关闭提示"
              >
                <X className="h-3.5 w-3.5" aria-hidden />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast 必须在 <ToastProvider> 内使用');
  }
  return ctx;
}