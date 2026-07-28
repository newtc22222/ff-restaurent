// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '@/app/providers/i18n';
import BillDetailPage from './BillDetailPage';

const { navigate, routerState } = vi.hoisted(() => ({
  navigate: vi.fn(),
  routerState: {
    state: null as unknown,
    returnTo: null as string | null,
  },
}));

const user = {
  id: 'chef-1',
  username: 'chef',
  name: 'Chef',
  chefRole: 'SOUS_CHEF',
  systemRole: null,
  roles: ['CUSTOMER', 'SOUS_CHEF'],
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
  discounts: [],
  vouchers: [],
  paymentQrImage: null,
  paymentUrl: null,
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
    useLoaderData: () => [],
    useLocation: () => routerState,
    useNavigate: () => navigate,
    useParams: () => ({ billId: bill.id }),
    useSearchParams: () => [
      new URLSearchParams(
        routerState.returnTo ? { returnTo: routerState.returnTo } : undefined,
      ),
      vi.fn(),
    ],
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

const renderPage = () =>
  render(
    <I18nProvider>
      <BillDetailPage />
    </I18nProvider>,
  );

beforeEach(() => {
  localStorage.setItem('ff-locale', 'en');
  routerState.state = null;
  routerState.returnTo = null;
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.clearAllMocks();
});

describe('BillDetailPage back navigation', () => {
  it('returns to the originating filtered and paginated Bills list', () => {
    routerState.state = {
      billsReturnTo:
        '/bills?restaurantId=restaurant-1&cursor=bill-1&direction=forward',
    };
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: /Back to Bills/i }));

    expect(navigate).toHaveBeenCalledWith(
      '/bills?restaurantId=restaurant-1&cursor=bill-1&direction=forward',
      { replace: true },
    );
  });

  it('preserves the return target while editing a bill', () => {
    routerState.state = {
      billsReturnTo: '/bills?restaurantId=restaurant-1&cursor=bill-1',
    };
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: 'Edit bill' }));

    expect(navigate).toHaveBeenCalledWith(
      '/bills/bill-1/edit?returnTo=%2Fbills%3FrestaurantId%3Drestaurant-1%26cursor%3Dbill-1',
    );
  });

  it('uses the return target carried by an edit redirect', () => {
    routerState.returnTo = '/bills?restaurantId=restaurant-1&cursor=bill-1';
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: /Back to Bills/i }));

    expect(navigate).toHaveBeenCalledWith(
      '/bills?restaurantId=restaurant-1&cursor=bill-1',
      { replace: true },
    );
  });

  it.each([null, {}, { billsReturnTo: 'https://example.com' }])(
    'falls back to the Bills index for direct or unsafe state',
    (state) => {
      routerState.state = state;
      renderPage();

      fireEvent.click(screen.getByRole('button', { name: /Back to Bills/i }));

      expect(navigate).toHaveBeenCalledWith('/bills', { replace: true });
      cleanup();
      navigate.mockReset();
    },
  );
});
