// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { I18nProvider } from '@/app/providers/i18n';

import BillsPage from './BillsPage';

const { navigate, routerState } = vi.hoisted(() => ({
  navigate: vi.fn(),
  routerState: {
    pathname: '/bills',
    search: '?restaurantId=restaurant-1&cursor=bill-1&direction=forward',
  },
}));

const user = {
  id: 'customer-1',
  username: 'customer',
  name: 'Customer',
  chefRole: null,
  systemRole: null,
  roles: ['CUSTOMER'],
  paymentRemindersEnabled: true,
};

const bill = {
  id: 'bill-1',
  restaurantId: 'restaurant-1',
  createdById: 'chef-1',
  occurredOn: '2026-07-28',
  totalCost: 100_000,
  status: 'ACTIVE',
  restaurant: {
    id: 'restaurant-1',
    name: 'Test Restaurant',
    type: 'Restaurant',
    cuisineType: 'Vietnamese',
  },
  createdBy: {
    id: 'chef-1',
    username: 'chef',
    name: 'Chef',
  },
  participants: [
    {
      memberId: user.id,
      member: user,
      originCost: 100_000,
      allocatedVat: 0,
      allocatedShipping: 0,
      finalPrice: 100_000,
      paymentStatus: 'WAITING',
    },
  ],
};

vi.mock('react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router')>();
  return {
    ...actual,
    useLoaderData: () => ({
      items: [bill],
      pageInfo: {
        startCursor: null,
        endCursor: null,
        hasPreviousPage: false,
        hasNextPage: false,
      },
    }),
    useLocation: () => routerState,
    useNavigate: () => navigate,
    useSearchParams: () =>
      [new URLSearchParams(routerState.search), vi.fn()] as const,
  };
});

vi.mock('@/app/providers/app-context', () => ({
  useAppContext: () => ({
    user,
    bills: [bill],
  }),
}));

vi.mock('@/hooks/useRouteMutation', () => ({
  useRouteMutation: () => ({ mutate: vi.fn() }),
}));

const renderLayout = (layout: 'card' | 'list' | 'table') => {
  localStorage.setItem('ff-bills-layout', layout);
  render(
    <I18nProvider>
      <BillsPage />
    </I18nProvider>,
  );
};

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('ff-locale', 'en');
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('BillsPage detail navigation', () => {
  it.each(['card', 'list', 'table'] as const)(
    'preserves the filtered and paginated list URL from the %s layout',
    (layout) => {
      renderLayout(layout);

      if (layout === 'card') {
        fireEvent.click(screen.getByRole('button', { name: /View detail/i }));
      } else if (layout === 'list') {
        fireEvent.click(
          screen.getAllByRole('button', { name: /Test Restaurant/ }).at(-1)!,
        );
      } else {
        fireEvent.click(screen.getAllByRole('row')[1]!);
      }

      expect(navigate).toHaveBeenCalledWith('/bills/bill-1', {
        state: {
          billsReturnTo:
            '/bills?restaurantId=restaurant-1&cursor=bill-1&direction=forward',
        },
      });
    },
  );

  it('keeps table mode compact on mobile and pagination actions responsive', () => {
    renderLayout('table');

    const mobileTable = screen.getByTestId('bill-mobile-table');
    expect(mobileTable.className).toContain('md:hidden');
    expect(
      screen.getByRole('table').closest('[data-scroll-area]')?.className,
    ).toContain('hidden md:block');

    const pagination = screen.getByTestId('bills-pagination-actions');
    expect(pagination.className).toContain('grid-cols-2');
    expect(pagination.className).toContain('sm:flex');
    for (const button of pagination.querySelectorAll('button')) {
      expect(button.className).toContain('w-full');
      expect(button.className).toContain('sm:w-auto');
    }
  });

  it('renders table copy from the local i18n hook', () => {
    renderLayout('table');

    expect(
      screen.getByRole('columnheader', { name: 'Restaurant / Eatery' }),
    ).toBeTruthy();
    expect(
      screen.getByRole('columnheader', { name: 'Payment progress' }),
    ).toBeTruthy();
  });
});
