import { useId, type ReactNode } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { cn } from '@/lib/cn';

type FilterBarProps = {
  label: string;
  children: ReactNode;
  actions?: ReactNode;
  busy?: boolean;
  className?: string;
  controlsClassName?: string;
};

/**
 * Shared accessible shell for route-backed list filters. Pages retain control
 * of their domain-specific fields while sharing one responsive layout and
 * labelled landmark.
 */
export default function FilterBar({
  label,
  children,
  actions,
  busy,
  className,
  controlsClassName,
}: FilterBarProps) {
  const headingId = useId();

  return (
    <section
      className={cn('panel w-full space-y-3 p-3', className)}
      aria-labelledby={headingId}
      aria-busy={busy}
    >
      <h2 id={headingId} className="field-group-title px-1">
        <SlidersHorizontal size={13} aria-hidden="true" />
        {label}
      </h2>
      <div
        className={cn('grid min-w-0 gap-2 sm:grid-cols-2', controlsClassName)}
      >
        {children}
      </div>
      {actions}
    </section>
  );
}
