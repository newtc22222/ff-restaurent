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
});
