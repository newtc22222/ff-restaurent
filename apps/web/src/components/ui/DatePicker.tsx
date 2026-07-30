import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isAfter,
  isBefore,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns';
import { enUS, vi } from 'date-fns/locale';
import { Calendar, ChevronLeft, ChevronRight, X } from 'lucide-react';
import {
  type MouseEvent as ReactMouseEvent,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';

import { useI18n } from '@/app/providers/i18n';
import {
  formatDateOnlyForLocale,
  formatLocalDateOnly,
  parseLocalDateOnly,
} from '@/lib/date-only';

const focusableDialogSelector =
  'button:not(:disabled), [href], input:not(:disabled), textarea:not(:disabled), select:not(:disabled), [tabindex]:not([tabindex="-1"])';

export interface DatePickerProps {
  value?: string;
  onChange: (value: string) => void;
  minDate?: string | Date;
  maxDate?: string | Date;
  placeholderText?: string;
  isClearable?: boolean;
  disabled?: boolean;
  className?: string;
  id?: string;
  ariaLabel?: string;
}

export default function DatePicker({
  value = '',
  onChange,
  minDate,
  maxDate,
  placeholderText,
  isClearable = false,
  disabled = false,
  className = '',
  id,
  ariaLabel,
}: DatePickerProps) {
  let locale = 'vi';
  let t = (key: string) => key;
  try {
    const i18n = useI18n();
    locale = i18n.locale;
    t = i18n.t;
  } catch {
    // Fallback for tests or isolated rendering
  }

  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const datePickerId = useId();
  const elementId = id || datePickerId;

  const activeLocale = locale === 'vi' ? vi : enUS;
  const selectedDate = parseLocalDateOnly(value);

  // Month currently being viewed in the calendar popup
  const [viewDate, setViewDate] = useState<Date>(
    () => selectedDate || new Date(),
  );

  // Keep viewDate updated when value changes while closed
  useEffect(() => {
    if (selectedDate) {
      setViewDate(selectedDate);
    }
  }, [value]);

  const [popoverPos, setPopoverPos] = useState<{
    top: number;
    left: number;
    width: number;
  }>({ top: 0, left: 0, width: 280 });

  const updatePosition = () => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const popoverWidth = Math.max(rect.width, 280);
    let left = rect.left;
    if (left + popoverWidth > window.innerWidth - 16) {
      left = Math.max(16, window.innerWidth - popoverWidth - 16);
    }
    setPopoverPos({
      top: rect.bottom + window.scrollY + 6,
      left,
      width: popoverWidth,
    });
  };

  const handleOpen = () => {
    if (disabled) return;
    updatePosition();
    const activeElement = document.activeElement as HTMLElement | null;
    previousFocusRef.current =
      activeElement && activeElement !== document.body
        ? activeElement
        : triggerRef.current;
    setViewDate(selectedDate || new Date());
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    updatePosition();
    window.requestAnimationFrame(() => {
      const selectedDay = popoverRef.current?.querySelector<HTMLElement>(
        '[data-selected="true"]',
      );
      const firstFocusable = popoverRef.current?.querySelector<HTMLElement>(
        focusableDialogSelector,
      );
      (selectedDay || firstFocusable || popoverRef.current)?.focus();
    });

    const handleScrollOrResize = () => updatePosition();
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        return;
      }

      if (e.key !== 'Tab' || !popoverRef.current) return;
      const focusable = Array.from(
        popoverRef.current.querySelectorAll<HTMLElement>(
          focusableDialogSelector,
        ),
      ).filter((element) => !element.hasAttribute('disabled'));
      if (focusable.length === 0) {
        e.preventDefault();
        popoverRef.current.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      } else if (!popoverRef.current.contains(active)) {
        e.preventDefault();
        first.focus();
      }
    };
    const handleClickOutside = (e: MouseEvent) => {
      if (
        triggerRef.current?.contains(e.target as Node) ||
        popoverRef.current?.contains(e.target as Node)
      ) {
        return;
      }
      setOpen(false);
    };

    window.addEventListener('resize', handleScrollOrResize);
    window.addEventListener('scroll', handleScrollOrResize, true);
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      window.removeEventListener('resize', handleScrollOrResize);
      window.removeEventListener('scroll', handleScrollOrResize, true);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
      const previous = previousFocusRef.current;
      if (previous && document.contains(previous)) {
        previous.focus({ preventScroll: true });
      }
      previousFocusRef.current = null;
    };
  }, [open]);

  // Parse bounds
  const minParsed =
    typeof minDate === 'string' ? parseLocalDateOnly(minDate) : minDate || null;
  const maxParsed =
    typeof maxDate === 'string' ? parseLocalDateOnly(maxDate) : maxDate || null;

  const isDayDisabled = (day: Date) => {
    if (minParsed && isBefore(day, minParsed) && !isSameDay(day, minParsed)) {
      return true;
    }
    if (maxParsed && isAfter(day, maxParsed) && !isSameDay(day, maxParsed)) {
      return true;
    }
    return false;
  };

  const handleSelectDay = (day: Date) => {
    if (isDayDisabled(day)) return;
    const formatted = formatLocalDateOnly(day) || '';
    onChange(formatted);
    setOpen(false);
  };

  const handleClear = (e: ReactMouseEvent) => {
    e.stopPropagation();
    onChange('');
  };

  // Calendar grid math
  const monthStart = startOfMonth(viewDate);
  const monthEnd = endOfMonth(monthStart);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const weekDays =
    locale === 'vi'
      ? ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']
      : ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

  const placeholder = placeholderText || t('bills.chooseDate');
  const displayText = value
    ? formatDateOnlyForLocale(value, locale)
    : placeholder;
  const accessibleName = ariaLabel || displayText;

  return (
    <div className={`relative inline-block w-full ${className}`}>
      <button
        ref={triggerRef}
        id={elementId}
        type="button"
        disabled={disabled}
        aria-label={accessibleName}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={handleOpen}
        className={`field flex w-full items-center justify-between gap-2 text-left font-normal transition-colors ${
          !value ? 'text-slate-400' : 'text-ink'
        } ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:border-ink/50'}`}
      >
        <span className="truncate">{displayText}</span>
        <div className="flex items-center gap-1 text-slate-400">
          {isClearable && value && !disabled && (
            <span
              role="button"
              tabIndex={0}
              aria-label="Clear date"
              className="rounded p-0.5 hover:bg-muted hover:text-ink"
              onClick={handleClear}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.stopPropagation();
                  onChange('');
                }
              }}
            >
              <X size={14} />
            </span>
          )}
          <Calendar size={16} aria-hidden="true" className="shrink-0" />
        </div>
      </button>

      {open &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={popoverRef}
            role="dialog"
            aria-modal="true"
            aria-label={ariaLabel || placeholder}
            tabIndex={-1}
            style={{
              position: 'absolute',
              top: `${popoverPos.top}px`,
              left: `${popoverPos.left}px`,
              width: `${popoverPos.width}px`,
            }}
            className="z-[90] rounded-xl border border-border bg-surface p-3 shadow-panel outline-none animate-in fade-in-50 zoom-in-95"
          >
            {/* Header: Month & Year navigation */}
            <div className="mb-3 flex items-center justify-between">
              <button
                type="button"
                className="grid h-8 w-8 place-items-center rounded-md text-slate-500 hover:bg-muted hover:text-ink"
                onClick={() => setViewDate(subMonths(viewDate, 1))}
                aria-label="Previous month"
              >
                <ChevronLeft size={16} />
              </button>
              <div className="text-sm font-semibold capitalize text-ink">
                {format(viewDate, 'MMMM yyyy', { locale: activeLocale })}
              </div>
              <button
                type="button"
                className="grid h-8 w-8 place-items-center rounded-md text-slate-500 hover:bg-muted hover:text-ink"
                onClick={() => setViewDate(addMonths(viewDate, 1))}
                aria-label="Next month"
              >
                <ChevronRight size={16} />
              </button>
            </div>

            {/* Weekday labels */}
            <div className="mb-1 grid grid-cols-7 text-center">
              {weekDays.map((day) => (
                <span
                  key={day}
                  className="py-1 text-2xs font-semibold uppercase text-slate-500"
                >
                  {day}
                </span>
              ))}
            </div>

            {/* Days grid */}
            <div className="grid grid-cols-7 gap-1">
              {days.map((day) => {
                const inMonth = isSameMonth(day, viewDate);
                const selected = selectedDate && isSameDay(day, selectedDate);
                const today = isToday(day);
                const dayDisabled = isDayDisabled(day);

                let cellStyle =
                  'grid h-8 w-full place-items-center rounded-md text-sm transition-colors ';
                if (dayDisabled) {
                  cellStyle += 'opacity-25 cursor-not-allowed text-slate-500';
                } else if (selected) {
                  cellStyle +=
                    'bg-ink text-white font-bold dark:bg-[hsl(210,20%,92%)] dark:text-[hsl(220,15%,9%)] shadow-sm';
                } else if (today) {
                  cellStyle +=
                    'font-bold text-saffron ring-1 ring-saffron hover:bg-muted';
                } else if (!inMonth) {
                  cellStyle +=
                    'text-slate-500 opacity-40 hover:bg-muted hover:opacity-100';
                } else {
                  cellStyle += 'text-ink hover:bg-muted font-medium';
                }

                return (
                  <button
                    key={day.toISOString()}
                    type="button"
                    aria-label={format(day, 'PPP', { locale: activeLocale })}
                    data-selected={selected ? 'true' : undefined}
                    disabled={dayDisabled}
                    onClick={() => handleSelectDay(day)}
                    className={cellStyle}
                  >
                    {format(day, 'd')}
                  </button>
                );
              })}
            </div>

            {/* Footer actions */}
            <div className="mt-3 flex items-center justify-between border-t border-border pt-2 text-xs">
              <button
                type="button"
                className="font-medium text-saffron hover:underline"
                onClick={() => {
                  const today = new Date();
                  if (!isDayDisabled(today)) {
                    handleSelectDay(today);
                  }
                }}
              >
                {locale === 'vi' ? 'Hôm nay' : 'Today'}
              </button>

              {isClearable && value && (
                <button
                  type="button"
                  className="font-medium text-slate-500 hover:text-ink"
                  onClick={() => {
                    onChange('');
                    setOpen(false);
                  }}
                >
                  {locale === 'vi' ? 'Xóa' : 'Clear'}
                </button>
              )}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
