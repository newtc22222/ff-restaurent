import { useState, type ReactNode } from 'react';
import { Check, ChevronDown, Search } from 'lucide-react';

export interface DropdownOption {
  value: string;
  label: string;
  icon?: ReactNode;
  description?: string;
  searchText?: string;
}

interface CommonDropdownProps {
  label: string;
  options: DropdownOption[];
  searchable?: boolean;
  searchPlaceholder?: string;
  emptyMessage?: string;
  allowClear?: boolean;
  clearLabel?: string;
  icon?: ReactNode;
  variant?: 'header' | 'filter' | 'field';
  menuAlign?: 'left' | 'right';
  fullWidth?: boolean;
  disabled?: boolean;
  ariaLabel?: string;
  formatSelection?: (selected: DropdownOption[]) => string;
}

type DropdownProps = CommonDropdownProps &
  (
    | {
        multiple: true;
        values: string[];
        onChange: (values: string[]) => void;
        value?: never;
      }
    | {
        multiple?: false;
        value: string;
        onChange: (value: string) => void;
        values?: never;
      }
  );

/** Reusable themed dropdown for header controls, filters, and form fields. */
export default function Dropdown(props: DropdownProps) {
  const {
    label,
    options,
    searchable = false,
    searchPlaceholder = 'Search...',
    emptyMessage = 'No results found',
    allowClear = false,
    clearLabel = props.multiple ? 'Clear all' : 'Clear',
    icon,
    variant = 'field',
    menuAlign = 'left',
    fullWidth = variant === 'field',
    disabled = false,
    ariaLabel,
    formatSelection,
  } = props;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const selectedValues = props.multiple ? props.values : [props.value];
  const selectedOptions = options.filter((option) =>
    selectedValues.includes(option.value),
  );
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const visibleOptions = normalizedQuery
    ? options.filter((option) =>
        (option.searchText ?? option.label)
          .toLocaleLowerCase()
          .includes(normalizedQuery),
      )
    : options;
  const displayLabel =
    selectedOptions.length > 0
      ? (formatSelection?.(selectedOptions) ??
        (props.multiple
          ? `${selectedOptions.length} selected`
          : selectedOptions[0]?.label))
      : label;
  const hasSelection = selectedOptions.length > 0;

  const close = () => {
    setOpen(false);
    setQuery('');
  };

  const selectOption = (option: DropdownOption) => {
    if (props.multiple) {
      props.onChange(
        props.values.includes(option.value)
          ? props.values.filter((value) => value !== option.value)
          : [...props.values, option.value],
      );
      return;
    }
    props.onChange(option.value);
    close();
  };

  const clear = () => {
    if (props.multiple) props.onChange([]);
    else props.onChange('');
    if (!props.multiple) close();
  };

  const triggerClass =
    variant === 'filter'
      ? `h-9 px-3 text-[13px] font-semibold ${
          hasSelection
            ? 'border-ink bg-ink text-white dark:bg-[hsl(210,20%,92%)] dark:text-[hsl(220,15%,9%)]'
            : 'border-border bg-surface text-slate-500 hover:border-ink/40 hover:text-ink'
        }`
      : variant === 'header'
        ? 'h-8 px-2 text-[12px] font-semibold border-border bg-surface text-ink hover:bg-muted'
        : 'h-10 w-full px-3 text-sm border-border bg-surface text-ink hover:border-ink/40';

  return (
    <div className={`relative ${fullWidth ? 'w-full' : ''}`}>
      <button
        type="button"
        className={`flex items-center gap-2 rounded-md border text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${triggerClass} ${fullWidth ? 'w-full' : ''}`}
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-haspopup="listbox"
        disabled={disabled}
        onClick={() => {
          if (open) close();
          else setOpen(true);
        }}
      >
        {icon && <span className="shrink-0 text-slate-500">{icon}</span>}
        <span
          className={`min-w-0 flex-1 truncate ${!hasSelection ? 'text-slate-500' : ''}`}
        >
          {displayLabel}
        </span>
        <ChevronDown
          size={12}
          className={`shrink-0 text-slate-500 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-50"
            aria-hidden="true"
            onClick={close}
          />
          <div
            className={`absolute top-full z-[60] mt-1 min-w-52 overflow-hidden rounded-lg border border-border bg-surface shadow-panel ${
              menuAlign === 'right' ? 'right-0' : 'left-0'
            } ${fullWidth ? 'w-full' : ''}`}
          >
            {searchable && (
              <div className="relative border-b border-border p-2">
                <input
                  autoFocus
                  type="search"
                  value={query}
                  aria-label={searchPlaceholder}
                  placeholder={searchPlaceholder}
                  className="h-8 w-full rounded-md border border-border bg-surface py-1 pl-2.5 pr-8 text-[13px] text-ink outline-none placeholder:text-slate-400 focus:border-ink/50"
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Escape') close();
                  }}
                />
                <Search
                  aria-hidden="true"
                  size={14}
                  className="pointer-events-none absolute right-4 top-4 text-slate-400"
                />
              </div>
            )}

            {allowClear && hasSelection && (
              <button
                type="button"
                className="w-full border-b border-border px-3 py-2 text-left text-[13px] text-slate-500 transition-colors hover:bg-muted hover:text-ink"
                onClick={clear}
              >
                {clearLabel}
              </button>
            )}

            <div
              className="max-h-64 overflow-y-auto p-1.5"
              role="listbox"
              aria-label={label}
              aria-multiselectable={props.multiple || undefined}
            >
              {visibleOptions.length === 0 && (
                <p className="px-3 py-4 text-center text-[13px] text-slate-400">
                  {emptyMessage}
                </p>
              )}
              {visibleOptions.map((option) => {
                const active = selectedValues.includes(option.value);
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="option"
                    aria-selected={active}
                    className={`flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-[13px] transition-colors hover:bg-muted ${
                      active
                        ? 'bg-muted text-ink'
                        : 'text-slate-600 dark:text-slate-300'
                    }`}
                    onClick={() => selectOption(option)}
                  >
                    {option.icon && (
                      <span className="flex h-4 w-4 shrink-0 items-center justify-center text-slate-500">
                        {option.icon}
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">
                        {option.label}
                      </span>
                      {option.description && (
                        <span className="mt-0.5 block truncate text-[11px] font-normal text-slate-500">
                          {option.description}
                        </span>
                      )}
                    </span>
                    {active && (
                      <Check size={13} className="shrink-0 text-ink" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
