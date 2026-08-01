import { ImageOff, Loader2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { useI18n } from '@/app/providers/i18n';
import { cn } from '@/lib/cn';

import Modal from './Modal';

type LoadState = 'loading' | 'loaded' | 'error';

interface ImagePreviewDialogProps {
  open: boolean;
  onClose: () => void;
  /** Current signed or public URL for the image. */
  src: string | null | undefined;
  /** Accessible dialog title (also shown in the header). */
  title: string;
  /** Alt text for the rendered image. */
  alt: string;
  /**
   * Called on load failure. For signed URLs this should re-run the page's
   * existing data fetch to obtain a fresh URL, since there is no dedicated
   * "resign" endpoint. For public-bucket images it's optional — the dialog
   * falls back to remounting the same URL.
   */
  onRetry?: () => void | Promise<void>;
  /**
   * True for payment-QR images (private, time-limited signed URLs): enables
   * one automatic retry via `onRetry` before showing the terminal error
   * state. Omit for public-bucket images (restaurant/profile/dining-area),
   * whose URLs don't expire — a failure there is a transient network issue,
   * handled by a manual remount-retry instead.
   */
  isSignedUrl?: boolean;
  /** Extra classes for the rendered image, e.g. a white QR backing. */
  imageClassName?: string;
}

export default function ImagePreviewDialog({
  open,
  onClose,
  src,
  title,
  alt,
  onRetry,
  isSignedUrl,
  imageClassName,
}: ImagePreviewDialogProps) {
  const { t } = useI18n();
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [remountKey, setRemountKey] = useState(0);
  const hasAutoRetried = useRef(false);

  useEffect(() => {
    if (!open) return;
    setLoadState(src ? 'loading' : 'error');
    hasAutoRetried.current = false;
  }, [open, src]);

  const retry = () => {
    hasAutoRetried.current = false;
    setRemountKey((key) => key + 1);
    setLoadState('loading');
    void onRetry?.();
  };

  const handleError = () => {
    if (isSignedUrl && !hasAutoRetried.current) {
      hasAutoRetried.current = true;
      void onRetry?.();
      return;
    }
    setLoadState('error');
  };

  return (
    <Modal
      open={open}
      title={title}
      onClose={onClose}
      size="lg"
      closeOnClickOutside
    >
      <div className="flex flex-col items-center gap-3">
        {loadState === 'error' ? (
          <div
            role="alert"
            className="flex flex-col items-center gap-3 py-10 text-center text-slate-500"
          >
            <ImageOff size={28} aria-hidden="true" />
            <p className="text-sm">{t('common.imagePreviewError')}</p>
            <button
              type="button"
              className="text-xs font-semibold text-red-600 hover:underline dark:text-red-400"
              onClick={retry}
            >
              {t('common.retry')}
            </button>
          </div>
        ) : (
          <>
            {loadState === 'loading' && (
              <div
                role="status"
                className="flex h-48 items-center justify-center text-slate-400"
              >
                <Loader2
                  className="animate-spin"
                  size={28}
                  aria-hidden="true"
                />
                <span className="sr-only">
                  {t('common.imagePreviewLoading')}
                </span>
              </div>
            )}
            {src && (
              <img
                key={remountKey}
                src={src}
                alt={alt}
                className={cn(
                  'mx-auto max-h-[70vh] w-auto max-w-full rounded-lg object-contain',
                  imageClassName,
                  loadState === 'loading' && 'hidden',
                )}
                onLoad={() => setLoadState('loaded')}
                onError={handleError}
              />
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
