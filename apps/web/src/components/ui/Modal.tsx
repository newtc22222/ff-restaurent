import { X } from 'lucide-react';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import ScrollArea from './ScrollArea';

interface ModalProps {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
  size?: 'md' | 'lg';
}

export default function Modal({
  open,
  title,
  children,
  onClose,
  size = 'md',
}: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  const titleId = useId();
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCloseRef.current();
    };
    document.addEventListener('keydown', onKeyDown);
    document.body.style.overflow = 'hidden';
    window.requestAnimationFrame(() => {
      const focusable = dialogRef.current?.querySelector<HTMLElement>(
        'input, textarea, select, button, [tabindex]:not([tabindex="-1"])',
      );
      focusable?.focus();
    });
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = '';
      previous?.focus();
    };
  }, [open]);

  if (!open) return null;
  return createPortal(
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`panel flex max-h-[calc(100vh-2rem)] w-full flex-col overflow-hidden ${
          size === 'lg' ? 'max-w-3xl' : 'max-w-lg'
        }`}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-surface px-5 py-4">
          <h2 id={titleId} className="text-lg font-bold text-ink">
            {title}
          </h2>
          <button
            type="button"
            className="grid h-9 w-9 place-items-center rounded-md text-slate-500 hover:bg-muted hover:text-ink"
            aria-label="Close"
            onClick={onClose}
          >
            <X size={17} aria-hidden="true" />
          </button>
        </div>
        <ScrollArea
          className="min-h-0 max-h-[calc(100vh-6.5rem)] shrink"
          contentClassName="p-5"
        >
          {children}
        </ScrollArea>
      </div>
    </div>,
    document.body,
  );
}
