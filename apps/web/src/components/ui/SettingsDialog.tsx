import type { ReactNode } from 'react';

import { useAccent } from '@/app/providers/accent';
import { useI18n } from '@/app/providers/i18n';
import { useTheme } from '@/app/providers/theme';

import AccentToggle from './AccentToggle';
import LocaleToggle from './LocaleToggle';
import Modal from './Modal';
import ThemeToggle from './ThemeToggle';

interface SettingsDialogProps {
  open: boolean;
  onClose: () => void;
  returnFocusTo?: HTMLElement | null;
}

function SettingRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm font-medium text-ink">{label}</span>
      {children}
    </div>
  );
}

/**
 * Device-local display preferences. Account-level settings (notification
 * preferences) stay on the profile page so synced and local state don't mix.
 */
export default function SettingsDialog({
  open,
  onClose,
  returnFocusTo = null,
}: SettingsDialogProps) {
  const { locale, setLocale, t } = useI18n();
  const { theme, setTheme } = useTheme();
  const { accent, setAccent } = useAccent();

  return (
    <Modal
      open={open}
      title={t('settings.title')}
      onClose={onClose}
      returnFocusTo={returnFocusTo}
      closeOnClickOutside
    >
      <div className="space-y-4">
        <SettingRow label={t('nav.language')}>
          <LocaleToggle
            locale={locale}
            setLocale={setLocale}
            label={t('nav.language')}
            englishLabel={t('language.english')}
            vietnameseLabel={t('language.vietnamese')}
          />
        </SettingRow>

        <SettingRow label={t('nav.theme')}>
          <ThemeToggle
            theme={theme}
            setTheme={setTheme}
            label={t('nav.theme')}
            lightLabel={t('theme.light')}
            darkLabel={t('theme.dark')}
            systemLabel={t('theme.system')}
          />
        </SettingRow>

        <SettingRow label={t('theme.accent')}>
          <AccentToggle
            accent={accent}
            setAccent={setAccent}
            label={t('theme.accent')}
            saffronLabel={t('theme.accentSaffron')}
            basilLabel={t('theme.accentBasil')}
            chiliLabel={t('theme.accentChili')}
          />
        </SettingRow>

        <p className="border-t border-border pt-4 text-xs text-slate-500">
          {t('settings.description')}
        </p>
      </div>
    </Modal>
  );
}
