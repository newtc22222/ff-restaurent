import { Monitor, Moon, Sun, type LucideIcon } from 'lucide-react';
import type { Theme } from '../../app/providers/theme.js';

interface ThemeToggleProps {
  /**
   * Current active theme: 'light' | 'dark' | 'system'
   */
  theme: Theme;
  /**
   * Callback to set a new theme.
   */
  setTheme: (theme: Theme) => void;
}

/**
 * ThemeToggle renders a button that cycles through light, dark, and system themes.
 */
export default function ThemeToggle({ theme, setTheme }: ThemeToggleProps) {
  const icons: Record<Theme, LucideIcon> = {
    light: Sun,
    dark: Moon,
    system: Monitor,
  };

  const nextTheme: Record<Theme, Theme> = {
    light: 'dark',
    dark: 'system',
    system: 'light',
  };

  const Icon = icons[theme];

  return (
    <button
      className="flex h-8 w-8 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-muted hover:text-ink"
      onClick={() => setTheme(nextTheme[theme])}
      title={`Theme: ${theme}`}
    >
      <Icon size={16} />
    </button>
  );
}
