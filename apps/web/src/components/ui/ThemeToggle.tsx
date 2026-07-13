import { Monitor, Moon, Sun, type LucideIcon } from 'lucide-react';
import type { Theme } from '../../app/providers/theme';
import Dropdown, { type DropdownOption } from './Dropdown';

interface ThemeToggleProps {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  label?: string;
  lightLabel?: string;
  darkLabel?: string;
  systemLabel?: string;
}

/** Compact themed dropdown for choosing the application theme. */
export default function ThemeToggle({
  theme,
  setTheme,
  label = 'Theme',
  lightLabel = 'Light',
  darkLabel = 'Dark',
  systemLabel = 'System',
}: ThemeToggleProps) {
  const icons: Record<Theme, LucideIcon> = {
    light: Sun,
    dark: Moon,
    system: Monitor,
  };
  const Icon = icons[theme];
  const options: DropdownOption[] = [
    { value: 'light', label: lightLabel, icon: <Sun size={13} /> },
    { value: 'dark', label: darkLabel, icon: <Moon size={13} /> },
    { value: 'system', label: systemLabel, icon: <Monitor size={13} /> },
  ];

  return (
    <Dropdown
      label={label}
      value={theme}
      icon={<Icon size={14} />}
      options={options}
      variant="header"
      menuAlign="right"
      ariaLabel={`${label}: ${options.find((option) => option.value === theme)?.label ?? theme}`}
      onChange={(value) => setTheme(value as Theme)}
    />
  );
}
