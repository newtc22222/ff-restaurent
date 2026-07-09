import { useState } from 'react';
import { ChevronRight } from 'lucide-react';

export interface Option {
  value: string;
  label: string;
}

interface SelectDropdownProps {
  /**
   * Placeholder label when nothing is selected.
   */
  label: string;
  /**
   * The currently selected value.
   */
  value: string;
  /**
   * The list of options.
   */
  options: Option[];
  /**
   * Callback fired when value changes.
   */
  onChange: (value: string) => void;
}

/**
 * SelectDropdown is a customized single-select dropdown panel with styled options.
 */
export default function SelectDropdown({
  label,
  value,
  options,
  onChange,
}: SelectDropdownProps) {
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value);

  return (
    <div className="relative">
      <button
        className={`flex h-9 items-center gap-2 rounded-lg border px-3 text-[13px] font-semibold transition-all ${
          selected
            ? 'border-ink bg-ink text-white dark:bg-[hsl(210,20%,92%)] dark:text-[hsl(220,15%,9%)]'
            : 'border-border bg-surface text-slate-500 hover:border-ink/40 hover:text-ink'
        }`}
        type="button"
        onClick={() => setOpen((current) => !current)}
      >
        <span>{selected?.label ?? label}</span>
        <ChevronRight
          size={12}
          className={`rotate-90 transition-transform ${open ? '-rotate-90' : ''}`}
        />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-10 z-20 min-w-[180px] overflow-hidden rounded-lg border border-border bg-surface py-1 shadow-lg">
            {value && (
              <button
                className="w-full px-3 py-2 text-left text-[13px] text-slate-400 hover:bg-muted"
                type="button"
                onClick={() => {
                  onChange('');
                  setOpen(false);
                }}
              >
                Clear
              </button>
            )}
            {options.map((option) => (
              <button
                key={option.value}
                className={`w-full px-3 py-2 text-left text-[13px] font-medium transition-colors ${
                  value === option.value
                    ? 'bg-muted text-ink'
                    : 'text-ink hover:bg-muted'
                }`}
                type="button"
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
              >
                {option.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
