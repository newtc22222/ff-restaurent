// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react';
import { useFetcher } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '../app/providers/i18n';
import { ThemeProvider } from '../app/providers/theme';
import LoginPage from './LoginPage';

const { toastError } = vi.hoisted(() => ({ toastError: vi.fn() }));

vi.mock('react-hot-toast', () => ({
  default: { error: toastError, success: vi.fn() },
}));

vi.mock('react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router')>();
  return { ...actual, useFetcher: vi.fn() };
});

beforeEach(() => {
  toastError.mockClear();
  localStorage.clear();
  localStorage.setItem('ff-locale', 'en');
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
});

describe('LoginPage', () => {
  it('shows handled fetcher action errors once as localized toasts', async () => {
    vi.mocked(useFetcher).mockReturnValue({
      state: 'idle',
      data: {
        error: 'Invalid credentials',
        code: 'INVALID_CREDENTIALS',
        intent: 'login',
      },
      submit: vi.fn(),
    } as never);

    render(
      <ThemeProvider>
        <I18nProvider>
          <LoginPage />
        </I18nProvider>
      </ThemeProvider>,
    );

    expect(toastError).toHaveBeenCalledWith(
      'The username, phone number, or password is incorrect.',
      { id: 'auth-login-INVALID_CREDENTIALS' },
    );
    expect(screen.queryByText('Invalid credentials')).toBeNull();

    fireEvent.change(screen.getByLabelText('Phone / Username'), {
      target: { value: 'another-user' },
    });
    expect(toastError).toHaveBeenCalledTimes(1);
  });
});
