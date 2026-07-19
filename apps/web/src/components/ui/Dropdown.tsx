import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Search } from 'lucide-react';
import ScrollArea from './ScrollArea';

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
  onSearchChange?: (query: string) => void;
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

type MenuPosition = {
  top: number;
  left: number;
  width?: number;
  maxWidth: number;
  placement: 'top' | 'bottom';
};

const VIEWPORT_GAP = 8;
const TRIGGER_GAP = 4;

/** Reusable themed dropdown that flips and clamps itself inside the viewport. */
export default function Dropdown(props: DropdownProps) {
  const {
    label,
    options,
    searchable = false,
    searchPlaceholder = 'Search...',
    onSearchChange,
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
  const [activeIndex, setActiveIndex] = useState(0);
  const [position, setPosition] = useState<MenuPosition | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const menuId = useId();
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

  const close = (restoreFocus = false) => {
    setOpen(false);
    setPosition(null);
    setQuery('');
    setActiveIndex(0);
    onSearchChange?.('');
    if (restoreFocus) window.requestAnimationFrame(() => triggerRef.current?.focus());
  };

  const updatePosition = () => {
    const trigger = triggerRef.current;
    const menu = menuRef.current;
    if (!trigger || !menu) return;
    const triggerRect = trigger.getBoundingClientRect();
    const menuRect = menu.getBoundingClientRect();
    const maxWidth = Math.max(0, window.innerWidth - VIEWPORT_GAP * 2);
    const menuWidth = Math.min(
      fullWidth ? triggerRect.width : Math.max(208, menuRect.width),
      maxWidth,
    );
    const menuHeight = menuRect.height;
    const below = window.innerHeight - triggerRect.bottom - VIEWPORT_GAP;
    const above = triggerRect.top - VIEWPORT_GAP;
    const placement =
      below < menuHeight && above > below ? ('top' as const) : ('bottom' as const);
    const unclampedLeft =
      menuAlign === 'right' ? triggerRect.right - menuWidth : triggerRect.left;
    const left = Math.min(
      Math.max(VIEWPORT_GAP, unclampedLeft),
      window.innerWidth - menuWidth - VIEWPORT_GAP,
    );
    const desiredTop =
      placement === 'top'
        ? triggerRect.top - menuHeight - TRIGGER_GAP
        : triggerRect.bottom + TRIGGER_GAP;
    const top = Math.min(
      Math.max(VIEWPORT_GAP, desiredTop),
      Math.max(VIEWPORT_GAP, window.innerHeight - menuHeight - VIEWPORT_GAP),
    );
    setPosition({
      top,
      left,
      width: fullWidth ? menuWidth : undefined,
      maxWidth,
      placement,
    });
  };

  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
  }, [open, query, visibleOptions.length]);

  useEffect(() => {
    if (!open) return;
    const update = () => updatePosition();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open || visibleOptions.length === 0) return;
    setActiveIndex((current) => Math.min(current, visibleOptions.length - 1));
  }, [open, visibleOptions.length]);

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
    close(true);
  };

  const clear = () => {
    if (props.multiple) props.onChange([]);
    else props.onChange('');
    if (!props.multiple) close(true);
  };

  const moveActive = (index: number) => {
    if (visibleOptions.length === 0) return;
    const next = (index + visibleOptions.length) % visibleOptions.length;
    setActiveIndex(next);
    window.requestAnimationFrame(() =>
      optionRefs.current[next]?.scrollIntoView({ block: 'nearest' }),
    );
  };

  const onMenuKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      close(true);
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      moveActive(activeIndex + 1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      moveActive(activeIndex - 1);
    } else if (event.key === 'Home') {
      event.preventDefault();
      moveActive(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      moveActive(visibleOptions.length - 1);
    } else if (event.key === 'Enter' && visibleOptions[activeIndex]) {
      event.preventDefault();
      selectOption(visibleOptions[activeIndex]);
    }
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

  const menuStyle: CSSProperties = position
    ? {
        top: position.top,
        left: position.left,
        width: position.width,
        maxWidth: position.maxWidth,
        visibility: 'visible',
      }
    : { top: 0, left: 0, visibility: 'hidden' };

  return (
    <div className={fullWidth ? 'w-full' : ''}>
      <button
        ref={triggerRef}
        type="button"
        className={`flex items-center gap-2 rounded-md border text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${triggerClass} ${fullWidth ? 'w-full' : ''}`}
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={open ? menuId : undefined}
        disabled={disabled}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            if (!open) setOpen(true);
          } else if (event.key === 'Escape' && open) {
            event.preventDefault();
            close(true);
          }
        }}
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

      {open &&
        createPortal(
          <>
            <div
              className="fixed inset-0 z-[70]"
              aria-hidden="true"
              onClick={() => close()}
            />
            <div
              ref={menuRef}
              id={menuId}
              data-placement={position?.placement}
              style={menuStyle}
              className="fixed z-[80] min-w-52 overflow-hidden rounded-lg border border-border bg-surface shadow-panel"
              onKeyDown={onMenuKeyDown}
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
                    onChange={(event) => {
                      setQuery(event.target.value);
                      setActiveIndex(0);
                      onSearchChange?.(event.target.value);
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

              <ScrollArea
                className="max-h-64"
                style={{
                  height: Math.min(256, Math.max(44, visibleOptions.length * 48)),
                }}
                contentClassName="p-1.5"
              >
                <div
                  role="listbox"
                  aria-label={label}
                  aria-multiselectable={props.multiple || undefined}
                >
                  {visibleOptions.length === 0 && (
                    <p className="px-3 py-4 text-center text-[13px] text-slate-400">
                      {emptyMessage}
                    </p>
                  )}
                  {visibleOptions.map((option, index) => {
                    const active = selectedValues.includes(option.value);
                    return (
                      <button
                        ref={(element) => {
                          optionRefs.current[index] = element;
                        }}
                        key={option.value}
                        type="button"
                        role="option"
                        tabIndex={-1}
                        aria-selected={active}
                        className={`flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-[13px] transition-colors hover:bg-muted ${
                          active || index === activeIndex
                            ? 'bg-muted text-ink'
                            : 'text-slate-600 dark:text-slate-300'
                        }`}
                        onMouseEnter={() => setActiveIndex(index)}
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
                        {active && <Check size={13} className="shrink-0 text-ink" />}
                      </button>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>
          </>,
          document.body,
        )}
    </div>
  );
}
