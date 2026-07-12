import type { LucideIcon } from 'lucide-react';

interface SidebarProps {
  /**
   * List of navigation options [id, icon, label].
   */
  nav: readonly (readonly [string, LucideIcon, string])[];
  /**
   * The currently active tab identifier.
   */
  active: string;
  /**
   * Callback fired when selecting a tab.
   */
  onSelect: (tab: any) => void;
}

/**
 * Sidebar renders responsive navigation tabs at the left (desktop) or top (mobile).
 */
export default function Sidebar({ nav, active, onSelect }: SidebarProps) {
  return (
    <aside className="flex w-full shrink-0 gap-1 overflow-x-auto border-b border-border bg-surface p-2 md:h-full md:w-56 md:flex-col md:overflow-y-auto md:border-b-0 md:border-r md:py-4">
      {nav.map(([id, Icon, label]) => (
        <button
          key={id}
          className={`flex h-10 shrink-0 items-center gap-3 rounded-lg px-3 text-left text-[14px] font-semibold transition-all md:mx-2 ${
            active === id
              ? 'bg-ink text-white dark:bg-[hsl(210,20%,92%)] dark:text-[hsl(220,15%,9%)]'
              : 'text-slate-500 hover:bg-muted hover:text-ink'
          }`}
          onClick={() => onSelect(id)}
        >
          <Icon size={16} /> {label}
        </button>
      ))}
    </aside>
  );
}
