import { Globe } from 'lucide-react';
import type { Locale } from '../../lib/translations';

interface LocaleToggleProps {
  /**
   * Current active locale: 'vi' | 'en'
   */
  locale: Locale;
  /**
   * Callback to set a new locale.
   */
  setLocale: (locale: Locale) => void;
}

/**
 * LocaleToggle renders a button that switches language between English and Vietnamese.
 */
export default function LocaleToggle({ locale, setLocale }: LocaleToggleProps) {
  return (
    <button
      className="flex h-8 items-center gap-1.5 rounded-md px-2 text-[12px] font-semibold text-slate-500 transition-colors hover:bg-muted hover:text-ink"
      onClick={() => setLocale(locale === 'vi' ? 'en' : 'vi')}
      title={locale === 'vi' ? 'Switch to English' : 'Chuyển sang Tiếng Việt'}
    >
      <Globe size={14} />
      {locale === 'vi' ? '🇻🇳' : '🇬🇧'}
    </button>
  );
}
