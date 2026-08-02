import { useI18n } from '@/app/providers/i18n';

import BrandIcon from './BrandIcon';
import Modal from './Modal';

interface InfoDialogProps {
  open: boolean;
  onClose: () => void;
}

/** What this app is, plus the shipped build version. */
export default function InfoDialog({ open, onClose }: InfoDialogProps) {
  const { t } = useI18n();

  return (
    <Modal
      open={open}
      title={t('info.title')}
      onClose={onClose}
      closeOnClickOutside
    >
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <BrandIcon size={44} />
          <div className="min-w-0">
            <p className="text-base font-bold text-ink">{t('app.name')}</p>
            <p className="text-sm text-slate-500">{t('app.tagline')}</p>
          </div>
        </div>

        <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          {t('app.description')}
        </p>

        {/* Repository / docs / support links go here once the URLs and the
            audience for them are settled. */}

        <p className="border-t border-border pt-4 text-xs text-slate-500">
          {t('info.version')} {__APP_VERSION__}
        </p>
      </div>
    </Modal>
  );
}
