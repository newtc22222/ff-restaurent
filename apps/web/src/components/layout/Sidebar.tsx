import { ChevronLeft, ChevronRight, type LucideIcon } from 'lucide-react';
import { NavLink } from 'react-router';
import ScrollArea from '../ui/ScrollArea';

interface SidebarProps {
  /**
   * List of navigation options [path, icon, label].
   */
  nav: readonly (readonly [string, LucideIcon, string])[];
  collapsed: boolean;
  onToggle: () => void;
  onNavigate: () => void;
}

/**
 * Sidebar renders an expandable desktop navigation and a collapsed mobile icon rail.
 */
export default function Sidebar({
  nav,
  collapsed,
  onToggle,
  onNavigate,
}: SidebarProps) {
  return (
    <>
      {!collapsed && (
        <button
          type="button"
          className="fixed inset-x-0 bottom-0 top-14 z-30 bg-slate-950/25 backdrop-blur-[1px] md:hidden"
          aria-label="Collapse navigation"
          onClick={onToggle}
        />
      )}
      <aside
        className={`z-40 flex h-full shrink-0 flex-col overflow-hidden border-r border-border bg-surface transition-[width] duration-200 ${
          collapsed
            ? 'relative w-14'
            : 'absolute inset-y-0 left-0 w-56 shadow-panel md:relative md:shadow-none'
        }`}
      >
        <div
          className={`hidden h-12 items-center border-b border-border px-2 md:flex ${
            collapsed ? 'justify-center' : 'justify-end'
          }`}
        >
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-muted hover:text-ink"
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
          desktopOnly
        >
          {nav.map(([path, Icon, label]) => (
            <NavLink
              key={path}
              to={path}
              title={collapsed ? label : undefined}
              onClick={onNavigate}
              className={({ isActive }) =>
                `flex h-10 shrink-0 items-center rounded-lg text-[14px] font-semibold transition-all ${
                  collapsed ? 'justify-center px-2' : 'gap-3 px-3'
                } ${
                  isActive
                    ? 'bg-ink text-white dark:bg-[hsl(210,20%,92%)] dark:text-[hsl(220,15%,9%)]'
                    : 'text-slate-500 hover:bg-muted hover:text-ink'
                }`
              }
            >
              <Icon size={17} className="shrink-0" />
              <span className={collapsed ? 'sr-only' : 'truncate'}>
                {label}
              </span>
            </NavLink>
          ))}
        </ScrollArea>
      </aside>
    </>
  );
}
