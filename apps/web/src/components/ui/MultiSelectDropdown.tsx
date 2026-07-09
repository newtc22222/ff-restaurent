import { useState } from 'react';
import { CheckCircle2, ChevronRight } from 'lucide-react';
import type { Option } from './SelectDropdown.js';

interface MultiSelectDropdownProps {
  /**
   * Placeholder label when nothing is selected.
   */
  label: string;
  /**
   * Array of currently selected values.
   */
  values: string[];
  /**
   * The list of options.
   */
  options: Option[];
  /**
   * Callback fired when value changes.
   */
  onChange: (values: string[]) => void;
}

/**
 * MultiSelectDropdown is a custom multi-select list filter with checkbox indicators.
 */
export default function MultiSelectDropdown({
  label,
  values,
  options,
  onChange,
}: MultiSelectDropdownProps) {
  const [open, setOpen] = useState(false);
  const selectedOptions = options.filter((option) =>
    values.includes(option.value),
  );
  const displayLabel =
    selectedOptions.length === 0
      ? label
      : selectedOptions.length === 1
        ? selectedOptions[0]?.label.split(' ')[0]
        : `${selectedOptions.length} members`;

  const toggleOption = (value: string) => {
    onChange(
      values.includes(value)
        ? values.filter((current) => current !== value)
        : [...values, value],
    );
  };

  return (
    <div className="relative">
      <button
        className={`flex h-9 items-center gap-2 rounded-lg border px-3 text-[13px] font-semibold transition-all ${
          values.length > 0
            ? 'border-ink bg-ink text-white dark:bg-[hsl(210,20%,92%)] dark:text-[hsl(220,15%,9%)]'
            : 'border-border bg-surface text-slate-500 hover:border-ink/40 hover:text-ink'
        }`}
        type="button"
        onClick={() => setOpen((current) => !current)}
      >
        <span>{displayLabel}</span>
        <ChevronRight
          size={12}
          className={`rotate-90 transition-transform ${open ? '-rotate-90' : ''}`}
        />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-10 z-20 min-w-[190px] overflow-hidden rounded-lg border border-border bg-surface py-1 shadow-lg">
            {values.length > 0 && (
              <button
                className="w-full border-b border-muted px-3 py-2 text-left text-[13px] text-slate-400 hover:bg-muted"
                type="button"
                onClick={() => onChange([])}
              >
                Clear all
              </button>
            )}
            {options.map((option) => {
              const checked = values.includes(option.value);
              return (
                <button
                  key={option.value}
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] text-ink transition-colors hover:bg-muted"
                  type="button"
                  onClick={() => toggleOption(option.value)}
                >
                  <span
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                      checked
                        ? 'border-ink bg-ink dark:border-[hsl(210,20%,92%)] dark:bg-[hsl(210,20%,92%)]'
                        : 'border-slate-300 dark:border-slate-600'
                    }`}
                  >
                    {checked && (
                      <CheckCircle2
                        size={11}
                        className="text-white dark:text-[hsl(220,15%,9%)]"
                      />
                    )}
                  </span>
                  <span className="font-medium">{option.label}</span>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
