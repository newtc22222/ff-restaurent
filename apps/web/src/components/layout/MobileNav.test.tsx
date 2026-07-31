// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import { LayoutDashboard, Store, Users, Utensils } from 'lucide-react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import MobileNav from './MobileNav';
import type { NavigationItem } from './navigation';

const customerNav: readonly NavigationItem[] = [
  ['/bills', LayoutDashboard, 'Bills'],
  ['/restaurants', Store, 'Restaurants'],
  ['/cuisines', Utensils, 'Cuisines'],
];

const scrollIntoView = vi.fn();
let mobileBreakpointMatches = true;
let breakpointChangeListener:
  ((event: MediaQueryListEvent) => void) | undefined;

beforeEach(() => {
  scrollIntoView.mockClear();
  mobileBreakpointMatches = true;
  breakpointChangeListener = undefined;
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
    configurable: true,
    value: scrollIntoView,
  });
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn((query: string) => ({
      matches: mobileBreakpointMatches,
      media: query,
      onchange: null,
      addEventListener: (
        eventName: string,
        listener: (event: MediaQueryListEvent) => void,
      ) => {
        if (eventName === 'change') breakpointChangeListener = listener;
      },
      removeEventListener: (
        eventName: string,
        listener: (event: MediaQueryListEvent) => void,
      ) => {
        if (eventName === 'change' && breakpointChangeListener === listener) {
          breakpointChangeListener = undefined;
        }
      },
    })),
  });
});

afterEach(cleanup);

describe('MobileNav', () => {
  it('renders a horizontal navigation strip and centers the active route', () => {
    render(
      <MemoryRouter initialEntries={['/restaurants/restaurant-1']}>
        <MobileNav nav={customerNav} label="Primary navigation" />
      </MemoryRouter>,
    );

    const navigation = screen.getByRole('navigation', {
      name: 'Primary navigation',
    });
    expect(
      navigation.querySelector('[data-scroll-area][data-axis="x"]'),
    ).toBeTruthy();
    expect(
      within(navigation)
        .getByRole('link', { name: 'Restaurants' })
        .getAttribute('aria-current'),
    ).toBe('page');
    expect(scrollIntoView).toHaveBeenCalledWith({
      block: 'nearest',
      inline: 'center',
    });
  });

  it('centers the active route when navigation becomes visible on mobile', () => {
    mobileBreakpointMatches = false;
    render(
      <MemoryRouter initialEntries={['/cuisines']}>
        <MobileNav nav={customerNav} label="Primary navigation" />
      </MemoryRouter>,
    );

    expect(scrollIntoView).not.toHaveBeenCalled();

    act(() => {
      breakpointChangeListener?.({ matches: true } as MediaQueryListEvent);
    });

    expect(scrollIntoView).toHaveBeenCalledWith({
      block: 'nearest',
      inline: 'center',
    });
  });

  it('updates the active route through standard link navigation', () => {
    render(
      <MemoryRouter initialEntries={['/bills']}>
        <MobileNav nav={customerNav} label="Primary navigation" />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('link', { name: 'Cuisines' }));

    expect(
      screen
        .getByRole('link', { name: 'Cuisines' })
        .getAttribute('aria-current'),
    ).toBe('page');
  });

  it('shows only the role-authorized routes supplied by the app shell', () => {
    const { rerender } = render(
      <MemoryRouter>
        <MobileNav nav={customerNav} label="Primary navigation" />
      </MemoryRouter>,
    );

    expect(screen.queryByRole('link', { name: 'Members' })).toBeNull();

    rerender(
      <MemoryRouter>
        <MobileNav
          nav={[...customerNav, ['/admin', Users, 'Members']]}
          label="Primary navigation"
        />
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: 'Members' })).toBeTruthy();
  });
});
