import { ChevronLeft, ChevronRight } from 'lucide-react';
import { NavLink } from 'react-router';

import ScrollArea from '../ui/ScrollArea';
import type { NavigationItem } from './navigation';

interface SidebarProps {
  /**
   * List of navigation options [path, icon, label].
   */
  nav: readonly NavigationItem[];
  collapsed: boolean;
  onToggle: () => void;
}

/** Expandable desktop navigation sidebar. */
export default function Sidebar({ nav, collapsed, onToggle }: SidebarProps) {
  return (
    <aside
      className={`z-40 hidden h-full shrink-0 flex-col overflow-hidden border-r border-border bg-surface transition-[width] duration-200 md:flex ${
        collapsed ? 'w-14' : 'w-56'
      }`}
    >
      <div
        className={`flex control-lg items-center border-b border-border px-2 ${
          collapsed ? 'justify-center' : 'justify-end'
        }`}
      >
        <button
          type="button"
          className="flex control-sm w-8 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-muted hover:text-ink"
          onClick={onToggle}
          aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
          aria-expanded={!collapsed}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>
      <ScrollArea
        className="min-h-0 w-full flex-1"
        contentClassName="flex flex-col gap-1 p-2"
      >
        {nav.map(([path, Icon, label]) => (
          <NavLink
            key={path}
            to={path}
            title={collapsed ? label : undefined}
            className={({ isActive }) =>
              `flex control-default shrink-0 items-center rounded-lg text-sm font-semibold transition-all ${
                collapsed ? 'justify-center px-2' : 'gap-3 px-3'
              } ${
                isActive
                  ? 'bg-accent-strong text-accent-on-strong'
                  : 'text-slate-500 hover:bg-muted hover:text-ink'
              }`
            }
          >
            <Icon size={17} className="shrink-0" />
            <span className={collapsed ? 'sr-only' : 'truncate'}>{label}</span>
          </NavLink>
        ))}
      </ScrollArea>
    </aside>
  );
}
