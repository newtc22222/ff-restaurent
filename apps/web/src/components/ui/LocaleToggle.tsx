import { Globe } from 'lucide-react';
import type { Locale } from '../../lib/translations';
import Dropdown from './Dropdown';

interface LocaleToggleProps {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  label?: string;
  englishLabel?: string;
  vietnameseLabel?: string;
}

/** Compact themed dropdown for choosing the application language. */
export default function LocaleToggle({
  locale,
  setLocale,
  label = 'Language',
  englishLabel = 'English',
  vietnameseLabel = 'Tiếng Việt',
}: LocaleToggleProps) {
  return (
    <Dropdown
      label={label}
      value={locale}
      icon={<Globe size={14} />}
      variant="header"
      menuAlign="right"
      ariaLabel={`${label}: ${locale === 'en' ? englishLabel : vietnameseLabel}`}
      options={[
        { value: 'en', label: englishLabel },
        { value: 'vi', label: vietnameseLabel },
      ]}
      onChange={(value) => setLocale(value as Locale)}
    />
  );
}
