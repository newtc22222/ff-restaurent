// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '../app/providers/i18n';
import ProfilePage from './ProfilePage';

const { mutate } = vi.hoisted(() => ({ mutate: vi.fn() }));

vi.mock('react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router')>();
  return { ...actual, useNavigate: () => vi.fn() };
});

vi.mock('../app/providers/app-context', () => ({
  useAppContext: () => ({
    user: {
      id: 'user-1',
      name: 'Phone Member',
      username: 'phone-member',
      phone: '+84901234567',
      chefRole: null,
      roles: ['CUSTOMER'],
    },
  }),
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

describe('ProfilePage phone validation', () => {
  it('keeps invalid phones inline and submits an explicit null when cleared', () => {
    render(
      <I18nProvider>
        <ProfilePage />
      </I18nProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Edit profile' }));
    const phone = screen.getByLabelText('Phone number');
    fireEvent.change(phone, { target: { value: '+12025550123' } });
    expect(screen.getByRole('alert').textContent).toContain(
      'valid Vietnamese mobile number',
    );
    expect(
      (screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);

    fireEvent.change(phone, { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(mutate).toHaveBeenCalledWith(
      {
        intent: 'update-profile',
        payload: {
          name: 'Phone Member',
          username: 'phone-member',
          phone: null,
        },
      },
      expect.objectContaining({
        fallback: 'Could not update the profile.',
        success: 'Profile updated.',
      }),
    );
  });
});
