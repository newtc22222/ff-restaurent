// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { I18nProvider } from '@/app/providers/i18n';

import BillDetailPage from './BillDetailPage';

const { toBlob } = vi.hoisted(() => ({
  toBlob: vi.fn(
    async (
      _node: HTMLElement,
      _options?: { filter?: (element: HTMLElement) => boolean },
    ) => new Blob(['receipt'], { type: 'image/png' }),
  ),
}));

vi.mock('html-to-image', () => ({ toBlob }));

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
  paymentQrImage: null as {
    id: string;
    imageUrl: string;
    label: string;
  } | null,
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

const refresh = vi.fn();

vi.mock('@/app/providers/app-context', () => ({
  useAppContext: () => ({
    user,
    bills: [bill],
    refresh,
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
  vi.unstubAllGlobals();
  bill.paymentQrImage = null;
  Object.defineProperty(window.navigator, 'clipboard', {
    configurable: true,
    value: undefined,
  });
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

describe('BillDetailPage member breakdown identity', () => {
  it('renders participant avatar and localized You marker for the current user', () => {
    renderPage();
    expect(screen.getByText('You')).toBeTruthy();
  });
});

describe('BillDetailPage payment QR preview', () => {
  it('opens the full-size preview dialog when the QR thumbnail is activated', () => {
    bill.paymentQrImage = {
      id: 'qr-1',
      imageUrl: 'https://example.com/qr.png',
      label: 'Chef QR',
    };
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: 'Chef QR' }));

    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeTruthy();
    expect(
      screen
        .getAllByAltText('Chef QR')
        .some((img) => img.closest('[role="dialog"]')),
    ).toBe(true);
  });
});

describe('BillDetailPage screenshot capture', () => {
  it('falls back to downloading the captured receipt when image clipboard is unavailable', async () => {
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);
    const createObjectURL = vi.fn(() => 'blob:bill-capture');
    const revokeObjectURL = vi.fn();
    Object.defineProperty(window.URL, 'createObjectURL', {
      configurable: true,
      value: createObjectURL,
    });
    Object.defineProperty(window.URL, 'revokeObjectURL', {
      configurable: true,
      value: revokeObjectURL,
    });

    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Copy screenshot' }));

    await vi.waitFor(() => expect(toBlob).toHaveBeenCalled());
    await vi.waitFor(() => expect(createObjectURL).toHaveBeenCalled());
    expect(click).toHaveBeenCalled();
    await vi.waitFor(() =>
      expect(revokeObjectURL).toHaveBeenCalledWith('blob:bill-capture'),
    );

    click.mockRestore();
    const urlWithObjectUrls = window.URL as unknown as {
      createObjectURL?: typeof createObjectURL;
      revokeObjectURL?: typeof revokeObjectURL;
    };
    delete urlWithObjectUrls.createObjectURL;
    delete urlWithObjectUrls.revokeObjectURL;
  });

  it('copies a PNG ClipboardItem and excludes management controls from the receipt', async () => {
    class ClipboardItemStub {
      constructor(readonly data: Record<string, Blob>) {}
    }
    const write = vi.fn(async (_items: ClipboardItemStub[]) => undefined);
    vi.stubGlobal('ClipboardItem', ClipboardItemStub);
    Object.defineProperty(window.navigator, 'clipboard', {
      configurable: true,
      value: { write },
    });

    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Copy screenshot' }));

    await vi.waitFor(() => expect(write).toHaveBeenCalledOnce());
    const [clipboardItem] = write.mock.calls[0]![0];
    expect(clipboardItem.data['image/png']).toBeInstanceOf(Blob);

    const options = toBlob.mock.calls[0][1];
    const managementControl = document.createElement('button');
    managementControl.dataset.billCaptureIgnore = '';
    const receiptContent = document.createElement('section');
    expect(options?.filter?.(managementControl)).toBe(false);
    expect(options?.filter?.(receiptContent)).toBe(true);
  });
});
