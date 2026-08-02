import type { Accent } from '@/app/providers/accent';

import Dropdown, { type DropdownOption } from './Dropdown';

interface AccentToggleProps {
  accent: Accent;
  setAccent: (accent: Accent) => void;
  label?: string;
  saffronLabel?: string;
  basilLabel?: string;
  chiliLabel?: string;
}

/** Swatch shown in the trigger and next to each option. Uses the literal brand
    color rather than --color-accent so every option reads as itself. */
function Swatch({ color }: { color: string }) {
  return (
    <span
      aria-hidden="true"
      className="inline-block h-3 w-3 shrink-0 rounded-full"
      style={{ background: color }}
    />
  );
}

const SWATCHES: Record<Accent, string> = {
  saffron: 'hsl(36 90% 48%)',
  basil: 'hsl(151 45% 32%)',
  chili: 'hsl(6 78% 52%)',
};

/** Compact dropdown for choosing the application accent color. */
export default function AccentToggle({
  accent,
  setAccent,
  label = 'Accent',
  saffronLabel = 'Saffron',
  basilLabel = 'Basil',
  chiliLabel = 'Chili',
}: AccentToggleProps) {
  const options: DropdownOption[] = [
    {
      value: 'saffron',
      label: saffronLabel,
      icon: <Swatch color={SWATCHES.saffron} />,
    },
    {
      value: 'basil',
      label: basilLabel,
      icon: <Swatch color={SWATCHES.basil} />,
    },
    {
      value: 'chili',
      label: chiliLabel,
      icon: <Swatch color={SWATCHES.chili} />,
    },
  ];

  return (
    <Dropdown
      label={label}
      value={accent}
      className="w-36"
      icon={<Swatch color={SWATCHES[accent]} />}
      options={options}
      variant="header"
      menuAlign="right"
      ariaLabel={`${label}: ${options.find((option) => option.value === accent)?.label ?? accent}`}
      onChange={(value) => setAccent(value as Accent)}
    />
  );
}
