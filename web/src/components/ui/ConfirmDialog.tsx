import { AlertTriangle } from 'lucide-react';
import { Button } from './index';
import { Modal } from './Modal';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  loading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

/** 危险操作确认弹窗,替代 window.confirm */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = '删除',
  loading = false,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  return (
    <Modal open={open} onClose={loading ? () => undefined : onClose} className="sm:max-w-sm">
      <div className="p-6">
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-rose-50 text-rose-600">
          <AlertTriangle className="h-5 w-5" aria-hidden />
        </div>
        <h3 className="mt-4 text-base font-semibold text-slate-900">{title}</h3>
        {description && <p className="mt-1.5 text-sm leading-6 text-slate-500">{description}</p>}
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            取消
          </Button>
          <Button variant="danger" onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}