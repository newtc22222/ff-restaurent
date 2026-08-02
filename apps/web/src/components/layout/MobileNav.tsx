import { useEffect, useRef } from 'react';
import { NavLink, useLocation } from 'react-router';

import ScrollArea from '../ui/ScrollArea';
import type { NavigationItem } from './navigation';

interface MobileNavProps {
  nav: readonly NavigationItem[];
  label: string;
}

/** Persistent mobile navigation strip with all role-authorized routes. */
export default function MobileNav({ nav, label }: MobileNavProps) {
  const { pathname } = useLocation();
  const activeLinkRef = useRef<HTMLAnchorElement>(null);
  const activePath = nav.find(
    ([path]) => pathname === path || pathname.startsWith(`${path}/`),
  )?.[0];

  useEffect(() => {
    const mobileBreakpoint = window.matchMedia('(max-width: 767px)');
    const centerActiveLink = () =>
      activeLinkRef.current?.scrollIntoView?.({
        block: 'nearest',
        inline: 'center',
      });
    const handleBreakpointChange = (event: MediaQueryListEvent) => {
      if (event.matches) centerActiveLink();
    };

    if (mobileBreakpoint.matches) centerActiveLink();
    mobileBreakpoint.addEventListener('change', handleBreakpointChange);

    return () =>
      mobileBreakpoint.removeEventListener('change', handleBreakpointChange);
  }, [activePath]);

  return (
    <nav
      aria-label={label}
      className="shrink-0 border-b border-border bg-surface md:hidden"
    >
      <ScrollArea
        axis="x"
        className="w-full"
        contentClassName="flex w-max min-w-full items-center gap-1 px-2 py-2"
      >
        {nav.map(([path, Icon, itemLabel]) => (
          <NavLink
            key={path}
            ref={path === activePath ? activeLinkRef : undefined}
            to={path}
            className={({ isActive }) =>
              `flex control-default shrink-0 items-center gap-2 rounded-md px-3 text-compact font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 ${
                isActive
                  ? 'bg-accent-strong text-accent-on-strong'
                  : 'text-slate-500 hover:bg-muted hover:text-ink'
              }`
            }
          >
            <Icon size={16} className="shrink-0" aria-hidden="true" />
            <span className="whitespace-nowrap">{itemLabel}</span>
          </NavLink>
        ))}
      </ScrollArea>
    </nav>
  );
}
