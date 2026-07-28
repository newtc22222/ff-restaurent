// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '@/app/providers/i18n';
import AdminPage from './AdminPage';
import { MemoryRouter } from 'react-router';

const { mutate, refresh } = vi.hoisted(() => ({
  mutate: vi.fn(),
  refresh: vi.fn(),
}));

const root = {
  id: 'root-1',
  name: 'Root Member',
  username: 'root',
  phone: null,
  chefRole: null,
  systemRole: 'ROOT_ADMIN' as const,
  accountStatus: 'ACTIVE' as const,
  roles: ['CUSTOMER', 'ROOT_ADMIN'],
};
const member = {
  id: 'member-1',
  name: 'Member One',
  username: 'member-one',
  phone: '+84901234567',
  chefRole: 'HEAD_CHEF' as const,
  systemRole: null,
  accountStatus: 'ACTIVE' as const,
  roles: ['CUSTOMER', 'HEAD_CHEF'],
};
const sous = {
  id: 'sous-1',
  name: 'Sous Member',
  username: 'sous-member',
  phone: '+84909876543',
  chefRole: 'SOUS_CHEF' as const,
  systemRole: null,
  accountStatus: 'ACTIVE' as const,
  roles: ['CUSTOMER', 'SOUS_CHEF'],
};
const customer = {
  id: 'customer-1',
  name: 'Customer Member',
  username: 'customer-member',
  phone: null,
  chefRole: null,
  systemRole: null,
  accountStatus: 'ACTIVE' as const,
  roles: ['CUSTOMER'],
};
const blocked = {
  id: 'blocked-1',
  name: 'Blocked Member',
  username: 'blocked-member',
  phone: null,
  chefRole: 'SOUS_CHEF' as const,
  systemRole: null,
  accountStatus: 'BLOCKED' as const,
  roles: ['CUSTOMER', 'SOUS_CHEF'],
};
let currentUser: typeof root | typeof member = root;

vi.mock('react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router')>();
  return {
    ...actual,
    Navigate: ({ to }: { to: string }) => (
      <div data-testid="redirect">{to}</div>
    ),
  };
});

vi.mock('@/app/providers/app-context', () => ({
  useAppContext: () => ({
    user: currentUser,
    users: [root, member, sous, customer, blocked],
    refresh,
    passwordResetRequests: [
      {
        id: 'reset-1',
        status: 'PENDING',
        failedAttempts: 0,
        createdAt: '2026-07-15T00:00:00.000Z',
        user: member,
      },
    ],
  }),
}));

vi.mock('@/hooks/useRouteMutation', () => ({
  useRouteMutation: () => ({ fetcher: { state: 'idle' }, mutate }),
}));

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('ff-locale', 'en');
  mutate.mockClear();
  refresh.mockClear();
  currentUser = root;
});

afterEach(cleanup);

describe('AdminPage ROOT_ADMIN governance', () => {
  it('shows friendly roles and requires exact transfer confirmation', () => {
    render(
      <MemoryRouter>
        <I18nProvider>
          <AdminPage />
        </I18nProvider>
      </MemoryRouter>,
    );

    const table = screen.getByRole('table');
    for (const heading of [
      'Full name',
      'Username',
      'Phone',
      'Effective role',
      'Account status',
      'Actions',
    ]) {
      expect(
        within(table).getByRole('columnheader', { name: heading }),
      ).toBeTruthy();
    }
    expect(within(table).getByText('Root Admin')).toBeTruthy();
    expect(within(table).getAllByText('Head Chef').length).toBeGreaterThan(0);
    expect(within(table).getAllByText('Sous Chef').length).toBeGreaterThan(0);
    expect(within(table).getAllByText('Customer').length).toBeGreaterThan(0);

    const rootRow = within(table).getByText('Root Member').closest('tr');
    expect(rootRow).toBeTruthy();
    expect(within(rootRow!).getByText('Read only')).toBeTruthy();
    expect(within(rootRow!).queryByRole('button')).toBeNull();
    expect(screen.getByLabelText('Member cards').className).toContain(
      'md:hidden',
    );

    const memberRow = within(table).getByText('Member One').closest('tr');
    fireEvent.click(
      within(memberRow!).getByRole('button', { name: 'Member One role' }),
    );
    fireEvent.click(screen.getByRole('option', { name: 'Sous Chef' }));
    expect(mutate).toHaveBeenCalledWith(
      {
        intent: 'update-role',
        userId: 'member-1',
        chefRole: 'SOUS_CHEF',
      },
      {
        fallback: 'Could not update the member role.',
        success: 'Member role updated.',
      },
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'Transfer Root Admin ownership' }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'New Root Admin' }));
    fireEvent.click(screen.getByRole('option', { name: /Member One/ }));
    const transfer = screen.getByRole('button', {
      name: 'Transfer ownership and sign out',
    }) as HTMLButtonElement;
    expect(transfer.disabled).toBe(true);

    fireEvent.change(screen.getByLabelText('Repeat the target username'), {
      target: { value: 'member-one' },
    });
    fireEvent.change(screen.getByLabelText('Your current password'), {
      target: { value: 'password123' },
    });
    expect(transfer.disabled).toBe(false);
    fireEvent.click(transfer);

    expect(mutate).toHaveBeenCalledWith(
      {
        intent: 'root-transfer',
        payload: {
          targetUsername: 'member-one',
          confirmationUsername: 'member-one',
          currentPassword: 'password123',
        },
      },
      {
        fallback: 'Could not transfer Root Admin ownership.',
        success: 'Root Admin ownership transferred. Sign in again.',
        redirects: true,
      },
    );
  });

  it('confirms account blocking and disables incompatible role controls', () => {
    render(
      <MemoryRouter>
        <I18nProvider>
          <AdminPage />
        </I18nProvider>
      </MemoryRouter>,
    );

    const memberRow = within(screen.getByRole('table'))
      .getByText('Member One')
      .closest('tr');
    fireEvent.click(within(memberRow!).getByRole('button', { name: 'Block' }));
    expect(screen.getByText('Block this account?')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(mutate).toHaveBeenCalledWith(
      {
        intent: 'update-account-status',
        userId: 'member-1',
        accountStatus: 'BLOCKED',
      },
      expect.objectContaining({
        fallback: 'Could not update the account status.',
        success: 'Account blocked.',
      }),
    );

    const blockedRow = within(screen.getByRole('table'))
      .getByText('Blocked Member')
      .closest('tr');
    expect(
      (
        within(blockedRow!).getByRole('button', {
          name: 'Blocked Member role',
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(
      within(blockedRow!).getByRole('button', { name: 'Restore' }),
    ).toBeTruthy();
  });

  it('searches the authenticated member snapshot by name, username, and phone', () => {
    render(
      <MemoryRouter>
        <I18nProvider>
          <AdminPage />
        </I18nProvider>
      </MemoryRouter>,
    );
    const search = screen.getByRole('searchbox', {
      name: 'Search name, username, or phone',
    });

    fireEvent.change(search, { target: { value: 'member one' } });
    expect(
      within(screen.getByRole('table')).getByText('Member One'),
    ).toBeTruthy();
    expect(
      within(screen.getByRole('table')).queryByText('Root Member'),
    ).toBeNull();

    fireEvent.change(search, { target: { value: 'sous-member' } });
    expect(
      within(screen.getByRole('table')).getByText('Sous Member'),
    ).toBeTruthy();

    fireEvent.change(search, { target: { value: '+84901234567' } });
    expect(
      within(screen.getByRole('table')).getByText('Member One'),
    ).toBeTruthy();

    fireEvent.change(search, { target: { value: 'not-a-member' } });
    expect(screen.getByText('No members match this search.')).toBeTruthy();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('redirects a Head Chef without rendering administration controls', () => {
    currentUser = member;
    render(
      <MemoryRouter>
        <I18nProvider>
          <AdminPage />
        </I18nProvider>
      </MemoryRouter>,
    );

    expect(screen.getByTestId('redirect').textContent).toBe('/bills');
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('issues and rejects pending password reset requests', () => {
    render(
      <MemoryRouter>
        <I18nProvider>
          <AdminPage />
        </I18nProvider>
      </MemoryRouter>,
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'Password reset requests' }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Issue code' }));
    expect(mutate).toHaveBeenCalledWith(
      { intent: 'issue-password-reset', requestId: 'reset-1' },
      expect.objectContaining({
        fallback: 'Could not issue the reset code.',
        success: 'Single-use reset code issued.',
      }),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Reject' }));
    expect(mutate).toHaveBeenCalledWith(
      { intent: 'reject-password-reset', requestId: 'reset-1' },
      expect.objectContaining({
        fallback: 'Could not reject the reset request.',
        success: 'Password reset request rejected.',
      }),
    );
  });
});
