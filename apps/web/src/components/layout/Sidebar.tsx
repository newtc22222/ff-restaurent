import type { LucideIcon } from 'lucide-react';
import { NavLink } from 'react-router';
import ScrollArea from '../ui/ScrollArea.js';

interface SidebarProps {
  /**
   * List of navigation options [path, icon, label].
   */
  nav: readonly (readonly [string, LucideIcon, string])[];
}

/**
 * Sidebar renders responsive navigation tabs at the left (desktop) or top (mobile).
 */
export default function Sidebar({ nav }: SidebarProps) {
  return (
    <aside className="w-full shrink-0 overflow-x-auto border-b border-border bg-surface p-2 md:h-full md:w-56 md:overflow-hidden md:border-b-0 md:border-r md:py-4">
      <ScrollArea
        className="h-full w-full"
        contentClassName="flex gap-1 md:flex-col"
        desktopOnly
      >
        {nav.map(([path, Icon, label]) => (
          <NavLink
            key={path}
            to={path}
            className={({ isActive }) =>
              `flex h-10 shrink-0 items-center gap-3 rounded-lg px-3 text-left text-[14px] font-semibold transition-all md:mx-2 ${
                isActive
                  ? 'bg-ink text-white dark:bg-[hsl(210,20%,92%)] dark:text-[hsl(220,15%,9%)]'
                  : 'text-slate-500 hover:bg-muted hover:text-ink'
              }`
            }
          >
            <Icon size={16} /> {label}
          </NavLink>
        ))}
      </ScrollArea>
    </aside>
  );
}
