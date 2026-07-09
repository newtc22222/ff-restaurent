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
  /**
   * Translation utility function.
   */
  t: (key: string) => string;
}

/**
 * ConfirmDialog displays a modal dialog forcing user confirmation before proceeding.
 */
export default function ConfirmDialog({
  title,
  message,
  onConfirm,
  onCancel,
  t,
}: ConfirmDialogProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onCancel}
    >
      <div
        className="mx-4 w-full max-w-sm rounded-xl border border-border bg-surface p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="mb-2 text-[16px] font-bold text-ink">{title}</h3>
        <p className="mb-5 text-[14px] text-slate-500">{message}</p>
        <div className="flex gap-3">
          <button className="btn btn-soft flex-1" onClick={onCancel}>
            {t('auth.cancel')}
          </button>
          <button className="btn btn-primary flex-1" onClick={onConfirm}>
            {t('common.confirm')}
          </button>
        </div>
      </div>
    </div>
  );
}
