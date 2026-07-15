// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '../app/providers/i18n';
import AdminPage from './AdminPage';

const { mutate } = vi.hoisted(() => ({ mutate: vi.fn() }));

const root = {
  id: 'root-1',
  name: 'Root Member',
  username: 'root',
  phone: null,
  chefRole: null,
  systemRole: 'ROOT_ADMIN' as const,
  roles: ['CUSTOMER', 'ROOT_ADMIN'],
};
const member = {
  id: 'member-1',
  name: 'Member One',
  username: 'member-one',
  phone: null,
  chefRole: 'HEAD_CHEF' as const,
  systemRole: null,
  roles: ['CUSTOMER', 'HEAD_CHEF'],
};

vi.mock('react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router')>();
  return { ...actual, Navigate: () => null };
});

vi.mock('../app/providers/app-context', () => ({
  useAppContext: () => ({ user: root, users: [root, member] }),
}));

vi.mock('../hooks/useMutation', () => ({
  useMutation: () => ({ mutate }),
}));

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('ff-locale', 'en');
  mutate.mockClear();
});

afterEach(cleanup);

describe('AdminPage ROOT_ADMIN governance', () => {
  it('shows friendly roles and requires exact transfer confirmation', () => {
    render(
      <I18nProvider>
        <AdminPage />
      </I18nProvider>,
    );

    expect(screen.getByText(/@root \/ Root Admin/)).toBeTruthy();
    expect(screen.getByText(/@member-one \/ Head Chef/)).toBeTruthy();

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
});
