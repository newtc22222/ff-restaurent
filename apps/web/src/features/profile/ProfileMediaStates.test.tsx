// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { I18nProvider } from '@/app/providers/i18n';

import ProfilePage from './ProfilePage';

const { queryState, refetch } = vi.hoisted(() => ({
  queryState: {
    data: [] as unknown[],
    isPending: false,
    isError: false,
  },
  refetch: vi.fn(),
}));

vi.mock('react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router')>();
  return { ...actual, useNavigate: () => vi.fn() };
});

vi.mock('@/app/providers/app-context', () => ({
  useAppContext: () => ({
    user: {
      id: 'chef-1',
      name: 'Sous Chef',
      username: 'sous',
      phone: null,
      avatarUrl: 'https://example.com/avatar.png',
      chefRole: 'SOUS_CHEF',
      systemRole: null,
      roles: ['CUSTOMER', 'SOUS_CHEF'],
      paymentRemindersEnabled: true,
    },
    refresh: vi.fn(),
  }),
}));

vi.mock('@/hooks/useRouteMutation', () => ({
  useRouteMutation: () => ({ mutate: vi.fn() }),
}));

vi.mock('./profile-media.queries', () => ({
  usePaymentQrImages: () => ({ ...queryState, refetch }),
  useProfileMediaMutations: () => ({
    uploadAvatar: { isPending: false, mutateAsync: vi.fn() },
    removeAvatar: { isPending: false, mutateAsync: vi.fn() },
    savePaymentQr: { isPending: false, mutateAsync: vi.fn() },
    removePaymentQr: { isPending: false, mutateAsync: vi.fn() },
  }),
}));

const renderProfile = () =>
  render(
    <I18nProvider>
      <ProfilePage />
    </I18nProvider>,
  );

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('ff-locale', 'en');
  queryState.data = [];
  queryState.isPending = false;
  queryState.isError = false;
  refetch.mockClear();
});

afterEach(cleanup);

describe('Profile payment QR query states', () => {
  it('renders the loading state', () => {
    queryState.isPending = true;
    renderProfile();
    expect(screen.getByRole('status').textContent).toContain('Loading');
  });

  it('renders the empty state', () => {
    renderProfile();
    expect(screen.getByText('No payment QR images yet.')).toBeTruthy();
  });

  it('offers an explicit retry after a handled query error', () => {
    queryState.isError = true;
    renderProfile();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('opens a full-size preview dialog for a saved QR image', () => {
    queryState.data = [
      { id: 'qr-1', imageUrl: 'https://example.com/qr.png', label: 'My QR' },
    ];
    renderProfile();

    fireEvent.click(screen.getByAltText('My QR'));

    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeTruthy();
    expect(
      screen
        .getAllByAltText('My QR')
        .some((img) => img.closest('[role="dialog"]')),
    ).toBe(true);
  });

  it('reflects a refreshed signed URL for the previewed QR instead of keeping a stale snapshot', () => {
    queryState.data = [
      {
        id: 'qr-1',
        imageUrl: 'https://example.com/qr-stale.png',
        label: 'My QR',
      },
    ];
    const { rerender } = render(
      <I18nProvider>
        <ProfilePage />
      </I18nProvider>,
    );

    fireEvent.click(screen.getByAltText('My QR'));
    const dialogImg = screen
      .getAllByAltText('My QR')
      .find((img) => img.closest('[role="dialog"]')) as HTMLImageElement;
    expect(dialogImg.src).toBe('https://example.com/qr-stale.png');

    // Simulate what a successful refetch (triggered by the dialog's
    // auto-retry on an expired signed URL) would eventually produce: a
    // fresh signed URL for the same QR id.
    queryState.data = [
      {
        id: 'qr-1',
        imageUrl: 'https://example.com/qr-fresh.png',
        label: 'My QR',
      },
    ];
    rerender(
      <I18nProvider>
        <ProfilePage />
      </I18nProvider>,
    );

    const refreshedImg = screen
      .getAllByAltText('My QR')
      .find((img) => img.closest('[role="dialog"]')) as HTMLImageElement;
    expect(refreshedImg.src).toBe('https://example.com/qr-fresh.png');
  });
});

describe('Profile avatar preview', () => {
  it('opens a full-size preview dialog for the current avatar', () => {
    renderProfile();

    fireEvent.click(screen.getByLabelText('View avatar'));

    expect(screen.getByRole('dialog')).toBeTruthy();
  });
});
