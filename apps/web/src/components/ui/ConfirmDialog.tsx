import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';

import { useI18n } from '@/app/providers/i18n';

interface ConfirmDialogProps {
  /**
   * Title text of the confirmation modal.
   */
  title: string;
  /**
   * Content message explaining the implications of the action.
   */
  message: string;
  /**
   * Callback fired when clicking the primary confirm button.
   */
  onConfirm: () => void;
  /**
   * Callback fired when clicking cancel or outside the dialog.
   */
  onCancel: () => void;
  pending?: boolean;
}

/**
 * ConfirmDialog displays a modal dialog forcing user confirmation before proceeding.
 */
export default function ConfirmDialog({
  title,
  message,
  onConfirm,
  onCancel,
  pending = false,
}: ConfirmDialogProps) {
  const { t } = useI18n();
  const dialogRef = useRef<HTMLDivElement>(null);
  const onCancelRef = useRef(onCancel);
  const titleId = useId();
  onCancelRef.current = onCancel;

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !pending) {
        onCancelRef.current();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    document.body.style.overflow = 'hidden';
    window.requestAnimationFrame(() => {
      const focusable = dialogRef.current?.querySelector<HTMLElement>(
        'button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      focusable?.focus();
    });
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = '';
      previous?.focus();
    };
  }, [pending]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div className="overlay-backdrop" onClick={() => !pending && onCancel()}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="mx-4 w-full max-w-sm rounded-xl border border-border bg-surface p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id={titleId} className="mb-2 text-base font-bold text-ink">
          {title}
        </h3>
        <p className="mb-5 text-sm text-slate-500">{message}</p>
        <div className="flex gap-3">
          <button
            type="button"
            className="btn btn-soft flex-1"
            disabled={pending}
            onClick={onCancel}
          >
            {t('auth.cancel')}
          </button>
          <button
            type="button"
            className="btn btn-primary flex-1"
            disabled={pending}
            onClick={onConfirm}
          >
            {pending ? t('common.loading') : t('common.confirm')}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
