import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { cx } from './index';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  className?: string;
}

/**
 * 统一弹窗壳:遮罩点击 / ESC 关闭、body 滚动锁定、
 * 进入 / 退出 200ms 过渡;移动端底部贴合,桌面居中。
 */
export function Modal({ open, onClose, children, className }: ModalProps) {
  const [mounted, setMounted] = useState(open);

  // 关闭时保留 200ms 播放退出动画
  useEffect(() => {
    if (open) {
      setMounted(true);
      return;
    }
    const timer = setTimeout(() => setMounted(false), 200);
    return () => clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!mounted) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [mounted, onClose]);

  if (!mounted) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className={cx(
        'fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-slate-900/30 backdrop-blur-[2px] transition-opacity duration-200 sm:items-center sm:p-6',
        open ? 'animate-fade-in opacity-100' : 'pointer-events-none opacity-0',
      )}
      onClick={onClose}
    >
      <div
        className={cx(
          'max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white shadow-pop transition-all duration-200 sm:max-h-[85dvh] sm:rounded-2xl',
          open ? 'animate-scale-in' : 'translate-y-3 opacity-0 sm:translate-y-1 sm:scale-[0.98]',
          className,
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}