// @vitest-environment jsdom
import {
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

beforeEach(() => {
  scrollIntoView.mockClear();
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
    configurable: true,
    value: scrollIntoView,
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
